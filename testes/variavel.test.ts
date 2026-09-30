import assert from "node:assert/strict";
import { test } from "node:test";
import { variavel } from "../lib/config";

const ID = "167mQ99Hd5-cXcq-XtPSIF0DKjoU2sl4s7h4JO2SnihM";

function com(valor: string | undefined) {
  if (valor === undefined) delete process.env.TESTE_VAR;
  else process.env.TESTE_VAR = valor;
  return variavel("TESTE_VAR");
}

test("o valor limpo passa tal como está", () => {
  assert.equal(com(ID), ID);
  assert.equal(com(ID)!.length, 44);
});

test("tira o nome da variável colado ao valor", () => {
  // O caso real: colar a linha inteira no campo do valor.
  assert.equal(com(`TESTE_VAR ${ID}`), ID);
  assert.equal(com(`TESTE_VAR=${ID}`), ID);
  assert.equal(com(`TESTE_VAR = ${ID}`), ID);
  assert.equal(com(`TESTE_VAR: ${ID}`), ID);
});

test("tira espaços e aspas à volta", () => {
  assert.equal(com(`  ${ID}  `), ID);
  assert.equal(com(`"${ID}"`), ID);
  assert.equal(com(`'${ID}'`), ID);
  assert.equal(com(`TESTE_VAR="${ID}"`), ID);
});

test("não mexe num valor que só por acaso se parece", () => {
  // Não começa pelo nome da variável, portanto fica inteiro.
  assert.equal(com("TESTE_VARIAVEL_QUALQUER"), "TESTE_VARIAVEL_QUALQUER");
  assert.equal(com("TESTE_VARX"), "TESTE_VARX");
  assert.equal(com("Setembro,Outubro"), "Setembro,Outubro");
  assert.equal(com("a=b"), "a=b");
});

test("um valor vazio conta como não definido", () => {
  assert.equal(com(""), undefined);
  assert.equal(com("   "), undefined);
  assert.equal(com("TESTE_VAR="), undefined);
  assert.equal(com("TESTE_VAR"), "TESTE_VAR", "o nome sozinho é um valor, não um prefixo");
  assert.equal(com(undefined), undefined);
});
