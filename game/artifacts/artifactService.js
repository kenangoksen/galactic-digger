import { D } from "../bn";
import { ARTIFACT_AFFIX, ARTIFACT_RARITY, RARITY_BASE_COST, RARITY_MULTIPLIERS, RARITY_WEIGHTS } from "./artifactTypes";

// ---- RNG HELPERS ----
function rollRarity() {
  const r = Math.random();
  let cumulative = 0;
  
  // Order matters: Common -> Transcendent
  // Weights should sum to 1 ideally, but we check cumulative.
  const rarities = [
    { type: ARTIFACT_RARITY.COMMON, weight: RARITY_WEIGHTS.COMMON },
    { type: ARTIFACT_RARITY.UNCOMMON, weight: RARITY_WEIGHTS.UNCOMMON },
    { type: ARTIFACT_RARITY.RARE, weight: RARITY_WEIGHTS.RARE },
    { type: ARTIFACT_RARITY.EPIC, weight: RARITY_WEIGHTS.EPIC },
    { type: ARTIFACT_RARITY.FABLED, weight: RARITY_WEIGHTS.FABLED },
    { type: ARTIFACT_RARITY.MYTHICAL, weight: RARITY_WEIGHTS.MYTHICAL },
    { type: ARTIFACT_RARITY.LEGENDARY, weight: RARITY_WEIGHTS.LEGENDARY },
    { type: ARTIFACT_RARITY.TRANSCENDENT, weight: RARITY_WEIGHTS.TRANSCENDENT },
  ];

  for (const item of rarities) {
    cumulative += item.weight;
    if (r <= cumulative) return item.type;
  }
  return ARTIFACT_RARITY.COMMON;
}

function rollAffixCount() {
  const r = Math.random();
  if (r < 0.33) return 1;
  if (r < 0.61) return 2; // 0.33 + 0.28
  if (r < 0.83) return 3; // 0.61 + 0.22
  return 4;
}

// Base Scalars for Affix Types (at Level 1)
const AFFIX_SCALARS = {
  [ARTIFACT_AFFIX.ANCIENT_POWER_ALL]: 0.05, // % Rebalanced: 5%
  [ARTIFACT_AFFIX.IDLE_DPS]: 0.10, // % Rebalanced: 10%
  [ARTIFACT_AFFIX.CLICK_DAMAGE]: 0.10, // % Rebalanced: 10%
  [ARTIFACT_AFFIX.OFFLINE_EARNINGS]: 0.05, // % Rebalanced: 5%
  [ARTIFACT_AFFIX.CRIT_CHANCE]: 0.002, // % Rebalanced: 0.2%
  [ARTIFACT_AFFIX.SHARD_FIND]: 0.0005, // % Rebalanced: 0.05%
};

function rollAffixes(count, rarity, level) {
  const types = Object.values(ARTIFACT_AFFIX);
  const picked = [];
  const result = [];
  
  const rarityMult = RARITY_MULTIPLIERS[rarity] || 1;

  for (let i = 0; i < count; i++) {
    // Pick unique type if possible
    let type;
    const available = types.filter(t => !picked.includes(t));
    if (available.length > 0) {
        type = available[Math.floor(Math.random() * available.length)];
    } else {
        type = types[Math.floor(Math.random() * types.length)];
    }
    picked.push(type);

    // Calc Value
    // Base * Rarity * Level * Variance
    const baseScalar = AFFIX_SCALARS[type] || 0.1;
    const variance = 0.8 + Math.random() * 0.4; // 0.8 - 1.2
    
    let rawValue = baseScalar * rarityMult * Math.max(1, level) * variance;
    
    // Formatting/Rounding
    if (type === ARTIFACT_AFFIX.SHARD_FIND) {
        // Shard find should be very low. Cap?
        // 0.02 * Mult similar to others.
        // It's percentage.
    }
    
    result.push({
        type,
        value: rawValue.toFixed(4) // Store as string with precision
    });
  }
  return result;
}

// ---- FACTORY ----
export function createArtifact(bestZone) {
  const level = Math.floor(Math.max(1, bestZone) / 25) || 1;
  const rarity = rollRarity();
  const affixCount = rollAffixCount();
  const affixes = rollAffixes(affixCount, rarity, level);

  return {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    rarity,
    level,
    // upgradeLevel removed, using unified level
    affixes,
    createdAt: Date.now(),
  };
}

// ---- MATH ----
export function calculateSalvageValue(artifact) {
  const mult = RARITY_MULTIPLIERS[artifact.rarity] || 1;
  // Formula: multiplier * level (simple)
  return Math.floor(mult * artifact.level);
}

export function calculateUpgradeCost(artifact) {
  const base = (artifact.level * (RARITY_BASE_COST[artifact.rarity] || 5));
  // Cost = Base * (1.15 ^ level) -- flatter curve since level is main stat
  const cost = base * Math.pow(1.15, artifact.level);
  return D(Math.floor(cost));
}

export function getArtifactEffectiveValues(artifact) {
  // Returns affixes based directly on current values (which are already scaled by creation level)
  // BUT we need to scale them if level increased via upgrade.
  // The 'affixes' array has the BASE values calculated at creation? 
  // Wait, rollAffixes used `level`. If we upgrade `level`, we should re-calculate?
  // Or simpler: The stored values ARE the effective values.
  // When we upgrade, we should MUTATE the values or apply a multiplier relative to creation?
  // To keep it simple and stateless: 
  // Let's say stored values are "Base at Level 1". Then we mult by Level.
  // BUT `rollAffixes` baked the level in: `baseScalar * rarityMult * level`.
  
  // PROBLEM: If we upgrade `level`, the stored `affixes[].value` doesn't change automatically.
  // OPTION A: Reroll values on upgrade? No, preserves variance.
  // OPTION B: Store `baseValue` (level 1 equiv) and multiply dynamically.
  // OPTION C: Store `currentValue` and multiply by `(newLevel / oldLevel)` on upgrade.
  
  // Let's go with OPTION C logic but applied in the REDUCER.
  // Here we just return what is stored, assuming the storage is always up to date.
  
  // HOWEVER, for backward compatibility or ease, let's assume `artifact.affixes` contains current effective values.
  return artifact.affixes;
}

export function getArtifactBonuses(activeArtifacts) {
  const bonuses = {};
  
  if (!activeArtifacts || activeArtifacts.length === 0) return bonuses;
  
  for (const art of activeArtifacts) {
      const effects = getArtifactEffectiveValues(art);
      for (const eff of effects) {
          if (!bonuses[eff.type]) bonuses[eff.type] = D(0);
          bonuses[eff.type] = bonuses[eff.type].add(eff.value);
      }
  }
  return bonuses;
}
