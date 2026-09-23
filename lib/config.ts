/**
 * Configuração do painel — é aqui que se mexe quando a planilha muda.
 *
 * Nada neste ficheiro é secreto: os tokens de acesso vivem no Firestore,
 * e as credenciais em variáveis de ambiente.
 */

/** As pessoas que têm painel. O `slug` é o id no Firestore e nunca muda. */
export const PESSOAS = [
  { slug: "mae", nome: "Mãe", saudacao: "Oi, mãe", aliases: ["mae", "mãe", "mamae", "mamãe"] },
  { slug: "ulisses", nome: "Ulisses", saudacao: "Oi, Ulisses", aliases: ["ulisses"] },
  { slug: "fernando", nome: "Fernando", saudacao: "Oi, Fernando", aliases: ["fernando", "nando"] },
  { slug: "heloisa", nome: "Heloísa", saudacao: "Oi, Heloísa", aliases: ["heloisa", "heloísa", "helo"] },
] as const;

export type Slug = (typeof PESSOAS)[number]["slug"];

/**
 * Cabeçalhos aceites para cada coluna da planilha, em minúsculas e sem acentos.
 * O leitor procura a primeira coluna cujo cabeçalho bata com um destes.
 * Se a planilha usar outro nome, acrescenta-o aqui — não é preciso mexer no resto.
 */
export const COLUNAS = {
  data: ["data", "dia", "data da compra", "data do gasto", "quando"],
  descricao: ["descricao", "descrição", "item", "gasto", "o que", "historico", "histórico", "detalhe"],
  valor: ["valor", "preco", "preço", "quantia", "total", "custo"],
  pessoa: ["pessoa", "quem", "de quem", "para quem", "responsavel", "responsável", "categoria", "marcado", "tag"],
  pago: ["pago", "status", "situacao", "situação", "estado", "acertado", "quitado"],
} as const;

/** Valores da coluna `pago` que contam como já acertado. */
export const VALORES_PAGO = [
  "pago", "paga", "pagos", "pagas", "sim", "s", "x", "ok", "true", "quitado",
  "acertado", "recebido", "1", "v", "✓", "✔",
];

/** Moeda em que os valores são mostrados. */
export const MOEDA = { locale: "pt-BR", currency: "BRL" } as const;

/** Nome da aba da planilha a ler. Vazio = a primeira aba. */
export const ABA = process.env.PLANILHA_ABA ?? "";
