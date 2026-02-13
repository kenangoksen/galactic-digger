// game/syndicate/raidService.js
// Void Titan Raid logic — daily boss fights for Federation
// Schema matched: federations, specialty (striker/technician/guardian), titanFragments

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { db, getCurrentUserId } from "../../firebase/firebaseConfig";
import { FEDERATIONS_COL, getUserProfile, updateUserProfile } from "./syndicateService";

// ─── Constants ───
const RAIDS_COL       = "raids"; // subcollection of federations
const MAX_FREE_ATTEMPTS = 3;
export const RAID_DURATION_MS = 30000; // 30 seconds

// Titan weakness types
export const WEAKNESSES = ["physical", "energy", "shield"];

// Specialty → weakness mapping
// Striker > Physical
// Technician > Energy
// Guardian > Shield
export const SPECIALTY_WEAKNESS_MAP = {
  striker: "physical",
  technician: "energy",
  guardian: "shield",
};

// ─── Titan HP Calculation ───
// ─── Titan HP Calculation ───
export function calculateTitanHp(level) {
  // Class-Based Balance: 50k Base, x2.0 per level
  const baseHp = 50000;
  return Math.floor(baseHp * Math.pow(2.0, level - 1));
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function getYesterdayKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function getDailyWeakness() {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now - new Date(now.getFullYear(), 0, 0)) / 86400000
  );
  return WEAKNESSES[dayOfYear % 3];
}

export function calculateRaidCost(level) {
  const reward = 200 + (level * 50);
  // Cost is ~40% of Reward, rounded to nearest 50
  // Lvl 1: Reward 250 -> Cost 100
  // Lvl 10: Reward 700 -> Cost 300
  return Math.round((reward * 0.4) / 50) * 50;
}

// ─── Raid Functions ───

export async function getTodaysRaid(federationId) {
  const todayKey = getTodayKey();
  const raidRef = doc(db, FEDERATIONS_COL, federationId, RAIDS_COL, todayKey);
  const raidSnap = await getDoc(raidRef);
  
  if (raidSnap.exists()) {
    return { id: raidSnap.id, ...raidSnap.data() };
  }
  
  // Auto-create today's raid
  const fedSnap = await getDoc(doc(db, FEDERATIONS_COL, federationId));
  if (!fedSnap.exists()) throw new Error("Federation not found");
  
  const fedData = fedSnap.data();
  const titanLevel = fedData.titanLevel || 1;
  const weakness = getDailyWeakness();
  
  const raidData = {
    date: todayKey,
    titanLevel,
    titanHp: calculateTitanHp(titanLevel),
    titanWeakness: weakness,
    totalDamage: 0,
    defeated: false,
    contributions: {},
    rewardsClaimed: [],
    isBonus: false,
    createdAt: serverTimestamp(),
  };
  
  await setDoc(raidRef, raidData);
  return { id: todayKey, ...raidData };
}

export async function getYesterdaysRaid(federationId) {
  const yesterdayKey = getYesterdayKey();
  const raidRef = doc(db, FEDERATIONS_COL, federationId, RAIDS_COL, yesterdayKey);
  const raidSnap = await getDoc(raidRef);
  
  if (raidSnap.exists()) {
    return { id: raidSnap.id, ...raidSnap.data() };
  }
  return null;
}

export function calculateRaidTapDamage(user, titanWeakness) {
  const specialtyLevel = user.specialtyLevel || 0; // Default to 0
  
  // Class-Based Damage: 100 Base, x2.1 per Level
  // Decoupled from Main Game (federationPower removed)
  // Lvl 0: 100 dmg
  // Lvl 1: 210 dmg
  let damage = 100 * Math.pow(2.1, specialtyLevel);
  
  // Weakness bonus: +50% if specialty matches titan weakness (Buffed from 25%)
  const specialtyWeakness = SPECIALTY_WEAKNESS_MAP[user.specialty];
  if (specialtyWeakness === titanWeakness) {
    damage *= 1.5;
  }
  
  return Math.max(10, Math.floor(damage));
}

export async function canAttemptRaid(userId) {
  const user = await getUserProfile(userId);
  const todayKey = getTodayKey();
  
  if (user.lastRaidDate === todayKey) {
    return {
      canRaid: user.raidAttemptsToday < MAX_FREE_ATTEMPTS,
      attemptsUsed: user.raidAttemptsToday,
      maxAttempts: MAX_FREE_ATTEMPTS,
    };
  }
  
  return { canRaid: true, attemptsUsed: 0, maxAttempts: MAX_FREE_ATTEMPTS };
}

export async function submitRaidDamage(federationId, tapCount) {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  
  const user = await getUserProfile(userId);
  if (!user) throw new Error("User not found");
  if (user.federationId !== federationId) throw new Error("Not in this federation");
  
  // Check attempts
  const todayKey = getTodayKey();
  let attemptsToday = user.raidAttemptsToday || 0;
  if (user.lastRaidDate === todayKey) {
    if (attemptsToday >= MAX_FREE_ATTEMPTS) {
      throw new Error("No attempts remaining");
    }
  } else {
    attemptsToday = 0;
  }
  
  // Get today's raid
  const raid = await getTodaysRaid(federationId);
  if (raid.defeated) throw new Error("Titan already defeated today");
  
  // Calculate damage
  const damagePerTap = calculateRaidTapDamage(user, raid.titanWeakness);
  const clampedTaps = Math.min(tapCount, 500);
  const personalDamage = damagePerTap * clampedTaps;
  
  // Update raid
  const raidRef = doc(db, FEDERATIONS_COL, federationId, RAIDS_COL, todayKey);
  const existingDamage = raid.contributions?.[userId]?.damage || 0;
  const existingAttempts = raid.contributions?.[userId]?.attempts || 0;
  
  const newTotalDamage = raid.totalDamage + personalDamage;
  const titanDefeated = newTotalDamage >= raid.titanHp;
  
  await updateDoc(raidRef, {
    totalDamage: newTotalDamage,
    defeated: titanDefeated,
    [`contributions.${userId}`]: {
      damage: existingDamage + personalDamage,
      attempts: existingAttempts + 1,
      displayName: user.displayName,
    },
  });
  
  // Update user
  await updateUserProfile(userId, {
    lastRaidDate: todayKey,
    raidAttemptsToday: attemptsToday + 1,
  });
  
  // Titan Defeated Logic
  if (titanDefeated) {
    const fedRef = doc(db, FEDERATIONS_COL, federationId);
    const fedSnap = await getDoc(fedRef);
    const fedData = fedSnap.data();
    
    await updateDoc(fedRef, {
      titanLevel: (raid.titanLevel || 1) + 1,
      totalTitansKilled: (fedData.totalTitansKilled || 0) + 1,
    });
  }
  
  return {
    personalDamage,
    totalDamage: newTotalDamage,
    titanHp: raid.titanHp,
    titanDefeated,
    attemptsRemaining: MAX_FREE_ATTEMPTS - (attemptsToday + 1),
  };
}

export async function claimRaidReward(federationId) {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  
  const todayKey = getTodayKey();
  const raidRef = doc(db, FEDERATIONS_COL, federationId, RAIDS_COL, todayKey);
  const raidSnap = await getDoc(raidRef);
  
  if (!raidSnap.exists()) throw new Error("No raid today");
  const raid = raidSnap.data();
  
  if (!raid.defeated) throw new Error("Titan not yet defeated");
  if (raid.rewardsClaimed?.includes(userId)) throw new Error("Already claimed");
  
  // Calculate rewards (Exponential Scale)
  const level = raid.titanLevel || 1;
  const contributed = raid.contributions?.[userId]?.damage > 0;
  
  // Base 50 Fragments, x1.6 per Level
  const baseReward = 50 * Math.pow(1.6, level - 1);
  const fragmentReward = Math.floor(contributed ? baseReward : baseReward * 0.1); // 10% if leeched
  
  // Shards: Buffed to make paid attempts (100s) profitable
  // Lvl 1: 250 Shards
  // Lvl 5: 450 Shards
  const shardReward = contributed ? (200 + level * 50) : (20 + level * 5);

  const rewards = {
    titanFragments: fragmentReward, 
    shards: shardReward,
  };
  
  // Mark claimed
  await updateDoc(raidRef, {
    rewardsClaimed: [...(raid.rewardsClaimed || []), userId],
  });
  
  // Add to user wallet
  const user = await getUserProfile(userId);
  await updateUserProfile(userId, {
    titanFragments: (user.titanFragments || 0) + rewards.titanFragments,
    shards: (user.shards || 0) + rewards.shards,
  });
  
  return rewards;
}

export async function buyBonusFight(federationId) {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");

  const todayKey = getTodayKey();
  const raidRef = doc(db, FEDERATIONS_COL, federationId, RAIDS_COL, todayKey);
  const raidSnap = await getDoc(raidRef);
  
  if (!raidSnap.exists()) throw new Error("No raid today");
  const raid = raidSnap.data();

  if (!raid.defeated) throw new Error("Current Titan must be defeated first");
  if (raid.isBonus) throw new Error("Bonus fight already active or completed");

  const level = raid.titanLevel || 1;
  const cost = 100 * level + 400;

  // REFACTOR: Shard check is now handled client-side (Local Eco) to match Shop balance.
  // We trust the client has verified funds and will deduct them locally.
  // This avoids sync issues between Firestore and Local State.

  // Reset Raid for Bonus Fight
  // We keep the SAME level, but reset damage and contributions
  await updateDoc(raidRef, {
    defeated: false,
    totalDamage: 0,
    contributions: {}, // Reset everyone's damage
    rewardsClaimed: [], // Allow claiming rewards again
    isBonus: true,      // Mark as bonus
  });

  return { success: true, cost };
}

export async function debugResetRaid(federationId) {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");

  const todayKey = getTodayKey();
  const raidRef = doc(db, FEDERATIONS_COL, federationId, RAIDS_COL, todayKey);
  
  // Fetch current to get level
  const snap = await getDoc(raidRef);
  const currentLevel = snap.exists() ? (snap.data().titanLevel || 1) : 1;

  // 1. Reset Raid AND Recalculate HP (Fix for stale 1k HP)
  await updateDoc(raidRef, {
      defeated: false,
      totalDamage: 0,
      titanHp: calculateTitanHp(currentLevel), // Force update with new formula
      contributions: {}, 
      rewardsClaimed: [],
      isBonus: false,
  });

  // 2. Reset My Attempts
  await updateUserProfile(userId, {
      lastRaidDate: todayKey,
      raidAttemptsToday: 0,
      // We don't deduct shards/fragments here, just reset logic state
  });

  return { success: true };
}

export async function getRaidLeaderboard(federationId) {
  const raid = await getTodaysRaid(federationId);
  
  if (!raid.contributions) return [];
  
  return Object.entries(raid.contributions)
    .map(([uid, data]) => ({
      userId: uid,
      displayName: data.displayName || `Digger_${uid.slice(0, 6)}`,
      damage: data.damage,
      attempts: data.attempts,
    }))
    .sort((a, b) => b.damage - a.damage);
}

