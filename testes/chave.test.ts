import assert from "node:assert/strict";
import { test } from "node:test";
import { createPrivateKey, generateKeyPairSync } from "node:crypto";
import { lerChavePrivada, normalizarChavePrivada } from "../lib/chave";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;

/** As formas em que a mesma chave chega, conforme por onde passou. */
const formas: Array<[string, string]> = [
  ["já com quebras de linha", pem],
  ["com \\n literais, como no JSON", pem.replace(/\n/g, "\\n")],
  ["com \\n duplamente escapados", pem.replace(/\n/g, "\\\\n")],
  ["com as aspas do JSON à volta", `"${pem.replace(/\n/g, "\\n")}"`],
  ["com CRLF do Windows", pem.replace(/\n/g, "\r\n")],
  ["com espaço à frente e atrás", `  \n${pem}\n  `],
  ["achatada numa linha só, com espaços", pem.replace(/\n/g, " ")],
  ["achatada sem separador nenhum", pem.replace(/\n/g, "")],
  ["com tabs pelo meio", pem.replace(/\n/g, "\n\t  ")],
];

for (const [nome, bruta] of formas) {
  test(`aceita uma chave ${nome}`, () => {
    const normalizada = normalizarChavePrivada(bruta);
    // O teste real: o OpenSSL aceita-a.
    assert.doesNotThrow(() => createPrivateKey(normalizada));
    assert.equal(
      createPrivateKey(normalizada).export({ type: "pkcs8", format: "pem" }),
      pem,
      "devia dar exactamente a mesma chave",
    );
  });
}

test("explica o que fazer quando a variável não está definida", () => {
  assert.throws(() => lerChavePrivada(undefined, "FIREBASE_PRIVATE_KEY"),
    /FIREBASE_PRIVATE_KEY não está definida/);
});

test("explica o que fazer quando não é uma chave", () => {
  assert.throws(() => lerChavePrivada("uma coisa qualquer", "GOOGLE_PRIVATE_KEY"),
    /não parece uma chave privada.*sem as aspas de fora/s);
});

test("explica o que fazer quando a chave está truncada", () => {
  const truncada = pem.split("\n").slice(0, 4).join("\n") + "\n-----END PRIVATE KEY-----\n";
  assert.throws(() => lerChavePrivada(truncada, "FIREBASE_PRIVATE_KEY"),
    /não descodifica.*cópia incompleta/s);
});
