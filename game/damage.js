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
    
    // Configurable modifiers from Protocols/Constants
    protocolModifiers: {
        skillDurationBonusMs: {}, // { skillId: ms }
        skillCooldownMult: {},    // { skillId: mult }
        skillValueBonus: {},      // { skillId: val }
        bossDpsMult: 1,
        bossRewardMult: 1,
        anomalyChanceBonus: 0,
        anomalyFragmentMult: 1,
        starlinkTagPowerAdd: 0,
        starlinkTagDropBonus: 0,
        comboBonusPerTap: 0,
        tapFromDpsRatio: 0, // from manual_override
        treasureChestChance: 0,
    }
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
  stellarFragmentsSpent = 0 
}) {
  if (!protocolsDef?.length) {
    pushLayer(totals, "cosmicProtocols", { note: "(none)" });
    return totals;
  }

  const mods = totals.protocolModifiers;
  
  let tapMult = 1;
  let globalDpsMult = 1;
  let minerDpsMult = 1;
  let critChanceAdd = 0;
  let critMultMul = 1;
  let mineralMult = 1;

  for (const p of protocolsDef) {
    const lv = Math.max(0, Math.floor(toNum(ownedProtocols?.[p.id], 0)));
    if (lv <= 0) continue;

    const baseVal = toNum(p.baseValue, 0);

    switch (p.type) {
      case "globalDpsMultiplier_perSpentSF":
         // "Adds +11% global DPS per Stellar Fragment spent into this protocol"
         // Cost logic is external, but usually spent ~ cost formula.
         // If we don't track specific spent amount, we can estimate from level?
         // User says "per Stellar Fragment spent INTO THIS PROTOCOL".
         // Use: cost formula. 
         // If cost=1 (linear), spent = lv.
         // If cost=n, spent = n*(n+1)/2. 
         // Helper to approximate or if passed explicitly? 
         // Ideally eco reducer tracks `spentOnProtocol`.
         // For now, let's use Level * BaseValue as standard fallback or approximating cost?
         // Text says: "per Stellar Fragment spent".
         // Let's approximate based on level cost formula:
         // core_singularity: unlock=1, levelUp=1. Cost for Lvl L = 1. Total spent = L.
         // So Level * BaseValue works perfectly for Cost=1.
         globalDpsMult += lv * baseVal; 
         break;

      case "globalDpsMultiplier":
        globalDpsMult += lv * baseVal;
        break;

      case "minerDpsMultiplier":
        // Applies to base miner DPS before global
        minerDpsMult += lv * baseVal;
        break;
        
      case "bossDpsMultiplier":
        mods.bossDpsMult += lv * baseVal;
        break;
        
      case "idleDpsMultiplier_piecewise":
        // Piecewise logic
        if (p.piecewise) {
             const { startPerLevel, minPerLevel, stepDownEveryLevels, stepDownAmount } = p.piecewise;
             let totalPw = 0;
             for (let i=1; i<=lv; i++) {
                 // 0-based index for step down? "stepDownEveryLevels: 10" -> levels 1-10 full, 11-20 -0.01
                 const steps = Math.floor((i - 1) / stepDownEveryLevels);
                 const currentVal = Math.max(minPerLevel, startPerLevel - steps * stepDownAmount);
                 totalPw += currentVal;
             }
             // Applying as Global DPS multiplier or separate Idle?
             // "Boosts idle DPS". Integrating into Global DPS for now.
             globalDpsMult += totalPw; 
        } else {
             globalDpsMult += lv * baseVal;
        }
        break;

      case "dpsScalingReducer":
         // Not implemented yet
         break;

      case "tapMultiplier":
        tapMult += lv * baseVal;
        break;

      case "dpsToTapConversion":
        mods.tapFromDpsRatio += lv * baseVal;
        break;
        
      case "tapComboBonusPerTap":
        mods.comboBonusPerTap += lv * baseVal;
        break;

      case "critEnhancer_split":
        if (p.crit) {
            critChanceAdd += lv * p.crit.critChanceAddPerLevel;
            critMultMul += lv * p.crit.critMultAddPerLevel;
        } else {
            critChanceAdd += lv * (baseVal * 0.5);
            critMultMul += lv * baseVal;
        }
        break;

      case "critEnhancer":
        critChanceAdd += lv * baseVal * 0.5;
        critMultMul += lv * baseVal;
        break;

      case "mineralMultiplier":
        mineralMult += lv * baseVal;
        break;

      case "bossRewardMultiplier":
        mods.bossRewardMult += lv * baseVal;
        break;
        
      case "anomalyBossChanceBonus":
        mods.anomalyChanceBonus += lv * baseVal;
        break;
        
      case "anomalyFragmentRewardMultiplier_piecewise":
        if (p.piecewise) {
             const { startPerLevel, minPerLevel, stepDownEveryLevels, stepDownAmount } = p.piecewise;
             let totalPw = 0;
             for (let i=1; i<=lv; i++) {
                 const steps = Math.floor((i - 1) / stepDownEveryLevels);
                 const currentVal = Math.max(minPerLevel, startPerLevel - steps * stepDownAmount);
                 totalPw += currentVal;
             }
             mods.anomalyFragmentMult += totalPw;
        } else {
             mods.anomalyFragmentMult += lv * baseVal;
        }
        break;
        
      case "zoneSpeedMultiplier":
        // TODO: Pass to logic
        break;
        
      case "starlinkTagPowerAdd":
        mods.starlinkTagPowerAdd += lv * baseVal;
        break;
        
      case "starlinkTagDropBonus":
        mods.starlinkTagDropBonus += lv * baseVal;
        break;
        
      case "treasureChestChance":
         mods.treasureChestChance += lv * baseVal;
         break;
        
      // --- SKILL MODIFIERS ---
      case "skillDurationBonusMs":
        if (p.targets) {
            p.targets.forEach(tid => {
                mods.skillDurationBonusMs[tid] = (mods.skillDurationBonusMs[tid] || 0) + (lv * baseVal);
            });
        }
        break;

      case "skillCooldownReducer":
        if (p.targets) {
            // "Multiplicative on remaining cooldown" -> (1 - 0.05)^Level
            // baseValue = 0.05
            const reduction = Math.pow(1 - baseVal, lv);
            p.targets.forEach(tid => {
                const current = mods.skillCooldownMult[tid];
                // If undefined, start with 1.
                // If multiple sources, multiply?
                // Assuming one source per skill for now.
                mods.skillCooldownMult[tid] = (current !== undefined ? current : 1) * reduction;
            });
        }
        break;
        
      case "skillValueBonus":
        if (p.targets) {
            p.targets.forEach(tid => {
                 mods.skillValueBonus[tid] = (mods.skillValueBonus[tid] || 0) + (lv * baseVal);
            });
        }
        break;
        
      case "skillValueBonusMs":
         if (p.targets) {
             // e.g. reload cooldown reduction increase
             p.targets.forEach(tid => {
                 mods.skillValueBonus[tid] = (mods.skillValueBonus[tid] || 0) + (lv * baseVal);
             });
         }
         break;
         
      case "darkRitualStackBonus":
         if (p.targets) {
             p.targets.forEach(tid => {
                  mods.skillValueBonus[tid] = (mods.skillValueBonus[tid] || 0) + (lv * baseVal);
             });
         }
         break;

      case "hpScalingReducer":
        // Optional
        break;

      default:
        break;
    }
  }

  // Apply to totals
  totals.tapDamage = Math.max(1, totals.tapDamage * tapMult);
  totals.dps = Math.max(0, totals.dps * globalDpsMult * minerDpsMult); // including minerDps
  totals.critChance = clamp(totals.critChance + critChanceAdd, 0, 0.75);
  totals.critMult = Math.max(1.01, totals.critMult * critMultMul);
  totals.mineralMult = Math.max(0.01, totals.mineralMult * mineralMult);

  pushLayer(totals, "cosmicProtocols", {
    tapMult,
    globalDpsMult,
    critChanceAdd,
    critMultMul,
    mineralMult,
    minerDpsMult
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
  tagsByMinerId = {}, // ✅ New Argument
} = {}) {
  const totals = createEmptyTotals();

  // 3) Cosmic Protocols (Moved earlier to get modifiers like starlinkTagPowerAdd)
  applyCosmicProtocols({
    totals,
    protocolsDef: protocolsDef || [],
    ownedProtocols: ownedProtocols || {},
  });
  
  // Calculate Tag Power
  // Base 0.50 + Protocol Bonus
  const baseTagPower = 0.50; 
  const currentTagPower = baseTagPower + (totals.protocolModifiers.starlinkTagPowerAdd || 0);



  // 1) Base from miners
  for (const m of minersDef || []) {
    const lvl = Math.max(0, Math.floor(toNum(ownedMiners?.[m.id], 0)));
    if (lvl <= 0) continue;

    const c = getMinerContribution(m, lvl, ownedSkills);
    
    // Starlink Tag Bonus
    const tagCount = tagsByMinerId[m.id] || 0;
    let tagMult = 1;
    if (tagCount > 0) {
        tagMult = 1 + tagCount * currentTagPower;
    }
    
    c.dps *= tagMult;
    c.tap *= tagMult;

    totals.tapDamage += c.tap;
    totals.dps += c.dps;
    totals.breakdown.miners[m.id] = {
      level: lvl,
      tap: c.tap,
      dps: c.dps,
      tags: tagCount,
      tagMult: tagMult
    };
  }
  pushLayer(totals, "miners(BaseSum+Tags)", {
    tapDamage: totals.tapDamage,
    dps: totals.dps,
  });

  // 2) Miner skills (global)
  applyGlobalSkillsFromMiners({ totals, minersDef, ownedMiners, ownedSkills });

  // 3) Cosmic Protocols (Already applied initially to get modifiers, but we need to apply multipliers to the NEW Sum)
  // Re-apply multipliers logic? 
  // applyCosmicProtocols calculates 'globalDpsMult' and multiplies 'totals.dps', which was 0 when called first.
  // ISSUE: If I call applyCosmicProtocols first, 'totals.dps' is 0, so 'totals.dps * mult' is still 0. 
  // Then I add miners.
  // So the Protocol Multiplier never applied to the miner sum?
  // CORRECT.
  // I need to separating "Collecting Modifiers" from "Applying Multipliers".
  // OR: Call applyCosmicProtocols TWICE? No, side effects.
  // OR: Just manually apply the multipliers from the breakdown/totals? 
  // 'totals.breakdown.cosmicProtocols' has the multipliers.
  // Let's use that.
  
  const cpLayer = totals.breakdown.layers.find(l => l.name === "cosmicProtocols");
  if (cpLayer) {
      if (cpLayer.globalDpsMult) totals.dps *= cpLayer.globalDpsMult;
      if (cpLayer.minerDpsMult) totals.dps *= cpLayer.minerDpsMult; // We tracked this separately in applyCosmicProtocols update
      if (cpLayer.tapMult) totals.tapDamage *= cpLayer.tapMult;
      if (cpLayer.mineralMult) totals.mineralMult *= cpLayer.mineralMult;
      // Crit was additive to totals.critChance/Mult, effectively already set in totals state?
      // Yes, 'totals.critChance = ...' sets it on the object.
      // But 'totals.dps' was 0.
      // So simple multiplication here fixes DPS/TAP.
  }

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
  // dpsPortion calculated later using protocol modifiers
  
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

  // NEW: Protocol Tap From DPS Ratio
  let tapRatio = DAMAGE_CONFIG.TAP_FROM_DPS_RATIO;
  if (totals.protocolModifiers.tapFromDpsRatio > 0) {
      tapRatio += totals.protocolModifiers.tapFromDpsRatio;
  }
  
  const dpsPortion = totals.dps * tapRatio;
  
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
    protocolModifiers: totals.protocolModifiers, // ✅ Expose modifiers
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
