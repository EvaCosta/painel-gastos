/** Um lançamento do bloco de uma pessoa. */
export type Lancamento = {
  /** Hash estável da linha — é o id no Firestore, para o sync ser idempotente. */
  id: string;
  /** Aba de onde veio, ex. "Setembro". É este o mês do lançamento. */
  mes: string;
  /** Posição da aba na planilha, para ordenar os meses sem adivinhar. */
  ordemMes: number;
  /** Linha de origem na aba, para os itens saírem pela ordem da planilha. */
  linha: number;
  descricao: string;
  /** Em unidades da moeda. Negativo = pagamento que a pessoa já fez. */
  valor: number;
  /**
   * A coluna "Parcelas" tal como está: "02/03", "3 ml", "shopee 2"…
   * Não é uma data, por muito que o Sheets a mostre como tal.
   */
  parcela: string;
  /** A pessoa já acertou esta linha (marcada como paga na planilha). */
  pago: boolean;
  /** Quando acertou, como está escrito na planilha ("15/09"). Vazio se não disser. */
  pagoEm: string;
  /**
   * Vem da fatura de um mês a seguir ao vigente: parcela que ainda vai cair.
   * Não conta para o total em aberto. Ausente nos lançamentos gravados antes
   * de isto existir, que eram todos da fatura vigente.
   */
  proximo?: boolean;
};

export type Mes = {
  nome: string;
  ordem: number;
  /** Ainda por acertar. */
  abertos: Lancamento[];
  /** Já acertados, mostrados à parte para a pessoa poder conferir. */
  pagos: Lancamento[];
  /** Soma dos abertos — é isto que a pessoa deve. */
  total: number;
  /** Soma dos já acertados. */
  totalPago: number;
};

export type Painel = {
  slug: string;
  nome: string;
  saudacao: string;
  meses: Mes[];
  total: number;
  totalPago: number;
  /** Faturas dos meses seguintes, da mais próxima para a mais distante. */
  proximos: Mes[];
  /** O que já está lançado nesses meses e ainda não foi acertado. */
  totalProximos: number;
  atualizadoEm: string | null;
};

export type ResultadoSync = {
  lidas: number;
  ignoradas: number;
  porPessoa: Record<string, { escritos: number; removidos: number }>;
  avisos: string[];
};
