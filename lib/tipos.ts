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
  atualizadoEm: string | null;
};

export type ResultadoSync = {
  lidas: number;
  ignoradas: number;
  porPessoa: Record<string, { escritos: number; removidos: number }>;
  avisos: string[];
};
