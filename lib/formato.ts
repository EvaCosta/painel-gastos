import { MOEDA } from "./config";

const dinheiro = new Intl.NumberFormat(MOEDA.locale, {
  style: "currency",
  currency: MOEDA.currency,
});
const diaLongo = new Intl.DateTimeFormat(MOEDA.locale, {
  day: "numeric", month: "long", timeZone: "UTC",
});
const mesLongo = new Intl.DateTimeFormat(MOEDA.locale, {
  month: "long", year: "numeric", timeZone: "UTC",
});
const diaCurto = new Intl.DateTimeFormat(MOEDA.locale, {
  day: "2-digit", month: "short", timeZone: "UTC",
});
const momento = new Intl.DateTimeFormat(MOEDA.locale, {
  day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const emDia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const fmtDinheiro = (n: number) => dinheiro.format(n);
export const fmtDia = (iso: string) => maiuscula(diaLongo.format(emDia(iso)));
export const fmtMes = (iso: string) => maiuscula(mesLongo.format(emDia(iso)));
export const fmtDiaCurto = (iso: string) => maiuscula(diaCurto.format(emDia(iso)).replace(".", ""));
export const fmtMomento = (iso: string) => momento.format(new Date(iso));
