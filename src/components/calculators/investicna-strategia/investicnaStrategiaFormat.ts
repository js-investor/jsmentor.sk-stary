/**
 * Investičná stratégia – formátovanie čísel a dátumov po slovensky.
 */

import { addMonths, ymdOf } from "./investicnaStrategiaModel";

export const NBSP = " ";
export const MINUS = "−";

export const MONTHS = ["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];
export const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "máj", "jún", "júl", "aug", "sep", "okt", "nov", "dec"];
export const MONTHS_GEN = ["januára", "februára", "marca", "apríla", "mája", "júna", "júla", "augusta", "septembra", "októbra", "novembra", "decembra"];

const sk = (n: number, min: number, max: number): string =>
  (Number.isFinite(n) ? n : 0).toLocaleString("sk-SK", { minimumFractionDigits: min, maximumFractionDigits: max }).replace("-", MINUS);

export const num = (n: number, digits = 0): string => sk(n, 0, digits);

export const money = (n: number, currency: string): string => `${sk(Math.round(Number.isFinite(n) ? n : 0), 0, 0)}${NBSP}${currency}`;

/** podiel 0,0734 → „7,34 %“; nula nikdy nemá znamienko */
export const pct = (x: number, digits = 1): string => {
  const v = (Number.isFinite(x) ? x : 0) * 100;
  const zero = Math.abs(v) < 0.5 / Math.pow(10, digits);
  return `${sk(zero ? 0 : v, digits, digits)}${NBSP}%`;
};

export const signedPct = (x: number, digits = 1): string => {
  const text = pct(x, digits);
  return x > 0 && !/^0(,0+)?\s/.test(text) ? `+${text}` : text;
};

/** krátky zápis sumy na os grafu */
export const compact = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1e6) return `${sk(v / 1e6, 0, a >= 1e7 ? 0 : 1)}${NBSP}mil.`;
  if (a >= 1000) return `${sk(v / 1000, 0, a >= 10000 ? 0 : 1)}${NBSP}tis.`;
  return sk(v, 0, 0);
};

export const rokov = (n: number): string => (n === 1 ? "rok" : n >= 2 && n <= 4 ? "roky" : "rokov");
export const mesiacov = (n: number): string => (n === 1 ? "mesiac" : n >= 2 && n <= 4 ? "mesiace" : "mesiacov");
export const dni = (n: number): string => (n === 1 ? "deň" : n >= 2 && n <= 4 ? "dni" : "dní");
export const vkladov = (n: number): string => (n === 1 ? "vklad" : n >= 2 && n <= 4 ? "vklady" : "vkladov");

/** „4. 1. 1999“ */
export const dateShort = (day: number): string => {
  const { y, m, d } = ymdOf(day);
  return `${d}.${NBSP}${m}.${NBSP}${y}`;
};

/** „4. januára 1999“ */
export const dateLong = (day: number): string => {
  const { y, m, d } = ymdOf(day);
  return `${d}.${NBSP}${MONTHS_GEN[m - 1]} ${y}`;
};

/** „január 1999“ */
export const monthYear = (day: number): string => {
  const { y, m } = ymdOf(day);
  return `${MONTHS[m - 1]} ${y}`;
};

/** čas medzi dvoma dňami slovom: „27 rokov a 8 mesiacov“, „5 mesiacov“, „23 dní“ */
export const span = (from: number, to: number): string => {
  let months = 0;
  while (addMonths(from, months + 1) <= to) months++;
  if (months === 0) {
    const d = Math.max(0, to - from);
    return `${d} ${dni(d)}`;
  }
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y > 0 ? `${y} ${rokov(y)}` : "", m > 0 ? `${m} ${mesiacov(m)}` : ""].filter(Boolean).join(" a ");
};

/** to isté nakrátko do úzkych miest: „27 r. 7 mes.“ */
export const spanShort = (from: number, to: number): string => {
  let months = 0;
  while (addMonths(from, months + 1) <= to) months++;
  if (months === 0) {
    const d = Math.max(0, to - from);
    return `${d}${NBSP}${dni(d)}`;
  }
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y > 0 ? `${y}${NBSP}r.` : "", m > 0 ? `${m}${NBSP}mes.` : ""].filter(Boolean).join(" ");
};

/** pomer zložiek „60 / 20 / 20“ */
export const mix = (w: readonly number[]): string => w.map((x) => Math.round(x)).join(`${NBSP}/${NBSP}`);
