import { JWT } from "google-auth-library";
import { ABAS, COLUNAS, PESSOAS, ROTULOS_IGNORADOS } from "./config";
import { chave, idDaLinha, lerValor } from "./normalizar";
import type { Lancamento } from "./tipos";

/** Uma aba, já reduzida ao que nos interessa. */
export type Aba = {
  nome: string;
  /** `celulas[linha][coluna]` — 0-indexado, como a API devolve. */
  celulas: Array<Array<{ texto: string; cor: string } | null>>;
  /** Células fundidas, em índices 0-based semi-abertos. */
  fusoes: Array<{ linhaIni: number; linhaFim: number; colIni: number; colFim: number }>;
};

type Cor = { red?: number; green?: number; blue?: number };

function hex({ red = 0, green = 0, blue = 0 }: Cor): string {
  const b = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return (b(red) + b(green) + b(blue)).toUpperCase();
}

/**
 * Lê as abas pedidas com formatação e células fundidas.
 *
 * Tem de ser `spreadsheets.get` com `includeGridData`: o endpoint `values`
 * devolve só texto, e aqui a estrutura vive nas fusões da coluna "Nome".
 */
export async function lerPlanilha(): Promise<Aba[]> {
  const id = process.env.PLANILHA_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const chavePrivada = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!id || !email || !chavePrivada) {
    throw new Error(
      "Planilha não configurada: faltam PLANILHA_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL ou GOOGLE_PRIVATE_KEY.",
    );
  }

  const jwt = new JWT({
    email, key: chavePrivada,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error("Não foi possível autenticar na API do Google Sheets.");

  const params = new URLSearchParams({ includeGridData: "true" });
  for (const aba of ABAS) params.append("ranges", `${aba}!A:N`);
  // Só os campos que usamos: a resposta completa desta planilha são muitos MB.
  params.set("fields", [
    "sheets.properties.title",
    "sheets.merges",
    "sheets.data.rowData.values.formattedValue",
    "sheets.data.rowData.values.effectiveFormat.backgroundColor",
  ].join(","));

  const resposta = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}?${params}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    throw new Error(
      `Sheets API respondeu ${resposta.status}. Confirma que a planilha está partilhada ` +
      `com ${email}. ${corpo.slice(0, 300)}`,
    );
  }

  const dados = (await resposta.json()) as {
    sheets?: Array<{
      properties?: { title?: string };
      merges?: Array<{ startRowIndex?: number; endRowIndex?: number; startColumnIndex?: number; endColumnIndex?: number }>;
      data?: Array<{ rowData?: Array<{ values?: Array<{ formattedValue?: string; effectiveFormat?: { backgroundColor?: Cor } }> }> }>;
    }>;
  };

  return (dados.sheets ?? []).map((folha) => ({
    nome: folha.properties?.title ?? "",
    fusoes: (folha.merges ?? []).map((m) => ({
      linhaIni: m.startRowIndex ?? 0,
      linhaFim: m.endRowIndex ?? 0,
      colIni: m.startColumnIndex ?? 0,
      colFim: m.endColumnIndex ?? 0,
    })),
    celulas: (folha.data?.[0]?.rowData ?? []).map((linha) =>
      (linha.values ?? []).map((c) =>
        c?.formattedValue === undefined && !c?.effectiveFormat?.backgroundColor
          ? null
          : { texto: c.formattedValue ?? "", cor: hex(c.effectiveFormat?.backgroundColor ?? {}) },
      ),
    ),
  }));
}

const texto = (aba: Aba, l: number, c: number) => aba.celulas[l]?.[c]?.texto?.trim() ?? "";

/** Onde estão as colunas da secção de pessoas, e em que linha está o cabeçalho. */
export type Mapa = {
  cabecalho: number;
  categoria: number; parcelas: number; descricao: number;
  valor: number; situacao: number; cartao: number; nome: number; total: number;
};

export function mapearColunas(aba: Aba): Mapa | null {
  for (let l = 0; l < aba.celulas.length; l++) {
    const celulas = (aba.celulas[l] ?? []).map((c) => chave(c?.texto ?? ""));
    const acha = (aceites: readonly string[]) =>
      celulas.findIndex((v) => v !== "" && aceites.includes(v));

    const nome = acha(COLUNAS.nome);
    const valor = acha(COLUNAS.valor);
    const descricao = acha(COLUNAS.descricao);
    if (nome < 0 || valor < 0 || descricao < 0) continue;

    // A coluna do total do bloco costuma não ter cabeçalho escrito: é só a
    // coluna logo a seguir ao "Nome", com uma célula fundida por bloco.
    const totalComCabecalho = acha(COLUNAS.total);

    return {
      cabecalho: l, nome, valor, descricao,
      total: totalComCabecalho >= 0 ? totalComCabecalho : nome + 1,
      categoria: acha(COLUNAS.categoria),
      parcelas: acha(COLUNAS.parcelas),
      situacao: acha(COLUNAS.situacao),
      cartao: acha(COLUNAS.cartao),
    };
  }
  return null;
}

/**
 * Marcas de contabilidade interna que não se mostram a quem lê o painel.
 * "pago" nestas colunas quer dizer que a FATURA do cartão está paga — pô-lo
 * ao lado de "em aberto" só faz a pessoa perguntar porquê.
 */
const RUIDO = new Set(["ok", "pago", "paga", "pg", "-", "x", "sim", "nao", "não", ""]);

const POR_ROTULO = new Map<string, string>(
  PESSOAS.flatMap((p) => p.rotulos.map((r) => [chave(r), p.slug] as const)),
);
const IGNORADOS = new Set(ROTULOS_IGNORADOS.map(chave));

/** Um bloco de pessoa dentro de uma aba. */
export type Bloco = {
  slug: string; rotulo: string; linhaIni: number; linhaFim: number;
  /** A soma que a planilha mostra para este bloco, para cruzarmos com a nossa. */
  totalDeclarado: number | null;
};

/**
 * Encontra os blocos de pessoa: cada célula FUNDIDA na coluna "Nome".
 *
 * Confirmado contra a própria planilha: ao lado de cada bloco há uma célula
 * fundida na coluna "Total" com a soma que a folha mostra, e em 15 blocos de
 * 15 essa soma cobre exactamente as linhas da fusão.
 */
export function encontrarBlocos(aba: Aba, mapa: Mapa): Bloco[] {
  const blocos: Bloco[] = [];

  for (const fusao of aba.fusoes) {
    if (fusao.colIni !== mapa.nome || fusao.linhaIni <= mapa.cabecalho) continue;

    const rotulo = texto(aba, fusao.linhaIni, mapa.nome);
    const k = chave(rotulo);
    const slug = POR_ROTULO.get(k);
    if (!slug || IGNORADOS.has(k)) continue;

    // A soma que a planilha mostra para este bloco, se lá estiver.
    const declarado = mapa.total >= 0
      ? lerValor(texto(aba, fusao.linhaIni, mapa.total))
      : null;

    blocos.push({
      slug, rotulo,
      linhaIni: fusao.linhaIni,
      linhaFim: fusao.linhaFim,
      totalDeclarado: declarado,
    });
  }

  return blocos.sort((a, b) => a.linhaIni - b.linhaIni);
}

/**
 * Converte as abas nos lançamentos de cada pessoa.
 *
 * Valores negativos são pagamentos já feitos pela pessoa (a planilha usa
 * linhas como "que ela ja pagou  -200,00"), por isso entram no saldo tal como
 * estão — o total de um bloco é a soma simples da coluna Valor.
 */
export async function extrairLancamentos(abas: Aba[]): Promise<{
  porPessoa: Map<string, Lancamento[]>;
  lidas: number;
  ignoradas: number;
  avisos: string[];
}> {
  const avisos: string[] = [];
  const porPessoa = new Map<string, Lancamento[]>(PESSOAS.map((p) => [p.slug, []]));
  let lidas = 0;
  let ignoradas = 0;

  for (const [indiceDaAba, aba] of abas.entries()) {
    const mapa = mapearColunas(aba);
    if (!mapa) {
      avisos.push(`Aba "${aba.nome}": não encontrei o cabeçalho (Compra / Valor / Nome) — ignorada.`);
      continue;
    }

    const blocos = encontrarBlocos(aba, mapa);
    if (!blocos.length) avisos.push(`Aba "${aba.nome}": nenhum bloco de pessoa reconhecido.`);

    for (const bloco of blocos) {
      for (let l = bloco.linhaIni; l < bloco.linhaFim; l++) {
        const descricao = texto(aba, l, mapa.descricao);
        const bruto = texto(aba, l, mapa.valor);
        if (!descricao && !bruto) continue;

        const valor = lerValor(bruto);
        if (valor === null || valor === 0) {
          if (descricao) {
            ignoradas++;
            avisos.push(`${aba.nome} linha ${l + 1} ("${descricao.slice(0, 30)}"): valor ilegível ("${bruto}").`);
          }
          continue;
        }

        const parcela = mapa.parcelas >= 0 ? texto(aba, l, mapa.parcelas) : "";
        const situacao = mapa.situacao >= 0 ? texto(aba, l, mapa.situacao) : "";
        const cartao = mapa.cartao >= 0 ? texto(aba, l, mapa.cartao) : "";

        porPessoa.get(bloco.slug)!.push({
          id: await idDaLinha(bloco.slug, aba.nome, descricao, valor, l),
          mes: aba.nome,
          ordemMes: indiceDaAba,
          linha: l,
          descricao: descricao || "Sem descrição",
          valor,
          parcela,
          // "pago"/"mes seguinte" na coluna Situação é o estado da FATURA do
          // cartão, não o acerto com a pessoa. O que salda a dívida é uma
          // linha de valor negativo.
          nota: [cartao, situacao]
            .filter((t) => !RUIDO.has(chave(t)))
            .join(" · "),
        });
        lidas++;
      }

      // A fórmula da planilha soma só células numéricas: um valor escrito como
      // texto ("R$ 61,18", "380,5*") desaparece do total dela em silêncio. Nós
      // lemos os dois formatos, por isso avisamos quando divergem — é dinheiro
      // a mais que a folha não está a contar.
      if (bloco.totalDeclarado !== null) {
        const nosso = porPessoa.get(bloco.slug)!
          .filter((l) => l.mes === aba.nome)
          .reduce((s, l) => s + l.valor, 0);
        const diferenca = nosso - bloco.totalDeclarado;
        // Abaixo de cinco cêntimos é arredondamento da folha (ela mostra
        // 3.385,38 para um valor que é 3.385,375), não um valor em falta.
        if (Math.abs(diferenca) >= 0.05) {
          avisos.push(
            `${aba.nome}, bloco "${bloco.rotulo}": a planilha mostra ` +
            `${bloco.totalDeclarado.toFixed(2)} mas as linhas somam ${nosso.toFixed(2)} ` +
            `(${diferenca > 0 ? "+" : ""}${diferenca.toFixed(2)} — valores escritos como texto).`,
          );
        }
      }
    }
  }

  if (avisos.length > 25) avisos.splice(25, avisos.length, `…e mais ${avisos.length - 25} avisos.`);
  return { porPessoa, lidas, ignoradas, avisos };
}
