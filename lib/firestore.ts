import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import { PESSOAS } from "./config";
import type { Lancamento, Mes, Painel } from "./tipos";

/**
 * Só o Admin SDK toca no Firestore. O browser nunca fala com a base de dados
 * — ver firestore.rules, que nega tudo do lado do cliente.
 */
export function db(): Firestore {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "Firebase não configurado: faltam FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL ou FIREBASE_PRIVATE_KEY.",
      );
    }
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  const firestore = getFirestore(getApp());
  firestore.settings({ ignoreUndefinedProperties: true });
  return firestore;
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
  const docs = await firestore
    .collection("pessoas").doc(slug)
    .collection("lancamentos")
    .orderBy("ordemMes", "desc")
    .get();

  // Agrupar por mês, mantendo a ordem das abas da planilha.
  const porMes = new Map<string, Mes>();
  for (const d of docs.docs) {
    const l = d.data() as Lancamento;
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
