import assert from "node:assert/strict";
import { test } from "node:test";
import { lerData, lerValor } from "../lib/normalizar";
import { extrairLancamentos, mapearColunas, parseCsv, pessoaDaCelula } from "../lib/planilha";

test("lê valores em qualquer notação", () => {
  assert.equal(lerValor("R$ 1.234,56"), 1234.56);
  assert.equal(lerValor("1,234.56"), 1234.56);
  assert.equal(lerValor("186,40"), 186.4);
  assert.equal(lerValor("186.40"), 186.4);
  assert.equal(lerValor("€ 45"), 45);
  assert.equal(lerValor("1.500"), 1500);      // milhar pt, sem decimais
  assert.equal(lerValor("(50,00)"), -50);     // parêntesis = negativo
  assert.equal(lerValor("-32,10"), -32.1);
  assert.equal(lerValor(412.75), 412.75);
  assert.equal(lerValor(""), null);
  assert.equal(lerValor("n/a"), null);
  assert.equal(lerValor("1.5"), 1.5);         // um só dígito: decimal
  assert.equal(lerValor("1,5"), 1.5);
  assert.equal(lerValor("12.345"), 12345);    // três dígitos: milhar
  assert.equal(lerValor("12,345"), 12345);
  assert.equal(lerValor("0,99"), 0.99);
});

test("lê datas em qualquer formato", () => {
  assert.equal(lerData("2026-09-19"), "2026-09-19");
  assert.equal(lerData("19/09/2026"), "2026-09-19");
  assert.equal(lerData("19-9-26"), "2026-09-19");
  assert.equal(lerData("19.09.2026"), "2026-09-19");
  assert.equal(lerData("19 de setembro", 2026), "2026-09-19");
  assert.equal(lerData("5 de mar de 2026"), "2026-03-05");
  assert.equal(lerData("12 set 2026"), "2026-09-12");
  assert.equal(lerData("46284"), "2026-09-19");   // série do Sheets
  assert.equal(lerData("31/02/2026"), null);      // data que não existe
  assert.equal(lerData(""), null);
});

test("reconhece a pessoa mesmo com ruído à volta", () => {
  assert.equal(pessoaDaCelula("Mãe"), "mae");
  assert.equal(pessoaDaCelula("mae"), "mae");
  assert.equal(pessoaDaCelula("MAMÃE"), "mae");
  assert.equal(pessoaDaCelula("p/ mãe - mercado"), "mae");
  assert.equal(pessoaDaCelula("Ulisses"), "ulisses");
  assert.equal(pessoaDaCelula("heloisa"), "heloisa");
  assert.equal(pessoaDaCelula("Heloísa"), "heloisa");
  assert.equal(pessoaDaCelula("Nando"), "fernando");
  assert.equal(pessoaDaCelula("eu"), null);
  assert.equal(pessoaDaCelula(""), null);
  // não deve apanhar um nome dentro de outra palavra
  assert.equal(pessoaDaCelula("maezinha"), null);
});

test("encontra o cabeçalho mesmo com linhas de título por cima", () => {
  const linhas = parseCsv(
    "CONTROLE DE GASTOS 2026,,,,\n" +
    ",,,,\n" +
    "Data,Descrição,Valor,Quem,Status\n" +
    "19/09/2026,Farmácia,\"R$ 186,40\",Mãe,Devendo\n",
  );
  const achado = mapearColunas(linhas);
  assert.ok(achado);
  assert.equal(achado.cabecalho, 2);   // a linha em branco conta, para a numeração bater certo
  assert.deepEqual(achado.mapa, { data: 0, descricao: 1, valor: 2, pessoa: 3, pago: 4 });
});

test("separa os lançamentos por pessoa e ignora o resto", async () => {
  const linhas = parseCsv(
    "Data,Descrição,Valor,Quem,Status\n" +
    "19/09/2026,Farmácia,\"186,40\",Mãe,Devendo\n" +
    "12/09/2026,Mercado,\"412,75\",Mãe,Pago\n" +
    "10/09/2026,Gasolina,\"200,00\",Ulisses,\n" +
    "08/09/2026,Jantar fora,\"90,00\",eu,\n" +          // não é de ninguém com painel
    "05/09/2026,Linha sem valor,,Heloísa,\n",           // valor ilegível
  );

  const { porPessoa, lidas, ignoradas, avisos } = await extrairLancamentos(linhas);

  assert.equal(lidas, 3);
  assert.equal(ignoradas, 2);
  assert.equal(avisos.length, 1);

  const mae = porPessoa.get("mae")!;
  assert.equal(mae.length, 2);
  assert.equal(mae.filter((l) => !l.pago).reduce((s, l) => s + l.valor, 0), 186.4);
  assert.equal(mae.filter((l) => l.pago).reduce((s, l) => s + l.valor, 0), 412.75);

  assert.equal(porPessoa.get("ulisses")!.length, 1);
  assert.equal(porPessoa.get("ulisses")![0].pago, false);
  assert.equal(porPessoa.get("heloisa")!.length, 0);
  assert.equal(porPessoa.get("fernando")!.length, 0);
});

test("o id de cada linha é estável entre leituras", async () => {
  const csv =
    "Data,Descrição,Valor,Quem\n" +
    "19/09/2026,Farmácia,\"186,40\",Mãe\n";
  const a = await extrairLancamentos(parseCsv(csv));
  const b = await extrairLancamentos(parseCsv(csv));
  assert.equal(a.porPessoa.get("mae")![0].id, b.porPessoa.get("mae")![0].id);
});

test("linhas em branco não desalinham a numeração dos avisos", async () => {
  const linhas = parseCsv(
    "Data,Descrição,Valor,Quem\n" +
    "19/09/2026,Farmácia,\"186,40\",Mãe\n" +
    ",,,\n" +
    "10/09/2026,Gasolina,xxx,Ulisses\n",
  );
  const { avisos, lidas } = await extrairLancamentos(linhas);
  assert.equal(lidas, 1);
  assert.equal(avisos.length, 1);
  // a gasolina está mesmo na linha 4 da folha
  assert.match(avisos[0], /^Linha 4:/);
});

test("o CSV aguenta vírgulas e aspas dentro dos campos", () => {
  const linhas = parseCsv('Data,Descrição,Valor\n01/01/2026,"Mercado, feira e padaria","1.234,56"\n');
  assert.deepEqual(linhas[1], ["01/01/2026", "Mercado, feira e padaria", "1.234,56"]);
});
