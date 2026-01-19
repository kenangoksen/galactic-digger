// game/monsters.js

// ---------------- Clicker Heroes-style monster HP ----------------
// CH early formula (common): floor(10 * ((z-1) + 1.55^(z-1)))
export function baseMonsterHp(zone) {
  const z = Math.max(1, Math.floor(zone));
  return Math.floor(10 * (z - 1 + Math.pow(1.55, z - 1)));
}

export function monsterHp(zone, step) {
  const hp = baseMonsterHp(zone);
  const isBoss = zone % 5 === 0 && step === 10;
  return isBoss ? hp * 10 : hp;
}

// CH-like gold worth feeling (simple growing curve).
export function monsterMineral(zone, step) {
  const z = Math.max(1, Math.floor(zone));
  const isBoss = z % 5 === 0 && step === 10;
  const base = Math.floor(Math.pow(1.60255, z - 1));
  return Math.max(1, isBoss ? base * 10 : base);
}
