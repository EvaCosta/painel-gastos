import assert from "node:assert/strict";
import { test } from "node:test";
import { abaDaFaturaVigente } from "../lib/config";

/** Um instante em São Paulo (UTC-3), para o fuso não mexer no resultado. */
const em = (iso: string) => new Date(`${iso}T12:00:00-03:00`);

test("antes do vencimento, conta a fatura deste mês", () => {
  assert.equal(abaDaFaturaVigente(em("2026-09-01")), "Setembro");
  assert.equal(abaDaFaturaVigente(em("2026-09-14")), "Setembro");
});

test("no próprio dia do vencimento ainda conta a deste mês", () => {
  assert.equal(abaDaFaturaVigente(em("2026-09-15")), "Setembro");
});

test("passado o vencimento, passa à do mês seguinte", () => {
  assert.equal(abaDaFaturaVigente(em("2026-09-16")), "Outubro");
  // o caso que motivou isto: hoje, dia 23
  assert.equal(abaDaFaturaVigente(em("2026-09-23")), "Outubro");
  assert.equal(abaDaFaturaVigente(em("2026-09-30")), "Outubro");
});

test("vira o ano sem se perder", () => {
  assert.equal(abaDaFaturaVigente(em("2026-12-14")), "Dezembro");
  assert.equal(abaDaFaturaVigente(em("2026-12-20")), "Janeiro");
});

test("usa o fuso de São Paulo, não UTC", () => {
  // 23h59 de dia 15 em São Paulo é já dia 16 em UTC: manda o fuso local,
  // senão a aba virava um dia mais cedo para quem usa isto.
  assert.equal(abaDaFaturaVigente(new Date("2026-09-15T23:59:00-03:00")), "Setembro");
});

test("cobre os doze meses", () => {
  const esperado = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    assert.equal(abaDaFaturaVigente(em(`2026-${mm}-10`)), esperado[m - 1]);
  }
});
