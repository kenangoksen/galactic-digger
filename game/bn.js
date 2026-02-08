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
  if (!Number.isFinite(v.e) || !Number.isFinite(v.mantissa)) return "INF";

  // < 1000: Clicker Heroes style integer for small numbers
  if (v.lt(1000)) return v.floor().toString();

  // tier = floor(exponent / 3)
  const tier = Math.floor(v.e / 3);
  
  // If tier is beyond our SUFFIX list, use scientific notation (e.g. 2.333e301)
  if (tier >= SUFFIX.length) {
      // toExponential(3) => "2.333e+301"
      return v.toExponential(3).replace("+", "");
  }

  const suffix = SUFFIX[tier];
  
  // scaled = v / 1000^tier
  // Optimization: mantissa * 10^(exponent % 3)
  // e.g. 1.23e4 -> tier 1. rem 1. 1.23 * 10^1 = 12.3 K
  const rem = v.e % 3;
  const val = v.mantissa * Math.pow(10, rem);
  
  // User requested 3 decimal places for precision (e.g. 2.205q)
  return val.toFixed(3) + suffix;
}
