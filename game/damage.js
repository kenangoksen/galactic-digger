// game/damage.js
// -----------------------------------------------------------------------------
// Galactic Digger – Damage & Economy Core (Clicker Heroes-inspired, extensible)
// -----------------------------------------------------------------------------
// Why this file exists:
// - We need ONE canonical place that computes Total DPS, Total Click Damage,
//   crit, and mineral multipliers.
// - Today we have: Miners + Miner levels + Miner skills (purchasable).
// - Soon we will add: Cosmic Protocols (Ancients-like) and Universal Constants
//   (Outsiders-like). We want to plug them in without changing game UI/engine.
//
// IMPORTANT:
// - This code is written to NOT break the existing app.
// - computeTotals() keeps the same signature you already use in useGameEngine.

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
import Decimal from "break_infinity.js";
import { D } from "./bn";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toNum(x, fallback = 0) {
  const v = Number(x);
  return Number.isFinite(v) ? v : fallback;
}

// -----------------------------------------------------------------------------
// Cost
// -----------------------------------------------------------------------------

// Next miner cost (same as before)
// cost = baseCost * costGrowth ^ currentLevel
export function getNextCost(def, currentLevel) {
  const lvl = Number(currentLevel || 0);
  const base = D(def.baseCost || 0); // ✅ Decimal
  const growth = D(def.costGrowth || 1.07); // ✅ Decimal

  // cost = base * growth^lvl
  // break_infinity pow: Decimal.pow(a, n)
  return base.mul(Decimal.pow(growth, lvl)).floor(); // ✅ Decimal döner
}

// -----------------------------------------------------------------------------
// Number formatting (CH-like, no decimals)
// -----------------------------------------------------------------------------

// NOTE: You asked for “1K not 1.00K” => integer tiers.
// This is the same suffix set you already used.
const CH_SUFFIXES = [
  "", // 1
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

export function fmt(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x === 0) return "0";

  const sign = x < 0 ? "-" : "";
  let v = Math.abs(Math.floor(x));

  if (v < 1000) return sign + String(v);

  let tier = 0;
  while (v >= 1000 && tier < CH_SUFFIXES.length - 1) {
    v = Math.floor(v / 1000);
    tier++;
  }

  // After the last suffix, show "A lot" (same behavior as before)
  if (tier >= CH_SUFFIXES.length - 1 && v >= 1000) {
    return sign + "A lot";
  }

  return sign + String(v) + CH_SUFFIXES[tier];
}

// -----------------------------------------------------------------------------
// Skill system
// -----------------------------------------------------------------------------
// Current miners.json skill shape:
// { id, name, kind, value, unlockAt, cost }
// - We only APPLY a skill if:
//   a) miner level >= unlockAt
//   b) ownedSkills[minerId][skillId] === true (purchased)
//
// Skill kinds currently used:
// - tapMultiplier            (global click multiplier)
// - dpsMultiplier            (miner's own DPS multiplier)
// - globalDpsMultiplier      (global DPS multiplier)
// - critChance               (adds to global crit chance)
// - critMultiplier           (multiplies global crit damage multiplier)
// - mineralMultiplier        (global mineral multiplier)

function getPurchasedSkillMap(ownedSkills, minerId) {
  return ownedSkills?.[minerId] || {};
}

function isSkillActive({ minerLevel, purchasedMap, skill }) {
  if (!skill) return false;
  const unlockAt = Math.floor(toNum(skill.unlockAt, 0));
  if (minerLevel < unlockAt) return false;
  return !!purchasedMap?.[skill.id];
}

// -----------------------------------------------------------------------------
// Miner contribution (per-miner DPS / click contribution)
// -----------------------------------------------------------------------------

// We keep it SIMPLE and stable for now:
// - Miner DPS grows linearly with level by default: dpsBase * level
// - Miner Tap grows linearly with level by default: tapBase * level
// - Miner-local dpsMultiplier skills multiply only that miner's DPS.
//
// Later (if you want CH-like hero scaling), you can swap these formulas
// WITHOUT changing the rest of the pipeline.

function baseTapForMiner(def, level) {
  const tapBase = toNum(def?.stats?.tapBase, 0);
  if (tapBase <= 0 || level <= 0) return 0;
  return tapBase * level;
}

function baseDpsForMiner(def, level) {
  const dpsBase = toNum(def?.stats?.dpsBase, 0);
  if (dpsBase <= 0 || level <= 0) return 0;
  return dpsBase * level;
}

function applyMinerLocalSkillMultipliers({
  minerDef,
  minerLevel,
  ownedSkills,
}) {
  // Only "dpsMultiplier" should be treated as miner-local.
  // Everything else is processed in the global layer.
  const purchasedMap = getPurchasedSkillMap(ownedSkills, minerDef.id);
  let dpsMul = 1;

  for (const sk of minerDef.skills || []) {
    if (!isSkillActive({ minerLevel, purchasedMap, skill: sk })) continue;
    if (sk.kind !== "dpsMultiplier") continue;
    const v = toNum(sk.value, 0);
    dpsMul *= 1 + v;
  }

  return { dpsMul };
}

export function getMinerContribution(minerDef, level, ownedSkills) {
  const lv = Math.max(0, Math.floor(toNum(level, 0)));
  if (!minerDef || lv <= 0) return { tap: 0, dps: 0 };

  // Base
  let tap = baseTapForMiner(minerDef, lv);
  let dps = baseDpsForMiner(minerDef, lv);

  // Miner-local multipliers
  const { dpsMul } = applyMinerLocalSkillMultipliers({
    minerDef,
    minerLevel: lv,
    ownedSkills,
  });
  dps *= dpsMul;

  return { tap, dps };
}

// -----------------------------------------------------------------------------
// Global modifier pipeline
// -----------------------------------------------------------------------------
// This is the key extensibility point.
// Think of the final stats as a "payload" that flows through layers.
// Each layer can read current totals and return updated totals.
//
// Layers in order:
// 1) Base from miners (sum of miner contributions)
// 2) Miner skills that are GLOBAL (tapMultiplier, globalDpsMultiplier, crit, etc)
// 3) Cosmic Protocols (placeholder)
// 4) Universal Constants (placeholder)
// 5) Final clamps & defaults

function createEmptyTotals() {
  return {
    // Primary outputs
    tapDamage: 1, // click damage baseline
    dps: 0,

    // Crit system
    critChance: 0,
    critMult: 2, // crit multiplier baseline

    // Economy
    mineralMult: 1,

    // For debugging / UI
    breakdown: {
      miners: {},
      layers: [],
    },
  };
}

function pushLayer(totals, name, payload = {}) {
  totals.breakdown.layers.push({ name, ...payload });
}

function applyGlobalSkillsFromMiners({
  totals,
  minersDef,
  ownedMiners,
  ownedSkills,
}) {
  // These are GLOBAL multipliers collected from purchased miner skills.
  // IMPORTANT: We compute them independent of totals.dps accumulation order.
  let tapMult = 1;
  let globalDpsMult = 1;
  let critChanceAdd = 0;
  let critMultMul = 1;
  let mineralMult = 1;

  for (const m of minersDef || []) {
    const lvl = Math.max(0, Math.floor(toNum(ownedMiners?.[m.id], 0)));
    if (lvl <= 0) continue;

    const purchasedMap = getPurchasedSkillMap(ownedSkills, m.id);

    for (const sk of m.skills || []) {
      if (!isSkillActive({ minerLevel: lvl, purchasedMap, skill: sk }))
        continue;

      const v = toNum(sk.value, 0);
      switch (sk.kind) {
        case "tapMultiplier":
          tapMult *= 1 + v;
          break;
        case "globalDpsMultiplier":
          globalDpsMult *= 1 + v;
          break;
        case "critChance":
          critChanceAdd += v;
          break;
        case "critMultiplier":
          critMultMul *= 1 + v;
          break;
        case "mineralMultiplier":
          mineralMult *= 1 + v;
          break;
        // "dpsMultiplier" is miner-local and handled in getMinerContribution()
        default:
          break;
      }
    }
  }

  // Apply
  totals.tapDamage = Math.max(1, totals.tapDamage * tapMult);
  totals.dps = Math.max(0, totals.dps * globalDpsMult);
  totals.critChance = clamp(totals.critChance + critChanceAdd, 0, 0.75);
  totals.critMult = Math.max(1.01, totals.critMult * critMultMul);
  totals.mineralMult = Math.max(0.01, totals.mineralMult * mineralMult);

  pushLayer(totals, "minerSkills(Global)", {
    tapMult,
    globalDpsMult,
    critChanceAdd,
    critMultMul,
    mineralMult,
  });

  return totals;
}

// -----------------------------------------------------------------------------
// Cosmic Protocols (Ancients-like) – PLACEHOLDER LAYER
// -----------------------------------------------------------------------------
// We will later load these from JSON similar to miners.json:
// assets/config/cosmic_protocols.json
//
// Suggested data shape:
// [
//   {
//     "id": "cp_01",
//     "name": "Protocol of Velocity",
//     "maxLevel": 9999,
//     "effects": [
//        { "kind": "globalDpsMultiplier", "perLevel": 0.01 }
//     ]
//   }
// ]
//
// Owned state in save:
// ownedCosmicProtocols: { [id]: level }
//
// NOTE: This function currently does nothing unless you pass protocols.

function applyCosmicProtocols({
  totals,
  protocolsDef = [],
  ownedProtocols = {},
}) {
  if (!protocolsDef?.length) {
    pushLayer(totals, "cosmicProtocols", { note: "(none)" });
    return totals;
  }

  let tapMult = 1;
  let globalDpsMult = 1;
  let critChanceAdd = 0;
  let critMultMul = 1;
  let mineralMult = 1;

  for (const p of protocolsDef) {
    const lv = Math.max(0, Math.floor(toNum(ownedProtocols?.[p.id], 0)));
    if (lv <= 0) continue;

    for (const ef of p.effects || []) {
      const perLevel = toNum(ef.perLevel, 0);
      const amount = perLevel * lv;

      switch (ef.kind) {
        case "tapMultiplier":
          tapMult *= 1 + amount;
          break;
        case "globalDpsMultiplier":
          globalDpsMult *= 1 + amount;
          break;
        case "critChance":
          critChanceAdd += amount;
          break;
        case "critMultiplier":
          critMultMul *= 1 + amount;
          break;
        case "mineralMultiplier":
          mineralMult *= 1 + amount;
          break;
        default:
          break;
      }
    }
  }

  totals.tapDamage *= tapMult;
  totals.dps *= globalDpsMult;
  totals.critChance = clamp(totals.critChance + critChanceAdd, 0, 0.75);
  totals.critMult *= critMultMul;
  totals.mineralMult *= mineralMult;

  pushLayer(totals, "cosmicProtocols", {
    tapMult,
    globalDpsMult,
    critChanceAdd,
    critMultMul,
    mineralMult,
  });

  return totals;
}

// -----------------------------------------------------------------------------
// Universal Constants (Outsiders-like) – PLACEHOLDER LAYER
// -----------------------------------------------------------------------------
// These are usually meta multipliers / rules.
// Same idea: JSON definition + owned levels.

function applyUniversalConstants({
  totals,
  constantsDef = [],
  ownedConstants = {},
}) {
  if (!constantsDef?.length) {
    pushLayer(totals, "universalConstants", { note: "(none)" });
    return totals;
  }

  // Example implementation scaffold:
  // constants can change formulas (e.g. bossHP, idleDamage, etc).
  // For now we treat them as simple multipliers (you can expand later).

  let tapMult = 1;
  let globalDpsMult = 1;
  let mineralMult = 1;

  for (const c of constantsDef) {
    const lv = Math.max(0, Math.floor(toNum(ownedConstants?.[c.id], 0)));
    if (lv <= 0) continue;

    for (const ef of c.effects || []) {
      const perLevel = toNum(ef.perLevel, 0);
      const amount = perLevel * lv;
      switch (ef.kind) {
        case "tapMultiplier":
          tapMult *= 1 + amount;
          break;
        case "globalDpsMultiplier":
          globalDpsMult *= 1 + amount;
          break;
        case "mineralMultiplier":
          mineralMult *= 1 + amount;
          break;
        default:
          break;
      }
    }
  }

  totals.tapDamage *= tapMult;
  totals.dps *= globalDpsMult;
  totals.mineralMult *= mineralMult;

  pushLayer(totals, "universalConstants", {
    tapMult,
    globalDpsMult,
    mineralMult,
  });
  return totals;
}

// -----------------------------------------------------------------------------
// Public API: computeTotals
// -----------------------------------------------------------------------------
// This is what the engine calls.
// Keep signature stable.

export function computeTotals({
  minersDef,
  ownedMiners,
  ownedSkills = {},
  zone,

  // Optional (future):
  protocolsDef,
  ownedProtocols,
  constantsDef,
  ownedConstants,
} = {}) {
  const totals = createEmptyTotals();

  // 1) Base from miners
  for (const m of minersDef || []) {
    const lvl = Math.max(0, Math.floor(toNum(ownedMiners?.[m.id], 0)));
    if (lvl <= 0) continue;

    const c = getMinerContribution(m, lvl, ownedSkills);
    totals.tapDamage += c.tap;
    totals.dps += c.dps;
    totals.breakdown.miners[m.id] = {
      level: lvl,
      tap: c.tap,
      dps: c.dps,
    };
  }
  pushLayer(totals, "miners(BaseSum)", {
    tapDamage: totals.tapDamage,
    dps: totals.dps,
  });

  // 2) Miner skills (global)
  applyGlobalSkillsFromMiners({ totals, minersDef, ownedMiners, ownedSkills });

  // 3) Cosmic Protocols (future)
  applyCosmicProtocols({
    totals,
    protocolsDef: protocolsDef || [],
    ownedProtocols: ownedProtocols || {},
  });

  // 4) Universal Constants (future)
  applyUniversalConstants({
    totals,
    constantsDef: constantsDef || [],
    ownedConstants: ownedConstants || {},
  });

  // 5) Final sanity
  totals.tapDamage = Math.max(1, Math.floor(totals.tapDamage));
  totals.dps = Math.max(0, Math.floor(totals.dps));
  totals.mineralMult = Math.max(0.01, totals.mineralMult);
  totals.critChance = clamp(totals.critChance, 0, 0.75);
  totals.critMult = Math.max(1.01, totals.critMult);
  pushLayer(totals, "final", {
    tapDamage: totals.tapDamage,
    dps: totals.dps,
    critChance: totals.critChance,
    critMult: totals.critMult,
    mineralMult: totals.mineralMult,
  });

  // Keep backwards compatibility: the engine expects these keys.
  return {
    tapDamage: totals.tapDamage,
    dps: totals.dps,
    critChance: totals.critChance,
    critMult: totals.critMult,
    mineralMult: totals.mineralMult,

    // Extra: optional debugging for you (safe to ignore in UI)
    breakdown: totals.breakdown,
  };
}

// -----------------------------------------------------------------------------
// Monster reward helpers (kept because engine imports them)
// -----------------------------------------------------------------------------

export function baseReward(zone) {
  const z = Math.max(1, Math.floor(toNum(zone, 1)));
  return Math.max(1, Math.floor(3 * Math.pow(1.33, z - 1)));
}

export function stepFactor(step) {
  const s = Math.max(1, Math.min(10, Math.floor(toNum(step, 1))));
  return 0.9 + (s - 1) * 0.02;
}

export function monsterMineralReward(zone, step) {
  const z = Math.max(1, Math.floor(toNum(zone, 1)));
  const s = Math.max(1, Math.min(10, Math.floor(toNum(step, 1))));
  const isBoss = z % 5 === 0 && s === 10;

  const base = Math.floor(3 * Math.pow(1.33, z - 1));
  const stepMul = 0.9 + (s - 1) * 0.02; // 0.90 .. 1.08

  let reward = base * stepMul;
  if (isBoss) reward *= 10;

  return Math.max(1, Math.floor(reward));
}
