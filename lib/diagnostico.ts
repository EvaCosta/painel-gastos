import { ABAS, DIA_VENCIMENTO, abaDaFaturaVigente, variavel } from "./config";

/** Um ID de planilha do Google tem sempre este comprimento. */
const TAMANHO_DO_ID = 44;

export type Linha = { rotulo: string; valor: string; ok: boolean | null };

/**
 * O que a app está mesmo a usar, para se ver de relance sem ir às definições
 * da Vercel. Nada aqui é segredo: o ID está no endereço da planilha e o email
 * da conta de serviço está na lista de partilhas dela.
 */
export function diagnosticoDaConfiguracao(): Linha[] {
  const id = variavel("PLANILHA_ID") ?? "";
  const email =
    variavel("GOOGLE_SERVICE_ACCOUNT_EMAIL") ?? variavel("FIREBASE_CLIENT_EMAIL") ?? "";
  const temChave = Boolean(variavel("GOOGLE_PRIVATE_KEY") ?? variavel("FIREBASE_PRIVATE_KEY"));

  return [
    {
      rotulo: "PLANILHA_ID",
      valor: id ? `${id} (${id.length} caracteres)` : "não definido",
      ok: id.length === TAMANHO_DO_ID,
    },
    {
      rotulo: "Conta que lê a planilha",
      valor: email || "não definida",
      ok: email.endsWith(".iam.gserviceaccount.com"),
    },
    { rotulo: "Chave privada", valor: temChave ? "definida" : "em falta", ok: temChave },
    { rotulo: "Abas a ler", valor: ABAS.join(", "), ok: null },
    {
      rotulo: "Fatura vigente",
      valor: `${abaDaFaturaVigente()} (vencimento a ${DIA_VENCIMENTO})`,
      ok: null,
    },
  ];
}
