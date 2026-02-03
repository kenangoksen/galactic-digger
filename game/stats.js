
/**
 * game/stats.js
 * Definitions for Game Statistics
 */

export const STAT_CATEGORIES = {
  LIFETIME: "A) Lifetime Statistics",
  REWIND: "B) This Rewind",
  SESSION: "C) This Session",
};

export const DEFAULT_STATS = {
  // A) Lifetime Statistics
  lifetime: {
    // A1) Progress
    totalRewinds: 0,
    highestSector: 1,
    totalSectorsCleared: 0,
    totalBossSectorsReached: 0,
    totalBossesSpawned: 0,
    totalBossesKilled: 0,
    totalBossesFailed: 0,
    totalAnomalyBossesSpawned: 0,
    totalAnomalyBossesKilled: 0,
    totalMonstersKilled: 0,

    // A2) Time
    totalTimePlayed: 0, // ms
    totalTimeInCombat: 0, // ms
    totalTimeOffline: 0, // ms
    longestRewindDuration: 0, // ms
    shortestRewindDuration: 0, // ms (0 means none yet)

    // A3) Damage (Stored as Strings for Decimal)
    totalDamage: "0",
    totalTapDamage: "0",
    totalDpsDamage: "0",
    highestTapHit: "0",
    highestDps: "0", // peak
    highestTotalDps: "0", // combined
    totalCriticalTaps: 0,
    peakCriticalTapHit: "0",
    totalOverkillDamage: "0",

    // A4) Active Play
    totalTaps: 0,
    peakTapsPerSecond: 0,
    longestTapStreak: 0,
    totalTapStreakResets: 0,
    totalManualBossKills: 0,

    // A5) Economy
    totalGoldEarned: "0",
    totalGoldSpent: "0",
    highestGoldOwned: "0",
    goldEarnedFromTap: "0",
    goldEarnedFromDps: "0",
    goldEarnedFromRewards: "0",
    goldEarnedOther: "0",
    totalPurchasesCount: 0,
    biggestSinglePurchase: "0",
    biggestSingleLoot: "0",

    // A6) Stellar Fragments
    totalStellarFragmentsEarned: "0", // BN just in case
    totalStellarFragmentsSpent: "0",
    highestStellarFragmentsOwned: "0",
    totalRewindsWithGain: 0,
    biggestSfGainOneRewind: "0",
    totalAnomalySfEarned: "0",
    totalProgressSfEarned: "0",

    // A7) Progression Objects
    totalMinersUnlocked: 0,
    totalMinersPurchased: 0,
    highestMinerLevel: 0,
    totalMinerLevels: 0,
    totalSkillsPurchased: 0,
    totalSkillLevels: 0,
    
    // A9) System
    totalSaves: 0,
    totalLoads: 0,
    firstPlayDate: 0, // timestamp
    lastPlayDate: 0,
  },

  // B) This Rewind Statistics (Resets on Prestige)
  thisRewind: {
    startTime: 0, // Date.now()
    
    // B1) Progress
    rewindIndex: 0, // 0-based count
    highestSector: 1,
    sectorsCleared: 0,
    bossesKilled: 0,
    bossesFailed: 0,
    anomalyBossesKilled: 0,
    monstersKilled: 0,

    // B2) Time
    timePlayed: 0,
    timeOffline: 0,

    // B3) Damage
    damageAll: "0",
    damageTap: "0",
    damageDps: "0",
    highestTapHit: "0",
    highestDps: "0",
    criticalTaps: 0,
    peakCritTapHit: "0",

    // B4) Active
    totalTaps: 0,
    peakTapsPerSecond: 0,
    longestTapStreak: 0,

    // B5) Economy
    goldEarned: "0",
    goldSpent: "0",
    highestGoldOwned: "0",
    
    // B6) SF
    sfGained: "0",
    sfSpent: "0",
    sfFromAnomalies: "0",
    sfFromProgress: "0",
  },
  
  // C) This Session (Resets on App Start - Not persisted usually, but structure helps)
  thisSession: {
    startTime: 0,
    totalTaps: 0,
    damageAll: "0",
    goldEarned: "0",
    bossesKilled: 0,
    anomalyKilled: 0,
  }
};

/**
 * Initializes stats object, merging with existing data to support schema updates.
 */
export function initStats(savedStats = {}) {
  const now = Date.now();
  
  // Deep merge helper or simple spread for top levels
  const merged = {
    lifetime: { ...DEFAULT_STATS.lifetime, ...(savedStats.lifetime || {}) },
    thisRewind: { ...DEFAULT_STATS.thisRewind, ...(savedStats.thisRewind || {}) },
    thisSession: { ...DEFAULT_STATS.thisSession }, // Always reset session
  };

  // Init dates if new
  if (!merged.lifetime.firstPlayDate) merged.lifetime.firstPlayDate = now;
  merged.lifetime.lastPlayDate = now;
  
  // Init session
  merged.thisSession.startTime = now;
  
  // Init rewind if missing (first run)
  if (!merged.thisRewind.startTime) merged.thisRewind.startTime = now;

  return merged;
}
