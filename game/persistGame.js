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
    cosmicProtocols: eco?.cosmicProtocols || {},
    // Starlink Persistence
    totalStarlinkTags: eco?.totalStarlinkTags || 0,
    tagsByMinerId: eco?.tagsByMinerId || {},
    lifetimeTagsEarned: eco?.lifetimeTagsEarned || 0,
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
    cosmicProtocols: eco.cosmicProtocols || {},
    // Starlink Rehydration
    totalStarlinkTags: Number(eco.totalStarlinkTags || 0),
    tagsByMinerId: eco.tagsByMinerId || {},
    lifetimeTagsEarned: Number(eco.lifetimeTagsEarned || 0),
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
