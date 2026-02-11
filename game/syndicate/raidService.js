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
export function calculateTitanHp(level) {
  const baseHp = 1e6; // 1 million base
  return Math.floor(baseHp * Math.pow(1.05, level));
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export function getDailyWeakness() {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now - new Date(now.getFullYear(), 0, 0)) / 86400000
  );
  return WEAKNESSES[dayOfYear % 3];
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
    createdAt: serverTimestamp(),
  };
  
  await setDoc(raidRef, raidData);
  return { id: todayKey, ...raidData };
}

export function calculateRaidTapDamage(user, titanWeakness) {
  const basePower = user.federationPower || 1; // was syndicatePower
  const specialtyLevel = user.specialtyLevel || 0; // was doctrineLevel
  
  // Base damage = federationPower * (1 + specialtyLevel * 0.05)
  let damage = basePower * (1 + specialtyLevel * 0.05);
  
  // Weakness bonus: +25% if specialty matches titan weakness
  const specialtyWeakness = SPECIALTY_WEAKNESS_MAP[user.specialty];
  if (specialtyWeakness === titanWeakness) {
    damage *= 1.25;
  }
  
  return Math.max(1, Math.floor(damage));
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
  
  // Calculate rewards
  const level = raid.titanLevel || 1;
  const contributed = raid.contributions?.[userId]?.damage > 0;
  
  const rewards = {
    titanFragments: contributed ? 50 * level : 20 * level, // was titanShards
    rubies: contributed ? 5 + level : 2 + Math.floor(level / 2),
  };
  
  // Mark claimed
  await updateDoc(raidRef, {
    rewardsClaimed: [...(raid.rewardsClaimed || []), userId],
  });
  
  // Add to user wallet
  const user = await getUserProfile(userId);
  await updateUserProfile(userId, {
    titanFragments: (user.titanFragments || 0) + rewards.titanFragments,
  });
  
  return rewards;
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

