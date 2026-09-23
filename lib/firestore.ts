import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import { lerChavePrivada } from "./chave";
import { PESSOAS } from "./config";
import type { Lancamento, Mes, Painel } from "./tipos";

/**
 * Só o Admin SDK toca no Firestore. O browser nunca fala com a base de dados
 * — ver firestore.rules, que nega tudo do lado do cliente.
 */
let instancia: Firestore | null = null;

export function db(): Firestore {
  if (instancia) return instancia;

  // Em dev o Next recarrega este módulo, o que põe `instancia` a null outra
  // vez — mas a app Firebase é global e sobrevive. Por isso o que decide se
  // podemos chamar settings() é o estado da app, não o do módulo: settings()
  // só pode ser chamado uma vez, e antes de qualquer outra operação.
  const jaExistia = getApps().length > 0;

  if (!jaExistia) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    const emFalta = [
      ["FIREBASE_PROJECT_ID", projectId],
      ["FIREBASE_CLIENT_EMAIL", clientEmail],
      ["FIREBASE_PRIVATE_KEY", privateKey],
    ].filter(([, v]) => !v).map(([nome]) => nome);

    if (emFalta.length || !projectId || !clientEmail || !privateKey) {
      throw new Error(
        `Firebase não configurado: falta ${emFalta.join(", ")}. ` +
        "Na Vercel, confirma que a variável existe E que tem a caixa Production marcada, " +
        "e faz Redeploy — variáveis novas só entram no deploy seguinte.",
      );
    }

    // Uma chave mal colada (com as aspas do JSON à volta, ou truncada) falha
    // mais à frente com um erro de OpenSSL que não diz o que fazer.
    if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
      throw new Error(
        "FIREBASE_PRIVATE_KEY não parece uma chave: falta o cabeçalho -----BEGIN PRIVATE KEY-----. " +
        "O valor é só o conteúdo entre aspas do campo private_key do JSON, sem as aspas de fora.",
      );
    }
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  instancia = getFirestore(getApp());
  if (!jaExistia) instancia.settings({ ignoreUndefinedProperties: true });
  return instancia;
}

/** Substitui os lançamentos de uma pessoa pelos que vieram agora da planilha. */
export async function gravarPessoa(
  slug: string,
  lancamentos: Lancamento[],
): Promise<{ escritos: number; removidos: number }> {
  const firestore = db();
  const pessoa = PESSOAS.find((p) => p.slug === slug);
  if (!pessoa) throw new Error(`Pessoa desconhecida: ${slug}`);

  const docPessoa = firestore.collection("pessoas").doc(slug);
  const colecao = docPessoa.collection("lancamentos");

  const existentes = await colecao.select().get();
  const idsAntigos = new Set(existentes.docs.map((d) => d.id));
  const idsNovos = new Set(lancamentos.map((l) => l.id));
  const aRemover = [...idsAntigos].filter((id) => !idsNovos.has(id));

  // Saldo = soma de tudo. Linhas negativas são pagamentos que a pessoa já fez.
  const totalAberto = lancamentos.reduce((s, l) => s + l.valor, 0);
  const totalPago = -lancamentos.filter((l) => l.valor < 0).reduce((s, l) => s + l.valor, 0);

  // O Firestore aceita 500 operações por lote.
  let lote = firestore.batch();
  let naLote = 0;
  const lotes = [lote];

  const proximo = () => {
    if (naLote >= 450) { lote = firestore.batch(); lotes.push(lote); naLote = 0; }
    naLote++;
    return lote;
  };

  for (const l of lancamentos) proximo().set(colecao.doc(l.id), l);
  for (const id of aRemover) proximo().delete(colecao.doc(id));

  proximo().set(
    docPessoa,
    {
      slug,
      nome: pessoa.nome,
      saudacao: pessoa.saudacao,
      totalAberto,
      totalPago,
      emAberto: lancamentos.filter((l) => l.valor > 0).length,
      atualizadoEm: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  for (const l of lotes) await l.commit();

  return { escritos: lancamentos.length, removidos: aRemover.length };
}

/** Encontra a pessoa a quem pertence um token de acesso. */
export async function pessoaPorToken(token: string): Promise<string | null> {
  if (!/^[a-f0-9]{24,64}$/i.test(token)) return null;

  const encontrado = await db()
    .collection("pessoas")
    .where("token", "==", token)
    .limit(1)
    .get();

  return encontrado.empty ? null : encontrado.docs[0].id;
}

/** Carrega o painel de uma pessoa — e só dessa pessoa. */
export async function carregarPainel(slug: string): Promise<Painel | null> {
  const firestore = db();
  const doc = await firestore.collection("pessoas").doc(slug).get();
  if (!doc.exists) return null;

  const dados = doc.data() ?? {};
  // Sem orderBy: ordenar por dois campos exigiria um índice composto, e são
  // poucas dezenas de documentos por pessoa. Ordena-se aqui.
  const docs = await firestore
    .collection("pessoas").doc(slug)
    .collection("lancamentos")
    .get();

  // Agrupar por mês, mantendo a ordem das abas da planilha.
  const porMes = new Map<string, Mes>();
  const lancamentos = docs.docs
    .map((d) => d.data() as Lancamento)
    .sort((a, b) => b.ordemMes - a.ordemMes || a.linha - b.linha);

  for (const l of lancamentos) {
    let mes = porMes.get(l.mes);
    if (!mes) { mes = { nome: l.mes, ordem: l.ordemMes, lancamentos: [], total: 0 }; porMes.set(l.mes, mes); }
    mes.lancamentos.push(l);
    mes.total += l.valor;
  }

  const atualizadoEm = dados.atualizadoEm?.toDate?.() as Date | undefined;

  return {
    slug,
    nome: String(dados.nome ?? slug),
    saudacao: String(dados.saudacao ?? `Oi, ${dados.nome ?? slug}`),
    meses: [...porMes.values()].sort((a, b) => b.ordem - a.ordem),
    total: Number(dados.totalAberto ?? 0),
    totalPago: Number(dados.totalPago ?? 0),
    atualizadoEm: atualizadoEm ? atualizadoEm.toISOString() : null,
  };
}

/** Resumo de todas as pessoas — usado só no painel privado do dono. */
export async function carregarResumo() {
  const todas = await db().collection("pessoas").get();
  return todas.docs
    .map((d) => {
      const x = d.data();
      return {
        slug: d.id,
        nome: String(x.nome ?? d.id),
        token: String(x.token ?? ""),
        totalAberto: Number(x.totalAberto ?? 0),
        totalPago: Number(x.totalPago ?? 0),
        emAberto: Number(x.emAberto ?? 0),
        atualizadoEm: (x.atualizadoEm?.toDate?.() as Date | undefined)?.toISOString() ?? null,
      };
    })
    .sort((a, b) => b.totalAberto - a.totalAberto);
}
