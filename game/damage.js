// game/damage.js
// -----------------------------------------------------------------------------
// Galactic Digger – Damage & Economy Core
// -----------------------------------------------------------------------------
import Decimal from "break_infinity.js";
import { D, fmtD } from "./bn";

export const fmt = fmtD; // Alias

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toNum(x, fallback = 0) {
  const v = Number(x);
  return Number.isFinite(v) ? v : fallback;
}

// -----------------------------------------------------------------------------
// Cost Logic
// -----------------------------------------------------------------------------
export function getNextCost(def, currentLevel) {
  const lvl = Number(currentLevel || 0);
  const base = D(def.baseCost || 0);
  const growth = D(def.costGrowth || 1.07);
  return base.mul(Decimal.pow(growth, lvl)).floor();
}

export function getBulkCost(def, currentLevel, count = 1) {
  const n = Math.max(1, Number(count));
  if (n === 1) return getNextCost(def, currentLevel);
  const lvl = Number(currentLevel || 0);
  const base = D(def.baseCost || 0);
  const growth = D(def.costGrowth || 1.07);
  const num = Decimal.pow(growth, n).sub(1);
  const den = growth.sub(1);
  if (den.eq(0)) return base.mul(n);
  const currentBase = base.mul(Decimal.pow(growth, lvl));
  return currentBase.mul(num).div(den).floor();
}

// Helper for Protocol Bulk Cost (Arithmetic Series: Cost = Level + 1)
export function getProtocolBulkCost(currentLevel, amount) {
    if (amount <= 0) return 0;
    // Sum of (L+1) ... (L+amount)
    // = amount * L + Sum(1..amount)
    // = amount * L + amount*(amount+1)/2
    return (amount * currentLevel) + (amount * (amount + 1)) / 2;
}

// -----------------------------------------------------------------------------
// Miner Contribution (Base Layer)
// -----------------------------------------------------------------------------
function getPurchasedSkillMap(ownedSkills, minerId) {
  return ownedSkills?.[minerId] || {};
}

function isSkillActive({ minerLevel, purchasedMap, skill }) {
  if (!skill) return false;
  const unlockAt = Math.floor(toNum(skill.unlockAt, 0));
  if (minerLevel < unlockAt) return false;
  return !!purchasedMap?.[skill.id];
}

function baseTapForMiner(def, level) {
    const tapBase = toNum(def?.stats?.tapBase, 0);
    return level > 0 ? tapBase * level : 0;
}

function baseDpsForMiner(def, level) {
    const dpsBase = toNum(def?.stats?.dpsBase, 0);
    return level > 0 ? dpsBase * level : 0;
}

// -----------------------------------------------------------------------------
// Layers
// -----------------------------------------------------------------------------

function createEmptyTotals() {
  return {
    tapDamage: 0,
    dps: 0,
    
    // Multipliers (accumulated)
    globalDpsMult: 1,
    tapMult: 1,
    mineralMult: 1,
    
    // Crit
    critChance: 0,
    critMult: 2,

    // Meta Stats (Universal / Protocol effects)
    hpGrowthMult: 1,
    penaltyReducer: 0,
    ascendRewardMult: 1,
    idleDominanceMult: 1,
    startingPowerMult: 1,
    tapRatioMult: 1,
    bossTimerEff: 1,
    treasureChanceEff: 1,
    bossHpEff: 1,
    
    starlinkTagPowerAdd: 0,
    starlinkTagDropBonus: 0,
    
    anomalyChanceBonus: 0,
    anomalyFragmentMult: 1,
    
    bossDpsMult: 1,
    bossRewardMult: 1,
    
    milestoneEffectiveness: 1, // Manual Override Protocol
    comboBonusPerTap: 0, // Momentum Combo Core
    treasureChestChance: 0, // Geode Protocol
    
    // Skill Mods
    skillDurationBonusMs: {},
    skillCooldownMult: {}, // { skillId: multiplier } (starts empty, implies 1)
    skillValueBonus: {},
    
    // Modifiers
    zoneMonsterReducer: 0,
    idleDpsMult: 1, // Silent Observer

    breakdown: { miners: {} }
  };
}

// LAYER B: Universal Constants
function applyUniversalConstants(totals, constantsDef, ownedConstants) {
    if (!constantsDef) return;
    
    for (const c of constantsDef) {
        const lv = ownedConstants?.[c.id] || 0;
        if (lv <= 0) continue;
        const base = c.baseValue || 0;

        switch (c.type) {
            case "ascendRewardMultiplier": // Prime Continuum
                // 1 + (level^2 * base)
                totals.ascendRewardMult *= (1 + (Math.pow(lv, 2) * base));
                break;
            case "enemyHpGrowthReducer": // Graviton Law
                // 0.95^level (base=0.05 implies reduction logic)
                // JSON formula: 0.95^level. We assume baseValue is meant to be related or just hardcode if easier.
                // Formula in JSON: "0.95^level".
                totals.hpGrowthMult *= Math.pow(0.95, lv);
                break;
            case "idleDominance": // Eternal Drift
                // 1 + ((1.5^level - 1) * (base/0.30))
                const scale = base / 0.30;
                totals.idleDominanceMult *= (1 + ((Math.pow(1.5, lv) - 1) * scale));
                break;
            case "startingPowerBoost": // Singular Genesis
                totals.startingPowerMult *= (1 + (lv * base));
                break;
            case "clickDpsRatioShift": // Cosmic Inversion
                totals.tapRatioMult *= (1 + (lv * base));
                break;
            case "lateGameSoftCapReducer": // Last Equation
                // 1 - min(0.9, level * base) => Reduction
                // Store the raw deduction amount to apply later
                totals.penaltyReducer += Math.min(0.9, lv * base);
                break;
            case "bossTimerEffectiveness": // Chronal Margin
                totals.bossTimerEff *= (1 + (lv * base));
                break;
            case "treasureChanceEffectiveness": // Treasure Manifest
                totals.treasureChanceEff *= (1 + (lv * base));
                break;
            case "bossHpEffectiveness": // Kairic Dampener
                totals.bossHpEff *= (1 + (lv * base));
                break;
        }
    }
}

// LAYER C: Cosmic Protocols
function applyCosmicProtocols(totals, protocolsDef, ownedProtocols, stellarFragmentsSpent) {
    if (!protocolsDef) return;

    for (const p of protocolsDef) {
        const lv = ownedProtocols?.[p.id] || 0;
        if (lv <= 0) continue;
        const base = p.baseValue || 0;

        switch (p.type) {
            case "globalDpsMultiplier":
                totals.globalDpsMult += (lv * base); // Additive base %
                break;
            case "globalDpsMultiplier_perSpentSF": // Core Singularity
                // Approximation: linear cost -> spent = lv. 
                // Actual spent tracking is better but for now assume efficient spend
                totals.globalDpsMult += (lv * base);
                break;
            case "minerDpsMultiplier":
                totals.globalDpsMult += (lv * base); // Treating as global for now to simplify
                break;
            case "bossDpsMultiplier":
                totals.bossDpsMult += (lv * base);
                break;
            case "idleDpsMultiplier_piecewise":
                // Dark Matter Flow logic
                 if (p.piecewise) {
                     const { startPerLevel, minPerLevel, stepDownEveryLevels, stepDownAmount } = p.piecewise;
                     let totalPw = 0;
                     for (let i=1; i<=lv; i++) {
                         const steps = Math.floor((i - 1) / stepDownEveryLevels);
                         const val = Math.max(minPerLevel, startPerLevel - steps * stepDownAmount);
                         totalPw += val;
                     }
                     totals.globalDpsMult += totalPw; // Treating as global boost for Idle build
                 } else {
                     totals.globalDpsMult += (lv * base);
                 }
                break;
            case "tapMultiplier": // Photon Strike Matrix
                totals.tapMult += (lv * base);
                break;
            case "dpsToTapMilestoneEffectiveness": // Manual Override
                // Base 0.02. L=50 => 1 + 50*0.02 = 2.0. Cap 2.0.
                {
                    const rawEff = 1 + (lv * base);
                    const cap = p.effectivenessCap || 999;
                    totals.milestoneEffectiveness = Math.min(cap, rawEff);
                }
                break;
            case "tapComboBonusPerTap": // Momentum Combo Core
                totals.comboBonusPerTap += (lv * base);
                break;
            case "critEnhancer_split": // Precision Lattice
                if (p.crit) {
                    totals.critChance += (lv * p.crit.critChanceAddPerLevel);
                    totals.critMult += (lv * p.crit.critMultAddPerLevel);
                }
                break;
            case "mineralMultiplier": // Astro Extraction Grid
                totals.mineralMult += (lv * base);
                break;
            case "bossRewardMultiplier": // Void Harvest
                totals.bossRewardMult += (lv * base);
                break;
            case "anomalyBossChanceBonus": // Anomaly Attunement
                totals.anomalyChanceBonus += (lv * base);
                break;
            case "anomalyFragmentRewardMultiplier_piecewise": // Anomaly Fragment Yield
                if (p.piecewise) {
                    const { startPerLevel, minPerLevel, stepDownEveryLevels, stepDownAmount } = p.piecewise;
                     let totalPw = 0;
                     for (let i=1; i<=lv; i++) {
                         const steps = Math.floor((i - 1) / stepDownEveryLevels);
                         const val = Math.max(minPerLevel, startPerLevel - steps * stepDownAmount);
                         totalPw += val;
                     }
                     totals.anomalyFragmentMult += totalPw;
                } else {
                    totals.anomalyFragmentMult += (lv * base);
                }
                break;
            case "starlinkTagPowerAdd": // Starlink Tag Amplifier
                totals.starlinkTagPowerAdd += (lv * base);
                break;
            case "starlinkTagDropBonus": // Starlink Tag Foundry
                totals.starlinkTagDropBonus += (lv * base);
                break;
            case "treasureChestChance": // Geode Hunter
                totals.treasureChestChance += (lv * base); // +5% -> 0.05
                break;
            case "skillDurationBonusMs":
                (p.targets || []).forEach(t => totals.skillDurationBonusMs[t] = (totals.skillDurationBonusMs[t]||0) + lv*base);
                break;
            case "skillCooldownReducer":
                // 1 - (1-base)^lv
                const reduction = Math.pow(1 - base, lv);
                (p.targets || []).forEach(t => totals.skillCooldownMult[t] = (totals.skillCooldownMult[t]||1) * reduction);
                break;
            case "skillValueBonus":
                (p.targets || []).forEach(t => totals.skillValueBonus[t] = (totals.skillValueBonus[t]||0) + lv*base);
                break;
            case "hpScalingReducer": // Reality Stabilizer
                totals.hpGrowthMult *= Math.pow(1 - base, lv);
                break;
            case "zoneMonsterReducer": // Warp Drive
                totals.zoneMonsterReducer += (lv * base);
                break;
            case "idleDpsMultiplier": // Silent Observer
                totals.idleDpsMult *= (1 + (lv * base));
                break;
        }
    }
}

// -----------------------------------------------------------------------------
// MAIN COMPUTATION
// -----------------------------------------------------------------------------
export function computeTotals({
  minersDef,
  ownedMiners,
  ownedSkills,
  // Meta
  universalConstantsLevels,
  cosmicProtocolLevels,
  constantsDef,
  protocolsDef,
  tagsByMinerId,
  // Other
  stellarFragmentsSpent,
  stellarFragments, // ✅ Passed in for passive DPS
  dpsToTapMilestonesUnlocked, // ✅ Progress
  mineralBonusActive, // ✅ Ad Bonus
}) {
    const totals = createEmptyTotals();

    // 1. Gather Modifiers First (Universal + Protocols) because they affect Base/Tags
    applyUniversalConstants(totals, constantsDef, universalConstantsLevels);
    applyCosmicProtocols(totals, protocolsDef, cosmicProtocolLevels, stellarFragmentsSpent);

    // 2. Base Layer (Miners + Passive Skills + Tags)
    // Calc Tag Power
    const baseTagPower = 0.50;
    const tagPower = baseTagPower + totals.starlinkTagPowerAdd;

    let baseDps = 0;
    let baseTap = 0;

    for (const m of minersDef || []) {
        const lvl = Math.max(0, Math.floor(toNum(ownedMiners?.[m.id], 0)));
        if (lvl <= 0) continue;

        // Base DPS/Tap
        let dps = baseDpsForMiner(m, lvl);
        let tap = baseTapForMiner(m, lvl);

        // Passive Skills (Miner Local)
        let dpsMul = 1;
        const purchasedMap = getPurchasedSkillMap(ownedSkills, m.id);
        for (const sk of m.skills || []) {
            if (!isSkillActive({ minerLevel: lvl, purchasedMap, skill: sk })) continue;
            
            if (sk.kind === 'dpsMultiplier') dpsMul *= (1 + sk.value);
            // Global passive skills
            if (sk.kind === 'globalDpsMultiplier') totals.globalDpsMult *= (1 + sk.value);
            if (sk.kind === 'tapMultiplier') totals.tapMult *= (1 + sk.value);
            if (sk.kind === 'mineralMultiplier') totals.mineralMult *= (1 + sk.value);
            if (sk.kind === 'critChance') totals.critChance += sk.value;
            if (sk.kind === 'critMultiplier') totals.critMult *= (1 + sk.value);
        }
        
        dps *= dpsMul;

        // Tags
        const tags = tagsByMinerId?.[m.id] || 0;
        if (tags > 0) {
            const tagMul = 1 + (tags * tagPower);
            dps *= tagMul;
            tap *= tagMul;
        }

        baseDps += dps;
        baseTap += tap;
        
        totals.breakdown.miners[m.id] = { dps, tap, tags };
    }
    
    // STARTING POWER BOOST (Singular Genesis)
    baseDps *= totals.startingPowerMult;
    baseTap *= totals.startingPowerMult; // Assuming it affects tap base too

    // ✅ PASSIVE FRAGMENT BONUS (10% per unspent fragment)
    // CH-style: +10% DPS per Soul. Additive or Multiplicative? 
    // Usually Base * (1 + Souls * 0.10) * Ancients...
    // We treat it as a separate Multiplier layer.
    const sfCount = toNum(stellarFragments || 0);
    if (sfCount > 0) {
        // Warning: Number overflow possible if SF > 1e300. 
        // But baseDps is also number. 
        const sfMult = 1 + (sfCount * 0.10);
        totals.globalDpsMult *= sfMult;
    }

    // 3. Apply Global Multipliers
    // DPS
    totals.dps = baseDps * totals.globalDpsMult;
    
    // Add DPS->Tap Conversion (Progressive Milestones)
    const unlockedCount = Object.keys(dpsToTapMilestonesUnlocked || {}).length;
    const ratioPerMilestoneBase = 0.005;
    const maxRatio = 0.035;

    // Step 1: Effectiveness (Calculated in modifiers, capped there)
    const effMult = totals.milestoneEffectiveness; // Default 1

    // Step 2: Compute Ratio
    // Cosmic Inversion also affects the ratio if present (tapRatioMult)
    let ratioUnclamped = unlockedCount * ratioPerMilestoneBase * effMult;
    
    // Apply Cosmic Inversion here if it's meant to scale the ratio further
    ratioUnclamped *= totals.tapRatioMult;

    let dpsToTapRatio = Math.min(maxRatio, ratioUnclamped);
    
    // Step 3: Convert DPS to Tap Base
    let tapBaseFromDps = totals.dps * dpsToTapRatio;
    
    // Step 4: Full Tap Damage Order
    // (MinerBase + DPS_Base) * Multipliers
    let totalBaseTap = baseTap + tapBaseFromDps;
    
    // Apply Multipliers
    totals.tapDamage = totalBaseTap * totals.tapMult;
    
    if (totals.tapDamage < 1) totals.tapDamage = 1;

    // ✅ Mineral Bonus (Ad)
    if (mineralBonusActive) {
        totals.mineralMult *= 2;
    }

    // Clamps
    if (totals.critChance > 0.75) totals.critChance = 0.75;
    
    return totals;
}
