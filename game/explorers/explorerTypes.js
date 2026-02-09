// Explorer Rarity (CH ile aynı)
export const EXPLORER_RARITY = {
  COMMON: "COMMON",
  UNCOMMON: "UNCOMMON",
  RARE: "RARE",
  EPIC: "EPIC",
  FABLED: "FABLED",
  MYTHICAL: "MYTHICAL",
  LEGENDARY: "LEGENDARY",
  TRANSCENDENT: "TRANSCENDENT",
};

// Explorer Bonus Types (GD adaptasyonu)
export const EXPLORER_BONUS = {
  MINERAL_BONUS: "MINERAL_BONUS",       // Mineral quest rewards +%
  FRAGMENT_BONUS: "FRAGMENT_BONUS",     // Fragment quest rewards +%
  SHARD_BONUS: "SHARD_BONUS",           // Shard quest rewards +%
  PROTOCOL_ACTIVATION: "PROTOCOL_ACTIVATION", // Auto-activate protocol on quest complete
  RECRUITMENT_SPEED: "RECRUITMENT_SPEED",     // Recruitment quests -% duration
  EXTRA_LIVES: "EXTRA_LIVES",           // Reduces death risk
};

// Quest Types
export const QUEST_TYPE = {
  MINERAL: "MINERAL",           // Mineral Expedition
  FRAGMENT: "FRAGMENT",         // Fragment Hunt
  SHARD: "SHARD",               // Shard Discovery
  ARTIFACT: "ARTIFACT",         // Artifact Search (rare)
  PROTOCOL: "PROTOCOL",         // Protocol Boost
  RECRUIT: "RECRUIT",           // Scout Mission
};

// Rarity Weights (CH standardı)
export const RARITY_WEIGHTS = {
  COMMON: 0.45,
  UNCOMMON: 0.25,
  RARE: 0.14,
  EPIC: 0.08,
  FABLED: 0.04,
  MYTHICAL: 0.02,
  LEGENDARY: 0.015,
  TRANSCENDENT: 0.005,
};

// Rarity Multipliers (bonus değerleri için)
export const RARITY_MULTIPLIERS = {
  COMMON: 1.0,
  UNCOMMON: 1.25,
  RARE: 1.5,
  EPIC: 2.0,
  FABLED: 2.5,
  MYTHICAL: 3.0,
  LEGENDARY: 4.0,
  TRANSCENDENT: 5.0,
};

// Bonus Base Values (rarity ile çarpılır)
export const BONUS_BASE_VALUES = {
  MINERAL_BONUS: 0.10,        // +10% base
  FRAGMENT_BONUS: 0.10,       // +10% base
  SHARD_BONUS: 0.10,          // +10% base
  PROTOCOL_ACTIVATION: 1,     // Binary (0 or 1)
  RECRUITMENT_SPEED: 0.15,    // -15% duration base
  EXTRA_LIVES: 1,             // +1 life (rare, binary)
};

// Quest Duration Presets (milliseconds) - Fixed values
export const QUEST_DURATION_PRESETS = [
  5 * 60 * 1000,        // 5 minutes
  15 * 60 * 1000,       // 15 minutes
  30 * 60 * 1000,       // 30 minutes
  60 * 60 * 1000,       // 1 hour
  2 * 60 * 60 * 1000,   // 2 hours
  8 * 60 * 60 * 1000,   // 8 hours
  12 * 60 * 60 * 1000,  // 12 hours
  24 * 60 * 60 * 1000,  // 24 hours
  48 * 60 * 60 * 1000,  // 48 hours
];

// Quest Factor (CH-based) - Shorter quests are more efficient
export const QUEST_FACTORS = {
  [5 * 60 * 1000]: 3.0,         // 5 min
  [15 * 60 * 1000]: 2.5,        // 15 min
  [30 * 60 * 1000]: 2.0,        // 30 min
  [60 * 60 * 1000]: 1.5,        // 1 hour
  [2 * 60 * 60 * 1000]: 1.2,    // 2 hours
  [8 * 60 * 60 * 1000]: 0.8,    // 8 hours
  [12 * 60 * 60 * 1000]: 0.7,   // 12 hours
  [24 * 60 * 60 * 1000]: 0.5,   // 24 hours
  [48 * 60 * 60 * 1000]: 0.4,   // 48 hours
};

// Quest Duration Ranges (DEPRECATED - use QUEST_DURATION_PRESETS)
export const QUEST_DURATIONS = {
  MINERAL: { min: 5 * 60 * 1000, max: 48 * 60 * 60 * 1000 },      // 5m - 48h
  FRAGMENT: { min: 15 * 60 * 1000, max: 72 * 60 * 60 * 1000 },    // 15m - 72h
  SHARD: { min: 30 * 60 * 1000, max: 96 * 60 * 60 * 1000 },       // 30m - 96h (rare)
  ARTIFACT: { min: 60 * 60 * 1000, max: 48 * 60 * 60 * 1000 },    // 1h - 48h
  PROTOCOL: { min: 10 * 60 * 1000, max: 24 * 60 * 60 * 1000 },    // 10m - 24h
  RECRUIT: { min: 2 * 60 * 60 * 1000, max: 48 * 60 * 60 * 1000 }, // 2h - 48h
};

// Quest Type Weights (quest generation için)
export const QUEST_TYPE_WEIGHTS = {
  MINERAL: 0.30,
  FRAGMENT: 0.25,
  SHARD: 0.15,
  ARTIFACT: 0.10,
  PROTOCOL: 0.12,
  RECRUIT: 0.08,
};
