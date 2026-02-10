export const DAMAGE_CONFIG = {
  BASE_CLICK_DMG: 1,
  CLICK_SCALE: 1.05,
  TAP_FROM_DPS_RATIO: 0.035, // 3.5% of DPS converts to Click Damage
  
  // Streak
  STREAK_TIMEOUT_MS: 2000, 
  STREAK_CAP: 50, // 50x max combo
  STREAK_BONUS_PER_TAP: 0.1, // +10% per tap
  
  // Crit
  BASE_CRIT_CHANCE: 0.01,
  BASE_CRIT_MULT: 2.0,

  // Tap Power
  TAP_POWER_PER_LEVEL: 0.2 // (Assume 20% per level if we implemented levels later)
};

export const STARLINK_CONFIG = {
    TAG_POWER: 0.50, // +50% DPS per tag (Additive)
    DROP_CHANCE: 0.10, // 10% chance from Anomaly Bosses
    AUTO_REDISTRIBUTE_COST: 100, // Minerals? Or different currency? User said minerals or daily free.
    // Let's make it free for dev testing or cheap.
    COST_TYPE: "minerals",
    COST_AMOUNT: 1000
};
