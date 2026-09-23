import assert from "node:assert/strict";
import { test } from "node:test";
import { lerValor } from "../lib/normalizar";
import { encontrarBlocos, extrairLancamentos, mapearColunas, type Aba } from "../lib/planilha";

/** Monta uma aba de teste a partir de linhas `[texto, cor?]`. */
function aba(
  nome: string,
  linhas: Array<Array<string | [string, string]>>,
  fusoes: Aba["fusoes"] = [],
): Aba {
  return {
    nome,
    fusoes,
    celulas: linhas.map((linha) =>
      linha.map((c) =>
        typeof c === "string" ? { texto: c, cor: "" } : { texto: c[0], cor: c[1] },
      ),
    ),
  };
}

/** Cabeçalho tal como está na planilha: A..K, com "Nome" na coluna K (índice 10). */
const CABECALHO = ["", "", "", "Categoria", "Parcelas", "Compra", "Valor", "Situação", "Cartao", "", "Nome", "Total"];
const vazio = ["", "", "", "", "", "", "", "", "", "", "", ""];
const item = (parcela: string, compra: string, valor: string, situacao = "", cartao = "", nome = "", total = "") =>
  ["", "", "", "pg", parcela, compra, valor, situacao, cartao, "", nome, total];

test("lê valores em qualquer notação", () => {
  assert.equal(lerValor("R$ 1.234,56"), 1234.56);
  assert.equal(lerValor("1,234.56"), 1234.56);
  assert.equal(lerValor("R$ 61,18"), 61.18);
  assert.equal(lerValor("186.40"), 186.4);
  assert.equal(lerValor("1.500"), 1500);      // três dígitos: milhar
  assert.equal(lerValor("1.5"), 1.5);         // um dígito: decimal
  assert.equal(lerValor("-R$ 200,00"), -200); // pagamento já feito
  assert.equal(lerValor("(50,00)"), -50);
  assert.equal(lerValor(20.51666667), 20.51666667);
  assert.equal(lerValor(""), null);
});

test("o mês vem da aba, não da coluna Parcelas", async () => {
  // "02/03" é parcela 2 de 3 — o Sheets mostra-a como 2 de Março, mas o mês
  // do lançamento é a aba onde ele está.
  const set = aba("Setembro", [CABECALHO, item("02/03", "Pote bolo", "20,52", "", "", "Mae")],
    [{ linhaIni: 1, linhaFim: 2, colIni: 10, colFim: 11 }]);
  const nov = aba("Novembro", [CABECALHO, item("3 ml", "Geleia", "16,97", "", "", "Mae")],
    [{ linhaIni: 1, linhaFim: 2, colIni: 10, colFim: 11 }]);

  const { porPessoa } = await extrairLancamentos([set, nov]);
  const mae = porPessoa.get("mae")!;

  assert.deepEqual(mae.map((l) => l.mes), ["Setembro", "Novembro"]);
  assert.deepEqual(mae.map((l) => l.ordemMes), [0, 1]);
  assert.deepEqual(mae.map((l) => l.parcela), ["02/03", "3 ml"]);
});

test("encontra o cabeçalho da secção de pessoas", () => {
  const a = aba("Setembro", [vazio, ["CONTROLE"], vazio, CABECALHO, item("", "Coberta", "63,91")]);
  const mapa = mapearColunas(a);
  assert.ok(mapa);
  assert.equal(mapa.cabecalho, 3);
  assert.equal(mapa.nome, 10);
  assert.equal(mapa.descricao, 5);
  assert.equal(mapa.valor, 6);
  assert.equal(mapa.situacao, 7);
});

test("cada bloco é a célula fundida na coluna Nome", () => {
  const linhas = [CABECALHO];
  linhas.push(item("", "Coberta", "63,91", "", "Nubank", "Fernando"));
  linhas.push(item("", "hormonios", "200,69"));
  linhas.push(item("", "Geleia", "16,97", "", "", "Mercado"));   // ignorado
  linhas.push(item("", "vaso", "40,97", "", "", "Mae"));
  linhas.push(item("", "Dr peanut", "44,90", "", "", "Ulisses"));

  const a = aba("Setembro", linhas, [
    { linhaIni: 1, linhaFim: 3, colIni: 10, colFim: 11 },
    { linhaIni: 3, linhaFim: 4, colIni: 10, colFim: 11 },
    { linhaIni: 4, linhaFim: 5, colIni: 10, colFim: 11 },
    { linhaIni: 5, linhaFim: 6, colIni: 10, colFim: 11 },
  ]);
  const blocos = encontrarBlocos(a, mapearColunas(a)!);

  assert.deepEqual(blocos.map((b) => [b.slug, b.linhaIni, b.linhaFim]), [
    ["fernando", 1, 3], ["mae", 4, 5], ["ulisses", 5, 6],
  ]);
});

test("avisa quando o total da planilha não bate com as linhas", async () => {
  // Novembro, bloco da Mãe: a folha mostra 20,52 porque só a primeira linha
  // está guardada como número; as outras são texto e a fórmula ignora-as.
  const linhas = [CABECALHO];
  linhas.push(item("02/03", "Pote bolo", "20,51666667", "", "C6 Bank", "Mae", "20,51666667"));
  linhas.push(item("02/05", "Mato parede", "R$ 61,18"));
  linhas.push(item("02/02", "vela verde", "R$ 22,80"));

  const a = aba("Novembro", linhas, [{ linhaIni: 1, linhaFim: 4, colIni: 10, colFim: 11 }]);
  const { porPessoa, avisos } = await extrairLancamentos([a]);

  const saldo = porPessoa.get("mae")!.reduce((s, l) => s + l.valor, 0);
  assert.equal(Number(saldo.toFixed(2)), 104.50);     // o que as linhas somam mesmo
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /planilha mostra 20\.52 mas as linhas somam 104\.50/);
  assert.match(avisos[0], /escritos como texto/);
});

test("a célula fundida sozinha não define o bloco", () => {
  // Reproduz K136:K160 = "Mae" na aba Novembro.
  const linhas = [CABECALHO];
  linhas.push(item("02/03", "Pote bolo", "R$ 20,52", "", "C6 Bank", "Mae"));
  linhas.push(item("02/05", "Mato parede", "R$ 61,18"));
  linhas.push(item("02/02", "vela verde", "R$ 22,80"));
  linhas.push(item("02/02", "vela branca metado do pacote", "R$ 44,25"));
  linhas.push(item("02/02", "vela rosa metade do pacote", "R$ 9,48"));
  linhas.push(item("02/02", "2 silicone", "R$ 13,00"));

  const a = aba("Novembro", linhas, [
    { linhaIni: 1, linhaFim: 7, colIni: 10, colFim: 11 },
  ]);
  const mapa = mapearColunas(a)!;
  const blocos = encontrarBlocos(a, mapa);

  assert.equal(blocos.length, 1);
  assert.equal(blocos[0].slug, "mae");
  assert.equal(blocos[0].linhaIni, 1);
  assert.equal(blocos[0].linhaFim, 7);   // último bloco: fecha quando a folha esvazia
});

test("o saldo do bloco da mãe bate com a planilha", async () => {
  const linhas = [CABECALHO];
  for (const [p, c, v] of [
    ["02/03", "Pote bolo", "R$ 20,52"], ["02/05", "Mato parede", "R$ 61,18"],
    ["02/02", "vela verde", "R$ 22,80"], ["02/02", "vela branca metado do pacote", "R$ 44,25"],
    ["02/02", "vela rosa metade do pacote", "R$ 9,48"], ["02/02", "2 silicone", "R$ 13,00"],
  ]) linhas.push(item(p, c, v, "", "", linhas.length === 1 ? "Mae" : ""));

  const a = aba("Novembro", linhas, [{ linhaIni: 1, linhaFim: 7, colIni: 10, colFim: 11 }]);
  const { porPessoa, lidas } = await extrairLancamentos([a]);

  assert.equal(lidas, 6);
  const saldo = porPessoa.get("mae")!.reduce((s, l) => s + l.valor, 0);
  assert.equal(Number(saldo.toFixed(2)), 171.23);
});

test("uma linha negativa abate o saldo — 'que ela ja pagou'", async () => {
  const linhas = [CABECALHO];
  linhas.push(item("", "Calça vo", "R$ 84,99", "", "", "Vó"));
  linhas.push(item("", "Doce vó", "R$ 11,99"));
  linhas.push(item("", "que ela ja pagou", "-200,00"));

  const a = aba("Setembro", linhas, [{ linhaIni: 1, linhaFim: 4, colIni: 10, colFim: 11 }]);
  const { porPessoa } = await extrairLancamentos([a]);

  const saldo = porPessoa.get("vo")!.reduce((s, l) => s + l.valor, 0);
  assert.equal(Number(saldo.toFixed(2)), -103.02);
});

test("'Mercado' e 'VIAGEM JF' não são pessoas — o cartão da mãe fica de fora", async () => {
  const linhas = [CABECALHO];
  linhas.push(item("", "Geleia abacaxi", "R$ 16,97", "", "", "Mercado"));
  linhas.push(item("", "Leite em pó", "R$ 25,89"));
  linhas.push(item("", "blablacar ida", "R$ 70,00", "", "", "VIAGEM JF"));

  const a = aba("Setembro", linhas, [
    { linhaIni: 1, linhaFim: 3, colIni: 10, colFim: 11 },
    { linhaIni: 3, linhaFim: 4, colIni: 10, colFim: 11 },
  ]);
  const { porPessoa, lidas } = await extrairLancamentos([a]);

  assert.equal(lidas, 0);
  for (const p of ["mae", "ulisses", "fernando", "heloisa", "vo"]) {
    assert.equal(porPessoa.get(p)!.length, 0, `${p} não devia ter lançamentos`);
  }
});

test("cada pessoa só vê o seu bloco", async () => {
  const linhas = [CABECALHO];
  linhas.push(item("", "Coberta", "63,91", "", "Nubank", "Fernando"));
  linhas.push(item("", "Dr peanut", "44,90", "", "", "Ulisses"));
  linhas.push(item("", "vaso", "55,49", "", "", "Heloiza"));

  const a = aba("Setembro", linhas, [
    { linhaIni: 1, linhaFim: 2, colIni: 10, colFim: 11 },
    { linhaIni: 2, linhaFim: 3, colIni: 10, colFim: 11 },
    { linhaIni: 3, linhaFim: 4, colIni: 10, colFim: 11 },
  ]);
  const { porPessoa } = await extrairLancamentos([a]);

  assert.deepEqual(porPessoa.get("fernando")!.map((l) => l.descricao), ["Coberta"]);
  assert.deepEqual(porPessoa.get("ulisses")!.map((l) => l.descricao), ["Dr peanut"]);
  assert.deepEqual(porPessoa.get("heloisa")!.map((l) => l.descricao), ["vaso"]);
  assert.deepEqual(porPessoa.get("mae")!.map((l) => l.descricao), []);
});

test("os ids são estáveis entre leituras", async () => {
  const linhas = [CABECALHO, item("02/03", "Pote bolo", "R$ 20,52", "", "", "Mae")];
  const fus = [{ linhaIni: 1, linhaFim: 2, colIni: 10, colFim: 11 }];
  const um = await extrairLancamentos([aba("Novembro", linhas, fus)]);
  const dois = await extrairLancamentos([aba("Novembro", linhas, fus)]);
  assert.equal(um.porPessoa.get("mae")![0].id, dois.porPessoa.get("mae")![0].id);
});
