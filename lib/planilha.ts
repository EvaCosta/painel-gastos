import { JWT } from "google-auth-library";
import { ABA, COLUNAS, PESSOAS, VALORES_PAGO } from "./config";
import { chave, idDaLinha, lerData, lerValor } from "./normalizar";
import type { Lancamento } from "./tipos";

type Linhas = string[][];

/**
 * Lê a planilha. Duas vias, pela ordem:
 *  1. API do Sheets com conta de serviço — a folha continua privada.
 *  2. CSV publicado (`PLANILHA_CSV_URL`) — mais simples de configurar, mas
 *     quem souber o link lê a folha toda.
 */
export async function lerPlanilha(): Promise<Linhas> {
  const id = process.env.PLANILHA_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const chavePrivada = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (id && email && chavePrivada) return lerViaApi(id, email, chavePrivada);

  const csv = process.env.PLANILHA_CSV_URL;
  if (csv) return lerViaCsv(csv);

  throw new Error(
    "Planilha não configurada: define PLANILHA_ID + GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY, ou PLANILHA_CSV_URL.",
  );
}

async function lerViaApi(id: string, email: string, key: string): Promise<Linhas> {
  const jwt = new JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error("Não foi possível autenticar na API do Google Sheets.");

  const intervalo = encodeURIComponent(ABA ? `${ABA}!A:Z` : "A:Z");
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}` +
    `/values/${intervalo}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE` +
    `&dateTimeRenderOption=FORMATTED_STRING`;

  const resposta = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    throw new Error(
      `Sheets API respondeu ${resposta.status}. ` +
      `Confirma que a folha está partilhada com ${email}. ${corpo.slice(0, 300)}`,
    );
  }

  const dados = (await resposta.json()) as { values?: unknown[][] };
  return (dados.values ?? []).map((linha) => linha.map((c) => String(c ?? "")));
}

async function lerViaCsv(url: string): Promise<Linhas> {
  const resposta = await fetch(url, { cache: "no-store" });
  if (!resposta.ok) throw new Error(`CSV da planilha respondeu ${resposta.status}.`);
  return parseCsv(await resposta.text());
}

/** Parser de CSV com aspas e quebras de linha dentro de campos. */
export function parseCsv(texto: string): Linhas {
  const linhas: Linhas = [];
  let campo = "";
  let linha: string[] = [];
  let entreAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else { entreAspas = false; }
      } else campo += c;
      continue;
    }

    if (c === '"') { entreAspas = true; }
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      linhas.push(linha); linha = [];
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }

  // As linhas vazias ficam: é o que mantém a numeração alinhada com a folha,
  // para um aviso dizer "linha 47" e ser mesmo a 47 no Sheets.
  while (linhas.length && linhas[linhas.length - 1].every((c) => c.trim() === "")) linhas.pop();
  return linhas;
}

type Mapa = { data: number; descricao: number; valor: number; pessoa: number; pago: number };

/** Encontra a linha de cabeçalho e a posição de cada coluna que nos interessa. */
export function mapearColunas(linhas: Linhas): { cabecalho: number; mapa: Mapa } | null {
  const limite = Math.min(linhas.length, 15);

  for (let i = 0; i < limite; i++) {
    const celulas = linhas[i].map(chave);
    const acha = (aceites: readonly string[]) =>
      celulas.findIndex((c) => c !== "" && aceites.some((a) => c === a || c.startsWith(a)));

    const mapa: Mapa = {
      data: acha(COLUNAS.data),
      descricao: acha(COLUNAS.descricao),
      valor: acha(COLUNAS.valor),
      pessoa: acha(COLUNAS.pessoa),
      pago: acha(COLUNAS.pago),
    };

    // Valor e pessoa são indispensáveis; sem eles não há painel possível.
    if (mapa.valor >= 0 && mapa.pessoa >= 0) return { cabecalho: i, mapa };
  }
  return null;
}

/** Mapa alias → slug, construído uma vez. */
const POR_ALIAS = new Map<string, string>(
  PESSOAS.flatMap((p) => p.aliases.map((a) => [chave(a), p.slug] as const)),
);

/** Encontra a pessoa de uma célula, aceitando "Mãe", "mae - mercado", "p/ mãe"… */
export function pessoaDaCelula(celula: string): string | null {
  const c = chave(celula);
  if (!c) return null;
  if (POR_ALIAS.has(c)) return POR_ALIAS.get(c)!;

  for (const [alias, slug] of POR_ALIAS) {
    if (new RegExp(`(^|[^a-z])${alias}([^a-z]|$)`).test(c)) return slug;
  }
  return null;
}

const PAGO = new Set(VALORES_PAGO.map(chave));

/** Converte as linhas cruas nos lançamentos de cada pessoa. */
export async function extrairLancamentos(linhas: Linhas): Promise<{
  porPessoa: Map<string, Lancamento[]>;
  lidas: number;
  ignoradas: number;
  avisos: string[];
}> {
  const avisos: string[] = [];
  const porPessoa = new Map<string, Lancamento[]>(PESSOAS.map((p) => [p.slug, []]));

  const encontrado = mapearColunas(linhas);
  if (!encontrado) {
    throw new Error(
      "Não encontrei os cabeçalhos na planilha. Preciso de uma coluna de valor e outra que diga de quem é o gasto — " +
      "acrescenta o nome real das colunas em lib/config.ts (COLUNAS).",
    );
  }

  const { cabecalho, mapa } = encontrado;
  const corpo = linhas.slice(cabecalho + 1);
  let lidas = 0;
  let ignoradas = 0;

  for (let i = 0; i < corpo.length; i++) {
    const linha = corpo[i];
    const numeroNaFolha = cabecalho + 2 + i;

    if (!linha || linha.every((c) => String(c ?? "").trim() === "")) continue;

    const slug = mapa.pessoa >= 0 ? pessoaDaCelula(linha[mapa.pessoa] ?? "") : null;
    if (!slug) { ignoradas++; continue; }

    const valor = lerValor(linha[mapa.valor]);
    if (valor === null || valor === 0) {
      ignoradas++;
      avisos.push(`Linha ${numeroNaFolha}: valor ilegível ("${linha[mapa.valor] ?? ""}") — ignorada.`);
      continue;
    }

    const data = mapa.data >= 0 ? lerData(linha[mapa.data]) : null;
    if (mapa.data >= 0 && !data) {
      avisos.push(`Linha ${numeroNaFolha}: data ilegível ("${linha[mapa.data] ?? ""}") — lançamento entra sem data.`);
    }

    const descricao =
      (mapa.descricao >= 0 ? String(linha[mapa.descricao] ?? "").trim() : "") || "Sem descrição";

    const pago = mapa.pago >= 0 ? PAGO.has(chave(linha[mapa.pago])) : false;
    const dataFinal = data ?? "1970-01-01";

    porPessoa.get(slug)!.push({
      id: await idDaLinha(slug, dataFinal, descricao, valor, i),
      data: dataFinal,
      descricao,
      valor,
      pago,
    });
    lidas++;
  }

  // Avisos a mais só fazem ruído no log do cron.
  if (avisos.length > 20) avisos.splice(20, avisos.length, `…e mais ${avisos.length - 20} avisos.`);

  return { porPessoa, lidas, ignoradas, avisos };
}
