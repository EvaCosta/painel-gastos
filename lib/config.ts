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
 * Fuso em que se decide qual é o mês vigente — a virada do mês tem de
 * acontecer à meia-noite de quem usa isto, não em UTC.
 */
export const FUSO = process.env.FUSO ?? "America/Sao_Paulo";

/** Dia em que a fatura vence. */
export const DIA_VENCIMENTO = Number(process.env.DIA_VENCIMENTO ?? 15);

/**
 * A aba da próxima fatura a vencer, que é a que interessa a quem deve.
 *
 * As abas da planilha são faturas, não meses de calendário: a aba "Outubro" é
 * a fatura que vence a 15 de Outubro. Enquanto a deste mês ainda não venceu, é
 * essa que conta; passado o dia 15, passa a ser a do mês seguinte — foi por
 * isso que a 23 de Setembro o que interessa é Outubro.
 *
 * Devolve o mês por extenso com inicial maiúscula, sem sufixo de ano
 * ("Outubro"), que é a convenção das abas do ano corrente. As de anos
 * anteriores levam sufixo ("Outubro25") e ficam de fora, como se quer.
 */
export function abaDaFaturaVigente(quando = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(quando);
  const parte = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);

  const dia = parte("day");
  // Passado o vencimento, a fatura deste mês está fechada: conta a seguinte.
  const avanco = dia > DIA_VENCIMENTO ? 1 : 0;
  const referencia = new Date(Date.UTC(parte("year"), parte("month") - 1 + avanco, 1));

  const mes = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" })
    .format(referencia);
  return mes.charAt(0).toUpperCase() + mes.slice(1);
}

/**
 * Abas a ler. Por omissão, só a da próxima fatura a vencer — é o que os
 * painéis mostram, e vira sozinha todos os meses sem se mexer em nada.
 *
 * `PLANILHA_ABAS` força uma lista fixa, para ver meses anteriores ou vários
 * de uma vez: `PLANILHA_ABAS=Setembro,Outubro`.
 */
export const ABAS = process.env.PLANILHA_ABAS
  ? process.env.PLANILHA_ABAS.split(",").map((s) => s.trim()).filter(Boolean)
  : [abaDaFaturaVigente()];

/** Cabeçalhos da secção de pessoas, em minúsculas e sem acentos. */
export const COLUNAS = {
  categoria: ["categoria"],
  parcelas: ["parcelas"],
  descricao: ["compra"],
  valor: ["valor"],
  situacao: ["situacao", "situação"],
  cartao: ["cartao", "cartão"],
  nome: ["nome"],
  total: ["total"],
} as const;



/** Moeda em que os valores são mostrados. */
export const MOEDA = { locale: "pt-BR", currency: "BRL" } as const;
