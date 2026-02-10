// game/monsterCalc.js
// Monster HP, mineral drop, and prestige calculations.
// Extracted from useGameEngine.js for modularity.


// ---------------- Clicker Heroes-style monster HP ----------------
export function baseMonsterHp(zone, hpMult = 1) {
  const z = Math.max(1, Math.floor(zone));
  const rawHp = 10 * (z - 1 + Math.pow(1.55, z - 1));
  return Math.floor(rawHp * hpMult);
}

export function monsterHp(zone, step, hpMult = 1) {
  const hp = baseMonsterHp(zone, hpMult);
  const isBossPlanet = zone % 5 === 0;
  return isBossPlanet ? hp * 10 : hp;
}

export function monsterMineral(zone, step) {
  const z = Math.max(1, Math.floor(zone));
  const isBossPlanet = z % 5 === 0;
  const base = Math.floor(Math.pow(1.60255, z - 1));
  return Math.max(1, isBossPlanet ? base * 10 : base);
}

// ---------------- Stellar Rewind Calculation ----------------
// Formula: ((MaxZone - 50) / 10) ^ 1.5
export function calculateStellarRewindReward(maxZone, rewardMult = 1) {
  const z = Number(maxZone || 0);
  if (z < 60) return 0;
  const base = (z - 50) / 10;
  if (base <= 0) return 0;
  const reward = Math.pow(base, 1.5);
  return Math.floor(reward * rewardMult);
}

// ---------------- Protocol Costs ----------------
export function getNextUnlockCost(ownedCount = 0) {
    const costs = [1, 2, 4, 8, 16, 35, 70, 125, 250, 500];
    if (ownedCount < costs.length) return costs[ownedCount];
    return Math.floor(500 * Math.pow(1.2, ownedCount - costs.length + 1)); 
}
