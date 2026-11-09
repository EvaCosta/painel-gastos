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
  // O bloco na planilha diz "Fernando"; o painel dele trata-o por outro nome.
  { slug: "fernando", nome: "Amor", saudacao: "Oi, amor", rotulos: ["fernando"] },
  { slug: "heloisa",  nome: "Heloiza",  saudacao: "Oi, Heloiza",  rotulos: ["heloiza", "heloisa"] },
  { slug: "vo",       nome: "Vó",       saudacao: "Oi, vó",       rotulos: ["vo", "vó"] },
] as const;

export type Slug = (typeof PESSOAS)[number]["slug"];

/**
 * Rótulos que aparecem na coluna "Nome" mas NÃO são pessoas com painel.
 * "Mercado" é o cartão da mãe — usá-lo não quer dizer que ela esteja a dever,
 * por isso fica de fora. "VIAGEM JF" é uma despesa partilhada, tratada à parte.
 */
/**
 * Marcas que dizem que a pessoa já acertou. O lançamento continua a aparecer
 * no painel, riscado, mas deixa de contar para o total.
 *
 * Basta a palavra aparecer no meio do texto: a planilha tem coisas como
 * "Paguei picado 19,90+15,10", que é um acerto com uma nota ao lado.
 */
export const MARCAS_DE_PAGO = [
  "pago", "paga", "pagos", "pagas", "paguei", "pg", "pgto",
  "quitado", "quitei", "acertado", "acertou", "recebido", "recebi",
];

/**
 * Frases que também saldam a linha, procuradas no meio do texto.
 *
 * "dinheiro está comigo" é dinheiro que a pessoa já entregou: a fatura do
 * cartão ainda não foi paga, mas quem devia já não deve.
 */
export const FRASES_DE_PAGO = ["dinheiro esta comigo", "dinheiro comigo"];

export const ROTULOS_IGNORADOS = ["mercado", "viagem jf", "nome", "total", "soma geral"];

/**
 * Lê uma variável de ambiente, tolerando o nome dela colado ao valor.
 *
 * Colar `PLANILHA_ID=167mQ...` no campo do valor de um painel de configuração
 * guarda a linha toda, e o erro que daí vem — um 404 do Google — não aponta
 * para nada. Como nenhum valor legítimo começa pelo nome da própria variável,
 * dá para o tirar sem risco.
 */
export function variavel(nome: string): string | undefined {
  const bruto = process.env[nome];
  if (bruto === undefined) return undefined;

  // O nome só sai se vier seguido de um separador ou de espaço. Sem isso,
  // um valor que por acaso comece pelo nome — "PLANILHA_IDX" — era decepado.
  const semPrefixo = bruto
    .trim()
    .replace(new RegExp(`^${nome}(?:\\s*[=:]\\s*|\\s+)`), "")
    .trim();

  // Aspas à volta, de quem copiou o valor com elas.
  const semAspas =
    (semPrefixo.startsWith('"') && semPrefixo.endsWith('"')) ||
    (semPrefixo.startsWith("'") && semPrefixo.endsWith("'"))
      ? semPrefixo.slice(1, -1)
      : semPrefixo;

  return semAspas || undefined;
}

/**
 * Fuso em que se decide qual é o mês vigente — a virada do mês tem de
 * acontecer à meia-noite de quem usa isto, não em UTC.
 */
export const FUSO = variavel("FUSO") ?? "America/Sao_Paulo";

/** Dia em que a fatura vence. */
export const DIA_VENCIMENTO = Number(variavel("DIA_VENCIMENTO") ?? 15);

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Ano e mês (0–11) da fatura vigente, no fuso de quem usa isto. */
function faturaVigente(quando: Date): { ano: number; mes: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(quando);
  const parte = (tipo: string) => Number(partes.find((p) => p.type === tipo)!.value);

  // Passado o vencimento, a fatura deste mês está fechada: conta a seguinte.
  const avanco = parte("day") > DIA_VENCIMENTO ? 1 : 0;
  const indice = parte("year") * 12 + parte("month") - 1 + avanco;
  return { ano: Math.floor(indice / 12), mes: indice % 12 };
}

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
  return MESES[faturaVigente(quando).mes];
}

/** Quantas faturas depois da vigente se mostram. 0 desliga. */
export const MESES_SEGUINTES = Math.min(
  11,
  Math.max(0, Number(variavel("MESES_SEGUINTES") ?? 11) || 0),
);

/**
 * As faturas a seguir à vigente — as parcelas que ainda vão cair —, cada uma
 * com os nomes que a sua aba pode ter, pela ordem em que se procuram.
 *
 * No mesmo ano da vigente a aba não tem sufixo ("Dezembro"). No ano seguinte
 * aceita-se só com sufixo ("Janeiro27", "Janeiro 27", "Janeiro2027"): sem ele,
 * "Janeiro" é a aba de Janeiro DESTE ano, já passada, e mostrá-la como próxima
 * punha à frente da pessoa dívidas velhas como se fossem novas.
 *
 * Não passa de 11 meses, para nunca chegar ao mesmo mês do ano seguinte.
 */
export function abasDosMesesSeguintes(
  quando = new Date(),
  quantos = MESES_SEGUINTES,
): string[][] {
  const vigente = faturaVigente(quando);
  const resultado: string[][] = [];

  for (let i = 1; i <= Math.min(quantos, 11); i++) {
    const indice = vigente.ano * 12 + vigente.mes + i;
    const ano = Math.floor(indice / 12);
    const nome = MESES[indice % 12];

    if (ano === vigente.ano) {
      resultado.push([nome]);
    } else {
      const aa = String(ano % 100).padStart(2, "0");
      resultado.push([`${nome}${aa}`, `${nome} ${aa}`, `${nome}${ano}`]);
    }
  }
  return resultado;
}

/**
 * Abas a ler. Por omissão, a da próxima fatura a vencer — é o total que os
 * painéis mostram, e vira sozinha todos os meses sem se mexer em nada — e,
 * à parte, as dos meses seguintes que já existam na planilha.
 *
 * `PLANILHA_ABAS` força uma lista fixa, para ver meses anteriores ou vários
 * de uma vez: `PLANILHA_ABAS=Setembro,Outubro`. Com ela não há meses seguintes.
 */
const abasPedidas = variavel("PLANILHA_ABAS");
export const ABAS = abasPedidas
  ? abasPedidas.split(",").map((s) => s.trim()).filter(Boolean)
  : [abaDaFaturaVigente()];

export const ABAS_SEGUINTES: string[][] = abasPedidas ? [] : abasDosMesesSeguintes();

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
