import { D } from "../bn";
import {
    BONUS_BASE_VALUES,
    EXPLORER_BONUS,
    EXPLORER_RARITY,
    QUEST_TYPE,
    QUEST_TYPE_WEIGHTS,
    RARITY_MULTIPLIERS,
    RARITY_WEIGHTS
} from "./explorerTypes";

// ---- PROCEDURAL NAMING ----
const NAME_PREFIXES = [
  "Nova", "Stellar", "Quantum", "Nebula", "Cosmic", "Astro",
  "Void", "Pulsar", "Photon", "Quasar", "Zenith", "Eclipse",
  "Orion", "Vega", "Sirius", "Rigel", "Altair", "Polaris"
];

function generateExplorerName() {
  const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
  const suffix = Math.floor(Math.random() * 99) + 1; // 1-99
  return `${prefix}-${suffix}`;
}

// ---- RNG HELPERS ----
function rollRarity() {
  const r = Math.random();
  let cumulative = 0;
  
  const rarities = [
    { type: EXPLORER_RARITY.COMMON, weight: RARITY_WEIGHTS.COMMON },
    { type: EXPLORER_RARITY.UNCOMMON, weight: RARITY_WEIGHTS.UNCOMMON },
    { type: EXPLORER_RARITY.RARE, weight: RARITY_WEIGHTS.RARE },
    { type: EXPLORER_RARITY.EPIC, weight: RARITY_WEIGHTS.EPIC },
    { type: EXPLORER_RARITY.FABLED, weight: RARITY_WEIGHTS.FABLED },
    { type: EXPLORER_RARITY.MYTHICAL, weight: RARITY_WEIGHTS.MYTHICAL },
    { type: EXPLORER_RARITY.LEGENDARY, weight: RARITY_WEIGHTS.LEGENDARY },
    { type: EXPLORER_RARITY.TRANSCENDENT, weight: RARITY_WEIGHTS.TRANSCENDENT },
  ];

  for (const item of rarities) {
    cumulative += item.weight;
    if (r <= cumulative) return item.type;
  }
  return EXPLORER_RARITY.COMMON;
}

function rollBonusType() {
  const types = Object.values(EXPLORER_BONUS);
  // Extra Lives çok nadir olmalı
  const weights = {
    [EXPLORER_BONUS.MINERAL_BONUS]: 0.25,
    [EXPLORER_BONUS.FRAGMENT_BONUS]: 0.25,
    [EXPLORER_BONUS.SHARD_BONUS]: 0.20,
    [EXPLORER_BONUS.PROTOCOL_ACTIVATION]: 0.15,
    [EXPLORER_BONUS.RECRUITMENT_SPEED]: 0.10,
    [EXPLORER_BONUS.EXTRA_LIVES]: 0.05, // Çok nadir
  };

  const r = Math.random();
  let cumulative = 0;
  for (const type of types) {
    cumulative += weights[type];
    if (r <= cumulative) return type;
  }
  return EXPLORER_BONUS.MINERAL_BONUS;
}

function calculateBonusValue(bonusType, rarity) {
  const baseValue = BONUS_BASE_VALUES[bonusType];
  const rarityMult = RARITY_MULTIPLIERS[rarity];
  
  // Binary bonuslar için (Protocol Activation, Extra Lives)
  if (bonusType === EXPLORER_BONUS.PROTOCOL_ACTIVATION || bonusType === EXPLORER_BONUS.EXTRA_LIVES) {
    return baseValue; // 1 veya 0
  }
  
  // Percentage bonuslar
  return baseValue * rarityMult;
}

// ---- FACTORY ----
export function createExplorer() {
  const rarity = rollRarity();
  const bonusType = rollBonusType();
  const bonusValue = calculateBonusValue(bonusType, rarity);

  return {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    name: generateExplorerName(),
    rarity,
    level: 1,
    bonusType,
    bonusValue,
    extraLives: bonusType === EXPLORER_BONUS.EXTRA_LIVES ? 1 : 0,
    currentQuest: null,
    questStartTime: null,
    totalQuestTime: 0, // milliseconds
    createdAt: Date.now(),
    availableQuests: [], // Will be generated on first view (persists until reroll/completion)
  };
}

// ---- QUEST GENERATION ----
function rollQuestType() {
  const r = Math.random();
  let cumulative = 0;
  
  const types = [
    { type: QUEST_TYPE.MINERAL, weight: QUEST_TYPE_WEIGHTS.MINERAL },
    { type: QUEST_TYPE.FRAGMENT, weight: QUEST_TYPE_WEIGHTS.FRAGMENT },
    { type: QUEST_TYPE.SHARD, weight: QUEST_TYPE_WEIGHTS.SHARD },
    { type: QUEST_TYPE.ARTIFACT, weight: QUEST_TYPE_WEIGHTS.ARTIFACT },
    { type: QUEST_TYPE.PROTOCOL, weight: QUEST_TYPE_WEIGHTS.PROTOCOL },
    { type: QUEST_TYPE.RECRUIT, weight: QUEST_TYPE_WEIGHTS.RECRUIT },
  ];

  for (const item of types) {
    cumulative += item.weight;
    if (r <= cumulative) return item.type;
  }
  return QUEST_TYPE.MINERAL;
}

function rollQuestDuration(questType) {
  // Use fixed preset durations instead of random ranges
  const { QUEST_DURATION_PRESETS } = require("./explorerTypes");
  const randomIndex = Math.floor(Math.random() * QUEST_DURATION_PRESETS.length);
  return QUEST_DURATION_PRESETS[randomIndex];
}

function calculateQuestReward(questType, duration, explorerLevel, explorerBonus, currentZone) {
  const { QUEST_FACTORS } = require("./explorerTypes");
  
  const durationDays = duration / (24 * 60 * 60 * 1000);
  const questFactor = QUEST_FACTORS[duration] || 1.0;
  const bonusMultiplier = 1 + (explorerBonus || 0);
  const levelMultiplier = explorerLevel;
  
  let baseReward;
  
  switch (questType) {
    case QUEST_TYPE.MINERAL:
      // CH Formula: 3 × TimelapseGold × (1+bonus%) × level × days × questFactor
      // TimelapseGold = ~1 hour worth of minerals at current zone
      const mineralsPerSecond = Math.pow(currentZone, 1.5) * 10; // Rough estimate
      const timelapseGold = mineralsPerSecond * 3600; // 1 hour worth
      baseReward = D(3 * timelapseGold);
      return baseReward.mul(bonusMultiplier).mul(levelMultiplier).mul(durationDays).mul(questFactor).floor();
      
    case QUEST_TYPE.FRAGMENT:
      // CH Formula: 0.1 × QuickAscension × (1+bonus%) × level × days × questFactor
      // QuickAscension = Stellar Rewind reward (rough estimate)
      const quickAscension = Math.pow(currentZone / 10, 2); // Rough estimate
      baseReward = D(0.1 * quickAscension);
      return baseReward.mul(bonusMultiplier).mul(levelMultiplier).mul(durationDays).mul(questFactor).ceil();
      
    case QUEST_TYPE.SHARD:
      // Custom formula (no CH equivalent)
      const baseShard = Math.max(1, Math.floor(currentZone / 20)); // 1 per 20 zones
      baseReward = D(baseShard);
      return baseReward.mul(bonusMultiplier).mul(levelMultiplier).mul(durationDays).mul(questFactor).ceil();
      
    case QUEST_TYPE.ARTIFACT:
      // Artifact chance (0-1), scaled by duration
      const baseChance = 0.15 + (durationDays * 0.10); // 15% + 10% per day
      return D(Math.min(0.50, baseChance)); // Cap at 50%
      
    case QUEST_TYPE.PROTOCOL:
      return D(1); // Binary
      
    case QUEST_TYPE.RECRUIT:
      return D(1); // Binary
      
    default:
      return D(0);
  }
}

function calculateDeathRisk(duration, extraLives) {
  const durationHours = duration / (60 * 60 * 1000);
  const baseRisk = (durationHours / 24) * 0.20; // 20% per 24h
  const livesReduction = extraLives * 0.30; // -30% per extra life
  return Math.max(0, baseRisk * (1 - livesReduction));
}

export function generateQuests(explorer, currentZone) {
  const quests = [];
  
  // Get explorer's bonus for this quest type
  const getExplorerBonus = (questType) => {
    if (explorer.bonusType === "MINERAL_BONUS" && questType === QUEST_TYPE.MINERAL) {
      return explorer.bonusValue;
    }
    if (explorer.bonusType === "FRAGMENT_BONUS" && questType === QUEST_TYPE.FRAGMENT) {
      return explorer.bonusValue;
    }
    if (explorer.bonusType === "SHARD_BONUS" && questType === QUEST_TYPE.SHARD) {
      return explorer.bonusValue;
    }
    return 0;
  };
  
  for (let i = 0; i < 4; i++) {
    const type = rollQuestType();
    const duration = rollQuestDuration(type);
    const explorerBonus = getExplorerBonus(type);
    const reward = calculateQuestReward(type, duration, explorer.level, explorerBonus, currentZone);
    const deathRisk = calculateDeathRisk(duration, explorer.extraLives);
    
    quests.push({
      id: `quest_${Date.now()}_${i}`,
      type,
      duration,
      baseReward: reward,
      deathRisk,
    });
  }
  
  return quests;
}

// ---- QUEST COMPLETION ----
export function rollQuestSurvival(deathRisk) {
  return Math.random() > deathRisk;
}

export function calculateLevelGain(questDuration, currentTotalTime) {
  const newTotalTime = currentTotalTime + questDuration;
  const oldLevel = Math.floor(currentTotalTime / (24 * 60 * 60 * 1000)) + 1;
  const newLevel = Math.floor(newTotalTime / (24 * 60 * 60 * 1000)) + 1;
  return { newLevel, newTotalTime };
}

// ---- REVIVE COST ----
export function calculateReviveCost(explorerLevel) {
  return D(12 + explorerLevel * 4);
}

// ---- BURY COOLDOWN ----
export const BURY_COOLDOWN = 8 * 60 * 60 * 1000; // 8 hours

// ---- PURCHASE COST ----
export const EXPLORER_PURCHASE_COST = D(40); // 40 Shards
