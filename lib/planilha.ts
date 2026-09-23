import { JWT } from "google-auth-library";
import { ABAS, COLUNAS, FIM_DO_BLOCO, PESSOAS, ROTULOS_IGNORADOS } from "./config";
import { chave, idDaLinha, lerData, lerValor } from "./normalizar";
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
  valor: number; situacao: number; cartao: number; nome: number;
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

    return {
      cabecalho: l, nome, valor, descricao,
      categoria: acha(COLUNAS.categoria),
      parcelas: acha(COLUNAS.parcelas),
      situacao: acha(COLUNAS.situacao),
      cartao: acha(COLUNAS.cartao),
    };
  }
  return null;
}

const POR_ROTULO = new Map<string, string>(
  PESSOAS.flatMap((p) => p.rotulos.map((r) => [chave(r), p.slug] as const)),
);
const IGNORADOS = new Set(ROTULOS_IGNORADOS.map(chave));

/** Um bloco de pessoa dentro de uma aba. */
export type Bloco = { slug: string; rotulo: string; linhaIni: number; linhaFim: number };

/**
 * Encontra os blocos de pessoa.
 *
 * O bloco de alguém vai do seu rótulo na coluna "Nome" até ao rótulo seguinte,
 * seja ele de outra pessoa ou de uma categoria ignorada como "Mercado".
 *
 * A célula fundida sozinha não serve: na planilha há fusões mais curtas do que
 * o bloco realmente pintado (Mãe, Setembro: a fusão pára na linha 185 mas o
 * verde desce até à 205). E a cor sozinha também não: um bloco usa mais do que
 * uma tonalidade (Fernando, Setembro: 6D9EEB nas primeiras linhas e C9DAF8 nas
 * restantes). Ir de rótulo a rótulo dá exactamente a união das duas cores.
 */
export function encontrarBlocos(aba: Aba, mapa: Mapa): Bloco[] {
  // Todos os rótulos da coluna Nome, por ordem — inclusive os ignorados, que
  // servem de fronteira.
  const rotulos = aba.fusoes
    .filter((f) => f.colIni === mapa.nome && f.linhaIni > mapa.cabecalho)
    .map((f) => ({ linha: f.linhaIni, texto: texto(aba, f.linhaIni, mapa.nome) }))
    .filter((r) => r.texto !== "")
    .sort((a, b) => a.linha - b.linha);

  const blocos: Bloco[] = [];

  for (let i = 0; i < rotulos.length; i++) {
    const { linha, texto: rotulo } = rotulos[i];
    const k = chave(rotulo);
    const slug = POR_ROTULO.get(k);
    if (!slug || IGNORADOS.has(k)) continue;

    // Até ao rótulo seguinte; no último bloco, até a folha ficar em branco —
    // sem isto o último bloco engoliria o resto da aba.
    let fim = i + 1 < rotulos.length ? rotulos[i + 1].linha : aba.celulas.length;
    if (i + 1 === rotulos.length) {
      let vazias = 0;
      for (let l = linha; l < aba.celulas.length; l++) {
        const temValor = texto(aba, l, mapa.valor) !== "" || texto(aba, l, mapa.descricao) !== "";
        vazias = temValor ? 0 : vazias + 1;
        if (vazias >= FIM_DO_BLOCO) { fim = l - vazias + 1; break; }
      }
    }

    blocos.push({ slug, rotulo, linhaIni: linha, linhaFim: fim });
  }

  return blocos;
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

  for (const aba of abas) {
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

        const data = mapa.parcelas >= 0 ? lerData(texto(aba, l, mapa.parcelas)) : null;
        const situacao = mapa.situacao >= 0 ? texto(aba, l, mapa.situacao) : "";
        const cartao = mapa.cartao >= 0 ? texto(aba, l, mapa.cartao) : "";

        porPessoa.get(bloco.slug)!.push({
          id: await idDaLinha(bloco.slug, data ?? aba.nome, descricao, valor, l),
          data: data ?? "1970-01-01",
          descricao: descricao || "Sem descrição",
          valor,
          // "pago"/"mes seguinte" na coluna Situação é o estado da FATURA do
          // cartão, não o acerto com a pessoa. O que salda a dívida é uma
          // linha de valor negativo.
          pago: false,
          mes: aba.nome,
          nota: [cartao, situacao].filter(Boolean).join(" · "),
        });
        lidas++;
      }
    }
  }

  if (avisos.length > 25) avisos.splice(25, avisos.length, `…e mais ${avisos.length - 25} avisos.`);
  return { porPessoa, lidas, ignoradas, avisos };
}
