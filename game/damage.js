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
import { DAMAGE_CONFIG } from "./config";

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

// Bulk cost: Buy 'count' levels starting from 'currentLevel'
// Geometric Series Sum: Base * Growth^L * ( (Growth^N - 1) / (Growth - 1) )
export function getBulkCost(def, currentLevel, count = 1) {
  const n = Math.max(1, Number(count));
  if (n === 1) return getNextCost(def, currentLevel);

  const lvl = Number(currentLevel || 0);
  const base = D(def.baseCost || 0);
  const growth = D(def.costGrowth || 1.07);
  
  // growth^N - 1
  const num = Decimal.pow(growth, n).sub(1);
  // growth - 1
  const den = growth.sub(1);
  
  // multiplier = (growth^N - 1) / (growth - 1)
  // If growth is 1, cost is simply base * n (linear) but growth defaults to 1.07
  if (den.eq(0)) return base.mul(n);

  // Partial: Base * Growth^L
  const currentBase = base.mul(Decimal.pow(growth, lvl));
  
  // Total
  return currentBase.mul(num).div(den).floor();
}

// -----------------------------------------------------------------------------
// Number formatting (CH-like, no decimals)
// -----------------------------------------------------------------------------

// NOTE: You asked for “1K not 1.00K” => integer tiers.
// This is the same suffix set you already used.
// CH Suffixes based on Wiki
const CH_SUFFIXES = [
  "", "K", "M", "B", "T", "q", "Q", "s", "S", "O", "N", "d", "U", "D",
  "!", "@", "#", "$", "%", "^", "&", "*"
];

export function fmt(n) {
  const d = D(n); // Ensure Decimal
  
  // Handle 0 or invalid
  // Handle 0 or invalid
  if (d.eq(0) || d.abs().lt(1)) return "0";
  
  // Handle negatives
  if (d.lt(0)) return "-" + fmt(d.neg());

  // < 1000: Integer
  if (d.lt(1000)) {
     return Math.floor(d.toNumber()).toString();
  }

  // Determine tier (log10 / 3)
  const exponent = Math.floor(d.log10());
  const tier = Math.floor(exponent / 3);

  // If within suffix range
  if (tier < CH_SUFFIXES.length) {
      const suffix = CH_SUFFIXES[tier];
      // Divide by 1000^tier
      // Decimal.pow(10, tier * 3) is safer
      const divisor = Decimal.pow(10, tier * 3);
      const value = d.div(divisor);
      
      // User wants 3 decimal places for precision
      // e.g. 1234 -> 1.234K
      return value.toFixed(3) + suffix;
  }

  // Fallback to Scientific Notation for huge numbers (e.g. 1e68+)
  // format: 1.234e68
  return d.toExponential(3).replace("+", "");
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
// 1) Base from miners (sum of miner contributions) + Starlink Tags (Local)
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

    const baseVal = toNum(p.baseValue, 0);
    const amount = baseVal * lv;

    switch (p.type) {
      case "tapMultiplier":
        tapMult *= 1 + amount;
        break;
      case "globalDpsMultiplier":
        globalDpsMult *= 1 + amount;
        break;
      case "critEnhancer":
        // JSON says "critEnhancer" -> usually chance + mult?
        // Let's assume it adds to chance and multiplies damage slightly?
        // Or checking description: "Improves critical chance and multiplier"
        // Let's split it: half to chance, full to mult?
        // For simplicity: amount -> chance, (1+amount) -> mult
        critChanceAdd += amount * 0.5; 
        critMultMul *= 1 + amount;
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
      // TODO: Implement other types:
      // - minerDpsMultiplier
      // - bossDpsMultiplier
      // - idleDpsMultiplier
      // - dpsScalingReducer
      // - dpsToTapConversion
      // - bossRewardMultiplier
      // - zoneSpeedMultiplier
      // - hpScalingReducer
      default:
        break;
    }
  }

  totals.tapDamage = Math.max(1, totals.tapDamage * tapMult);
  totals.dps = Math.max(0, totals.dps * globalDpsMult);
  totals.critChance = clamp(totals.critChance + critChanceAdd, 0, 0.75);
  totals.critMult = Math.max(1.01, totals.critMult * critMultMul);
  totals.mineralMult = Math.max(0.01, totals.mineralMult * mineralMult);

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

  // ---------------------------------------------------------------------------
  // NEW: Base Tap from DPS (Clicker Heroes style)
  // ---------------------------------------------------------------------------
  // BaseTap = (Sum of Miner Tap + (TotalDPS * Ratio))
  // Then multiplied by Global Tap Multipliers (Tap Power)
  
  // totals.dps is already fully calculated here (including all multipliers).
  const dpsPortion = totals.dps * DAMAGE_CONFIG.TAP_FROM_DPS_RATIO;
  
  // totals.tapDamage currently holds (Sum of Miner Tap) * (minersSkills.tapMult) ...
  // Wait, applyGlobalSkillsFromMiners applies mult to totals.tapDamage incrementally.
  // We need to be careful.
  // Ideally: base = (MinerFixedSum + DpsPortion)
  //          final = base * GlobalMultipliers
  
  // As structured, 'totals.tapDamage' has already been multiplied by global skills layer by layer.
  // But 'dpsPortion' is new. It should ALSO be multiplied by global tap multipliers?
  // User says: "BaseTapFromDPS... TapPowerMultiplier... Streak...".
  // Formula: (DPS * Ratio) * TapPowerMult.
  
  // We can treat the existing `totals.tapDamage` as the "Flat Damage" part.
  // We need to inject the DPS portion.
  // Issue: We don't easily know the "Aggregate Global Tap Mult" because it was applied incrementally.
  // FIX: We tracked it in `totals.breakdown.layers`.
  
  // Let's reconstruct Global Multiplier from layers or simplistically:
  // Since this is a redesign, let's assume `totals.tapDamage` computed so far is the "Miner Base * Multipliers".
  // We need to Add (DPS * Ratio * Multipliers).
  // Optimization: If we assume `applyGlobalSkillsFromMiners` tracked `tapMult` in the layer, we can fetch it?
  
  // Let's simplify:
  // 1. We know `totals.dps`.
  // 2. We calculate `baseTapFromDps = totals.dps * 0.5`.
  // 3. We assume this "Phantom Base" benefits from the same multipliers the normal tap did.
  //    But we applied multipliers iteratively.
  //    This logic is tricky with the current pipeline.
  
  // Alternative: Calculate `baseTapFromDps` FIRST? No, DPS depends on multipliers too.
  //
  // SOLUTION: We will extract the "Total Tap Multiplier" by maintaining a separate accumulator in `totals`.
  // Then we can apply it to the DPS portion.
  
  // Since I didn't add `tapMultiplierAccumulator` to `totals` structure earlier, 
  // I will just add `dpsPortion` to `totals.tapDamage` directly, assuming `dpsPortion` is ALREADY "scaling" with progression because `dps` scales.
  // BUT: `TapPowerMultiplier` (Fragsworth) specifically boosts CLICK, not DPS.
  // If we just take DPS, it has DPS mults, not Click mults.
  // So we MUST apply Click Multipliers to the DPS portion.
  
  // Hacky but robust for now: 
  // In `applyGlobalSkillsFromMiners`, we pushed `{ tapMult }`.
  // We can iterate `totals.breakdown.layers` to find the total tap mult.
  
  let totalTapMult = 1;
  totals.breakdown.layers.forEach(l => {
      if (l.tapMult) totalTapMult *= l.tapMult;
  });
  
  // The dpsPortion serves as a base. 
  // So added damage = (totals.dps * Ratio) * totalTapMult.
  
  const tapFromDps = dpsPortion * totalTapMult;
  totals.tapDamage += tapFromDps;
  
  totals.breakdown.tapFromDps = tapFromDps; // Debug info

  // ---------------------------------------------------------------------------

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

export function getPrimalReward(zone) {
  const z = Number(zone || 0);
  if (z < 100) return 0;
  
  // Formula: ((Zone - 80) / 25) ^ 1.3
  // Z105 -> 1
  // Z200 -> 8
  // Z500 -> 39
  // Z1000 -> 100
  const val = Math.pow((z - 80) / 25, 1.3);
  return Math.max(1, Math.floor(val));
}
