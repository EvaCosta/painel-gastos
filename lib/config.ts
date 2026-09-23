/**
 * Configuração do painel.
 *
 * A planilha "Organização Mensal" tem uma aba por mês. Dentro de cada aba, a
 * secção de pessoas começa num cabeçalho `Categoria | Parcelas | Compra |
 * Valor | Situação | Cartao | … | Nome`, e o bloco de cada pessoa é uma célula
 * FUNDIDA na coluna "Nome" que abrange todas as linhas dessa pessoa.
 */

/** As pessoas que têm painel. O `slug` é o id no Firestore e nunca muda. */
export const PESSOAS = [
  { slug: "mae",      nome: "Mãe",      saudacao: "Oi, mãe",      rotulos: ["mae", "mãe"] },
  { slug: "ulisses",  nome: "Ulisses",  saudacao: "Oi, Ulisses",  rotulos: ["ulisses"] },
  { slug: "fernando", nome: "Fernando", saudacao: "Oi, Fernando", rotulos: ["fernando"] },
  { slug: "heloisa",  nome: "Heloiza",  saudacao: "Oi, Heloiza",  rotulos: ["heloiza", "heloisa"] },
  { slug: "vo",       nome: "Vó",       saudacao: "Oi, vó",       rotulos: ["vo", "vó"] },
] as const;

export type Slug = (typeof PESSOAS)[number]["slug"];

/**
 * Rótulos que aparecem na coluna "Nome" mas NÃO são pessoas com painel.
 * "Mercado" é o cartão da mãe — usá-lo não quer dizer que ela esteja a dever,
 * por isso fica de fora. "VIAGEM JF" é uma despesa partilhada, tratada à parte.
 */
export const ROTULOS_IGNORADOS = ["mercado", "viagem jf", "nome", "total", "soma geral"];

/**
 * Abas a ler. Cada entrada é o nome exacto da aba na planilha.
 * As abas antigas (com sufixo de ano) ficam de fora por decisão do dono.
 */
export const ABAS = (process.env.PLANILHA_ABAS ?? "Setembro,Outubro,Novembro")
  .split(",").map((s) => s.trim()).filter(Boolean);

/** Cabeçalhos da secção de pessoas, em minúsculas e sem acentos. */
export const COLUNAS = {
  categoria: ["categoria"],
  parcelas: ["parcelas"],
  descricao: ["compra"],
  valor: ["valor"],
  situacao: ["situacao", "situação"],
  cartao: ["cartao", "cartão"],
  nome: ["nome"],
} as const;

/**
 * Até onde vai o bloco de uma pessoa.
 *  "fundida" — só as linhas da célula fundida na coluna Nome (conservador).
 *  "cor"     — estende enquanto as linhas mantiverem a cor de fundo do bloco,
 *              mesmo para lá da célula fundida.
 * A planilha tem blocos onde a pintura vai mais longe do que a fusão; qual das
 * duas é a verdade é decisão do dono.
 */
export const LIMITE_DO_BLOCO: "fundida" | "cor" =
  (process.env.LIMITE_DO_BLOCO as "fundida" | "cor") ?? "fundida";

/** Moeda em que os valores são mostrados. */
export const MOEDA = { locale: "pt-BR", currency: "BRL" } as const;
