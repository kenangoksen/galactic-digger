// game/damage.js

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function getNextCost(def, currentLevel) {
  const lvl = Number(currentLevel || 0);
  const base = Number(def.baseCost || 0);
  const growth = Number(def.costGrowth || 1.15);
  // cost = base * growth^lvl
  return Math.floor(base * Math.pow(growth, lvl));
}

function skillMult(def, level) {
  // def.skills: [{ level: 10, type: "tapMul", value: 0.25 }, ...]
  const skills = Array.isArray(def.skills) ? def.skills : [];

  let tapMulAdd = 0;
  let dpsMulAdd = 0;
  let globalDpsMulAdd = 0;
  let critChanceAdd = 0;
  let critMulAdd = 0;
  let mineralMulAdd = 0;
  let dpsToTapPct = 0;

  // satın alınan seviye kadar skill açılır
  for (const s of skills) {
    if (!s || typeof s.level !== "number") continue;
    if (level < s.level) continue;

    const v = Number(s.value || 0);

    switch (s.type) {
      case "tapMul":
        tapMulAdd += v;
        break;
      case "dpsMul":
        dpsMulAdd += v;
        break;
      case "globalDpsMul":
        globalDpsMulAdd += v;
        break;
      case "critChance":
        critChanceAdd += v;
        break;
      case "critMult":
        critMulAdd += v;
        break;
      case "mineralMul":
        mineralMulAdd += v;
        break;
      case "dpsToTapPct":
        dpsToTapPct += v;
        break;
      default:
        break;
    }
  }

  return {
    tapMul: 1 + tapMulAdd,
    dpsMul: 1 + dpsMulAdd,
    globalDpsMul: 1 + globalDpsMulAdd,
    critChanceAdd,
    critMulAdd,
    mineralMul: 1 + mineralMulAdd,
    dpsToTapPct,
  };
}

function minerTapDamage(def, level) {
  const tapBase = Number(def?.stats?.tapBase || 0);
  if (tapBase <= 0 || level <= 0) return 0;

  const m = skillMult(def, level);
  // tap minerlar genelde düz artar
  // Burada level ile lineer: tapBase * level
  return tapBase * level * m.tapMul;
}

function minerDps(def, level) {
  const dpsBase = Number(def?.stats?.dpsBase || 0);
  if (dpsBase <= 0 || level <= 0) return 0;

  const m = skillMult(def, level);
  // DPS minerlar level ile lineer artar
  return dpsBase * level * m.dpsMul;
}

export function computeTotals({
  minersDef,
  ownedMiners,
  ownedSkills = {},
  zone,
}) {
  let tapDamage = 1;
  let dps = 0;

  let tapMult = 1;
  let dpsMultGlobal = 1;

  let critChance = 0;
  let critMult = 2;

  let mineralMult = 1;

  for (const m of minersDef) {
    const lvl = Number(ownedMiners?.[m.id] || 0);
    if (lvl <= 0) continue;

    const tapBase = Number(m.stats?.tapBase || 0);
    const dpsBase = Number(m.stats?.dpsBase || 0);

    // base katkı
    if (tapBase > 0) tapDamage += tapBase * lvl;
    if (dpsBase > 0) dps += dpsBase * lvl;

    // skills
    const purchased = ownedSkills?.[m.id] || {};
    for (const sk of m.skills || []) {
      if (lvl < Number(sk.unlockAt || 0)) continue;
      if (!purchased[sk.id]) continue; // ✅ satın alınmamışsa etkisi yok

      const v = Number(sk.value || 0);

      switch (sk.kind) {
        case "tapMultiplier":
          tapMult *= 1 + v;
          break;
        case "dpsMultiplier":
          // Miner'in kendi dps'ini çarpanlamak istiyorsan burada farklı kurgulanır.
          // Şimdilik global'e ekleyelim:
          dps *= 1 + v;
          break;
        case "globalDpsMultiplier":
          dpsMultGlobal *= 1 + v;
          break;
        case "critChance":
          critChance += v;
          break;
        case "critMultiplier":
          critMult *= 1 + v;
          break;
        case "mineralMultiplier":
          mineralMult *= 1 + v;
          break;
      }
    }
  }

  // clamp
  critChance = Math.min(0.75, Math.max(0, critChance));

  // apply multipliers
  tapDamage = Math.max(1, tapDamage * tapMult);
  dps = Math.max(0, dps * dpsMultGlobal);

  return {
    tapDamage,
    dps,
    tapMult,
    dpsMultGlobal,
    critChance,
    critMult,
    mineralMult,
  };
}
// /game/damage.js

const CH_SUFFIXES = [
  "", // 1
  "K", // Thousand
  "M", // Million
  "B", // Billion
  "T", // Trillion
  "q", // Quadrillion
  "Q", // Quintillion
  "s", // Sextillion
  "S", // Septillion
  "O", // Octillion
  "N", // Nonillion
  "d", // Decillion
  "U", // Undecillion
  "D", // Duodecillion
  "!", // Tredecillion
  "@", // Quattuordecillion
  "#", // Quindecillion
  "$", // Sexdecillion
  "%", // Septendecillion
  "^", // Octodecillion
  "&", // Novemdecillion
  "*", // Vigintillion
];

export function fmt(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x === 0) return "0";

  const sign = x < 0 ? "-" : "";
  let v = Math.abs(Math.floor(x));

  // 0–999 arası: direkt sayı
  if (v < 1000) {
    return sign + String(v);
  }

  let tier = 0;

  // 1000'e bölerek tier ilerlet
  while (v >= 1000 && tier < CH_SUFFIXES.length - 1) {
    v = Math.floor(v / 1000);
    tier++;
  }

  // En üst seviye sonrası
  if (tier >= CH_SUFFIXES.length - 1 && v >= 1000) {
    return sign + "A lot";
  }

  return sign + v + CH_SUFFIXES[tier];
}

// game/damage.js (en alta ekleyebilirsin)

// Miner level scaling (Clicker Heroes hissi):
// Eğer sende farklı bir büyüme katsayısı varsa burayı aynı mantıkla güncellersin.
// Şu an: base * level * 1.07^(level-1) gibi bir curve.
function scaleStat(base, level) {
  const lv = Math.max(0, Number(level || 0));
  if (lv <= 0) return 0;
  return base * lv * Math.pow(1.07, lv - 1);
}

/**
 * Tek bir miner'ın mevcut katkısını döndürür.
 * @returns { tap: number, dps: number }
 */
export function getMinerContribution(def, level, zone) {
  if (!def) return { tap: 0, dps: 0 };
  const lv = Math.max(0, Number(level || 0));
  if (lv <= 0) return { tap: 0, dps: 0 };

  const tapBase = Number(def?.stats?.tapBase || 0);
  const dpsBase = Number(def?.stats?.dpsBase || 0);

  // Base contribution (skill yoksa bile doğru çalışır)
  let tap = scaleStat(tapBase, lv);
  let dps = scaleStat(dpsBase, lv);

  // Skills: minerDef.skills içinde "type" alanına göre etkileri uygula
  // (Senin miners.json'daki skill şemasına uyacak şekilde)
  const skills = Array.isArray(def.skills) ? def.skills : [];
  for (const s of skills) {
    const unlockAt = Number(s.unlockAt || s.level || 0);
    if (unlockAt > lv) continue;

    const value = Number(s.value || 0);
    const type = s.type;

    // Bu kısım senin skill tiplerine göre genişler:
    if (type === "dps_mult") dps *= 1 + value; // ör: 0.25 => %25
    if (type === "tap_mult") tap *= 1 + value;
    // critChance/mineralMult gibi global etkiler totals içinde zaten toplanıyorsa burada dokunma.
  }

  // zone scaling gerekiyorsa burada uygula (late scaling vs)
  // Şimdilik zone scaling totals içinde değilse bile tek miner katkısı doğru görünür.

  return { tap, dps };
}

/**
 * Upgrade sonrası (level+1) katkı.
 */
export function getMinerNextContribution(def, level, zone) {
  return getMinerContribution(def, Number(level || 0) + 1, zone);
}

// game/damage.js

export function baseReward(zone) {
  return Math.max(1, Math.floor(3 * Math.pow(1.33, zone - 1)));
}

export function stepFactor(step) {
  return 0.9 + (Math.max(1, step) - 1) * 0.02;
}

export function monsterMineralReward(zone, step) {
  const z = Math.max(1, Math.floor(zone));
  const s = Math.max(1, Math.min(10, Math.floor(step)));

  const isBoss = z % 5 === 0 && s === 10;

  // Zone büyüdükçe üssel artar, step ufak ek çarpan.
  const base = Math.floor(3 * Math.pow(1.33, z - 1));
  const stepMul = 0.9 + (s - 1) * 0.02; // 0.90 .. 1.08

  let reward = base * stepMul;
  if (isBoss) reward *= 10;

  return Math.max(1, Math.floor(reward));
}


