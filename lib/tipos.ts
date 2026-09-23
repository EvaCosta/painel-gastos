/** Um lançamento da planilha, já normalizado. */
export type Lancamento = {
  /** Hash estável da linha — é o id no Firestore, para o sync ser idempotente. */
  id: string;
  /** ISO `YYYY-MM-DD`. */
  data: string;
  descricao: string;
  /** Em unidades da moeda (ex.: 186.4), nunca em cêntimos. */
  valor: number;
  pago: boolean;
};

export type Painel = {
  slug: string;
  nome: string;
  saudacao: string;
  lancamentos: Lancamento[];
  totalAberto: number;
  totalPago: number;
  atualizadoEm: string | null;
};

export type ResultadoSync = {
  lidas: number;
  ignoradas: number;
  porPessoa: Record<string, { escritos: number; removidos: number }>;
  avisos: string[];
};
