// game/persistGame.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { D } from "./bn";

export const GAME_SAVE_KEY = "@galactic_digger:save:v1";
export const GAME_SAVE_VERSION = 1;

// ---- helpers ----
function safeParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export function serializeEco(eco) {
  return {
    minerals: eco?.minerals ? eco.minerals.toString() : "0",
    unlockedCount: Number(eco?.unlockedCount || 2),
    ownedMiners: eco?.ownedMiners || {},
    ownedSkills: eco?.ownedSkills || {},
    stellarFragments: eco?.stellarFragments ? eco.stellarFragments.toString() : "0",
    stellarFragmentsSpentLifetime: Number(eco?.stellarFragmentsSpentLifetime || 0), 
    cosmicProtocols: eco?.cosmicProtocols || {},
    // Summoning
    summonPool: eco?.summonPool || null,
    rerollCount: Number(eco?.rerollCount || 0),
    // Starlink Persistence
    totalStarlinkTags: eco?.totalStarlinkTags || 0,
    tagsByMinerId: eco?.tagsByMinerId || {},
    lifetimeTagsEarned: eco?.lifetimeTagsEarned || 0,
    // Universal Constants
    cosmicEssence: Number(eco?.cosmicEssence || 0),
    universalConstantsLevels: eco?.universalConstantsLevels || {},
    lifetimeEssence: Number(eco?.lifetimeEssence || 0), // (This is earned lifetime)
    spentEssence: Number(eco?.spentEssence || 0),
    // Milestones
    dpsToTapMilestonesUnlocked: eco?.dpsToTapMilestonesUnlocked || {},
    // SHARD SHOP
    shards: Number(eco?.shards || 0),
    droneCount: Number(eco?.droneCount || 0),
    activeDroneCount: Number(eco?.activeDroneCount || 0),
    // ARTIFACTS
    artifacts: eco?.artifacts ? {
       active: eco.artifacts.active || [],
       junk: eco.artifacts.junk || [],
       byId: eco.artifacts.byId || {},
       forgeCores: eco.artifacts.forgeCores ? eco.artifacts.forgeCores.toString() : "0",
    } : null,
    // EXPLORERS - Always save, even if empty
    explorers: {
       active: eco?.explorers?.active || [],
       byId: eco?.explorers?.byId || {},
       nextFreeSlotTime: eco?.explorers?.nextFreeSlotTime || null,
       totalExplorersLost: Number(eco?.explorers?.totalExplorersLost || 0),
       totalQuestsCompleted: Number(eco?.explorers?.totalQuestsCompleted || 0),
       unlocked: Boolean(eco?.explorers?.unlocked || false),
    },
    claimedAchievements: eco?.claimedAchievements || [],
    mineralBonusEndTime: Number(eco?.mineralBonusEndTime || 0),
    // DAILY QUESTS
    dailyQuest: eco?.dailyQuest ? {
      lastResetDate: eco.dailyQuest.lastResetDate || null,
      weeklyProgress: Number(eco.dailyQuest.weeklyProgress || 0),
      weeklyClaimed: Boolean(eco.dailyQuest.weeklyClaimed || false),
      activeQuests: eco.dailyQuest.activeQuests || [],
      rerollCount: Number(eco.dailyQuest.rerollCount || 0),
      weekNumber: Number(eco.dailyQuest.weekNumber || 0),
    } : null,
  };
}

export function normalizeLoadedEco(rawEco) {
  const eco = rawEco || {};
  return {
    minerals: D(eco.minerals || "0"),
    unlockedCount: Number(eco.unlockedCount || 2),
    ownedMiners: eco.ownedMiners || {},
    ownedSkills: eco.ownedSkills || {},
    stellarFragments: D(eco.stellarFragments || "0"),
    stellarFragmentsSpentLifetime: Number(eco.stellarFragmentsSpentLifetime || 0), 
    cosmicProtocols: eco.cosmicProtocols || {},
    summonPool: eco.summonPool || null,
    rerollCount: Number(eco.rerollCount || 0),
    // Starlink Rehydration
    totalStarlinkTags: Number(eco.totalStarlinkTags || 0),
    tagsByMinerId: eco.tagsByMinerId || {},
    lifetimeTagsEarned: Number(eco.lifetimeTagsEarned || 0),
    // Universal Constants Rehydration
    cosmicEssence: Number(eco.cosmicEssence || 0),
    universalConstantsLevels: eco.universalConstantsLevels || {},
    lifetimeEssence: Number(eco.lifetimeEssence || 0),
    spentEssence: Number(eco.spentEssence || 0),
    // Milestones
    dpsToTapMilestonesUnlocked: eco.dpsToTapMilestonesUnlocked || {},
    // SHARD SHOP
    shards: Number(eco.shards || 0),
    droneCount: Number(eco.droneCount || (eco.autoClickerActive ? 1 : 0)),
    activeDroneCount: Number(eco.activeDroneCount || 0),
    // ARTIFACTS
    artifacts: {
      active: eco.artifacts?.active || [],
      junk: eco.artifacts?.junk || [],
      byId: eco.artifacts?.byId || {},
      forgeCores: D(eco.artifacts?.forgeCores || "0"),
    },
    // EXPLORERS
    explorers: {
      active: eco.explorers?.active || [],
      byId: eco.explorers?.byId || {},
      nextFreeSlotTime: eco.explorers?.nextFreeSlotTime || null,
      totalExplorersLost: Number(eco.explorers?.totalExplorersLost || 0),
      totalQuestsCompleted: Number(eco.explorers?.totalQuestsCompleted || 0),
      unlocked: Boolean(eco.explorers?.unlocked || false),
    },
    claimedAchievements: eco.claimedAchievements || [],
    mineralBonusEndTime: Number(eco.mineralBonusEndTime || 0),
    // DAILY QUESTS
    dailyQuest: {
      lastResetDate: eco.dailyQuest?.lastResetDate || null,
      weeklyProgress: Number(eco.dailyQuest?.weeklyProgress || 0),
      weeklyClaimed: Boolean(eco.dailyQuest?.weeklyClaimed || false),
      activeQuests: eco.dailyQuest?.activeQuests || [],
      rerollCount: Number(eco.dailyQuest?.rerollCount || 0),
      weekNumber: Number(eco.dailyQuest?.weekNumber || 0),
    },
  };
}

// ---- API ----
// game/persistGame.js
  export async function loadGame() {
  const str = await AsyncStorage.getItem(GAME_SAVE_KEY);
  if (!str) return null;

  const data = safeParse(str);
  if (!data || data.version !== GAME_SAVE_VERSION) return null;

  // normalize
  return {
    version: data.version,
    savedAt: data.savedAt || Date.now(), // Fallback to now if missing
    progress: {
      mode: data?.progress?.mode || "progress",
      zone: Number(data?.progress?.zone || 1),
      step: Number(data?.progress?.step || 1),
      maxUnlockedZone: Number(data?.progress?.maxUnlockedZone || data?.progress?.zone || 1),
    },
    eco: normalizeLoadedEco(data.eco),
    stats: data.stats || {}, // ✅ Load Stats
  };
}

export async function saveGame(snapshot) {
  // snapshot zaten normalize edilmiş gelmeli
  const data = {
    ...snapshot,
    savedAt: Date.now(),
    // stats: snapshot.stats is expected to be passed in snapshot
  };
  await AsyncStorage.setItem(GAME_SAVE_KEY, JSON.stringify(data));
}

export async function clearGame() {
  await AsyncStorage.removeItem(GAME_SAVE_KEY);
}
