// game/bn.js
import Decimal from "break_infinity.js";

/**
 * Safe Decimal parse:
 * - number, string ("2,500,000", "4,50E+14", "1e500"), Decimal hepsini alır
 */
export function D(x) {
  if (x instanceof Decimal) return x;
  if (x === null || x === undefined) return new Decimal(0);

  if (typeof x === "number") {
    // JS Infinity vs olursa kırılmasın
    if (!Number.isFinite(x)) return new Decimal(0);
    return new Decimal(x);
  }

  // string normalize
  let s = String(x).trim();
  if (!s) return new Decimal(0);

  // 2,500,000 => 2500000
  s = s.replace(/,/g, "");

  // 4,50E+14 => 4.50E+14  (Avrupa ondalık)
  s = s.replace(/^(\d+),(\d+)(e[+\-]?\d+)$/i, "$1.$2$3");

  // E => e, e+ => e
  s = s.replace(/E/g, "e").replace(/e\+/g, "e");

  // break_infinity parse
  try {
    return new Decimal(s);
  } catch {
    return new Decimal(0);
  }
}

/**
 * Decimal -> display (Clicker Heroes gibi suffix)
 * break_infinity'nin toStringWithDecimalPlaces / toExponential vs var.
 * Biz CH hissi için kısa suffix kullanacağız.
 */
const SUFFIX = [
  "",
  "K",
  "M",
  "B",
  "T",
  "q",
  "Q",
  "s",
  "S",
  "O",
  "N",
  "d",
  "U",
  "D",
  "!",
  "@",
  "#",
  "$",
  "%",
  "^",
  "&",
  "*",
];

export function fmtD(x) {
  const v = D(x);
  if (v.lte(0)) return "0";

  // < 1000
  if (v.lt(1000)) return v.floor().toString();

  // tier = floor(log10(v)/3)
  // break_infinity: v.log10()
  const tier = Math.floor(v.log10() / 3);
  const t = Math.max(0, Math.min(tier, SUFFIX.length - 1));

  // scaled = v / 1000^tier
  const scaled = v.div(Decimal.pow(1000, t));

  // 3 basamak gibi: 123K, 9.87M yerine istersen:
  // scaled.toFixed(0) => ClickerHeroes gibi kaba
  const s = scaled.lt(10)
    ? scaled.toFixed(2)
    : scaled.lt(100)
      ? scaled.toFixed(1)
      : scaled.toFixed(0);

  return `${s}${SUFFIX[t]}`;
}
