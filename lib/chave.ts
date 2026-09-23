import { createPrivateKey } from "node:crypto";

/**
 * Normaliza uma chave privada vinda de uma variável de ambiente.
 *
 * Entre copiar do JSON e colar num painel de configuração, a mesma chave chega
 * em várias formas: com as aspas do JSON à volta, com `\n` literais, com esses
 * `\n` duplamente escapados por quem os passou de mão em mão, com CRLF do
 * Windows, ou já com quebras de linha a sério. Todas descodificam para a mesma
 * chave — só é preciso normalizá-las antes de as entregar ao OpenSSL, que de
 * outro modo falha com "DECODER routines::unsupported", uma mensagem que não
 * diz a ninguém o que fazer.
 */
export function normalizarChavePrivada(bruta: string): string {
  let chave = bruta.trim();

  // Aspas à volta, de quem copiou o campo do JSON inteiro.
  if (
    (chave.startsWith('"') && chave.endsWith('"')) ||
    (chave.startsWith("'") && chave.endsWith("'"))
  ) {
    chave = chave.slice(1, -1);
  }

  chave = chave
    .replace(/\\\\n/g, "\n")   // duplamente escapado
    .replace(/\\n/g, "\n")     // escapado (o caso normal do JSON)
    .replace(/\r/g, "")        // CRLF
    .trim();

  // Se já descodifica, não lhe tocamos mais.
  try {
    createPrivateKey(chave + "\n");
    return chave + "\n";
  } catch {
    // Segue para a reconstrução.
  }

  // Alguns painéis achatam a chave num parágrafo só. O corpo é base64, que não
  // tem espaços nenhuns, por isso dá para o reconstruir: guarda-se o rótulo do
  // cabeçalho, junta-se todo o base64 e volta a partir-se de 64 em 64.
  const delimitado = chave.match(
    /-----BEGIN ([A-Z0-9 ]+?)-----([\s\S]*?)-----END [A-Z0-9 ]+?-----/,
  );
  if (!delimitado) return chave + "\n";

  const [, rotulo, corpo] = delimitado;
  const base64 = corpo.replace(/\s+/g, "");
  const linhas = base64.match(/.{1,64}/g) ?? [];

  return [`-----BEGIN ${rotulo}-----`, ...linhas, `-----END ${rotulo}-----`, ""].join("\n");
}

/**
 * Normaliza e confirma que o OpenSSL a aceita, para o erro aparecer aqui —
 * onde se pode explicar — e não lá dentro do SDK.
 */
export function lerChavePrivada(bruta: string | undefined, nomeDaVariavel: string): string {
  if (!bruta) throw new Error(`${nomeDaVariavel} não está definida.`);

  const chave = normalizarChavePrivada(bruta);

  if (!chave.includes("-----BEGIN") || !chave.includes("-----END")) {
    throw new Error(
      `${nomeDaVariavel} não parece uma chave privada: falta o -----BEGIN PRIVATE KEY-----. ` +
      "O valor é o conteúdo do campo private_key do JSON, sem as aspas de fora.",
    );
  }

  try {
    createPrivateKey(chave);
  } catch (erro) {
    throw new Error(
      `${nomeDaVariavel} tem o formato certo mas não descodifica ` +
      `(${erro instanceof Error ? erro.message : erro}). ` +
      "Costuma ser uma cópia incompleta: confirma que copiaste do -----BEGIN até ao -----END, " +
      "e que não faltam linhas no meio.",
    );
  }

  return chave;
}
