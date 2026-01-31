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
  };
}

export function normalizeLoadedEco(rawEco) {
  const eco = rawEco || {};
  return {
    minerals: D(eco.minerals || "0"),
    unlockedCount: Number(eco.unlockedCount || 2),
    ownedMiners: eco.ownedMiners || {},
    ownedSkills: eco.ownedSkills || {},
  };
}

// ---- API ----
export async function loadGame() {
  const str = await AsyncStorage.getItem(GAME_SAVE_KEY);
  if (!str) return null;

  const data = safeParse(str);
  if (!data || data.version !== GAME_SAVE_VERSION) return null;

  // normalize
  return {
    version: data.version,
    savedAt: data.savedAt || 0,
    progress: {
      mode: data?.progress?.mode || "progress",
      zone: Number(data?.progress?.zone || 1),
      step: Number(data?.progress?.step || 1),
    },
    eco: normalizeLoadedEco(data.eco),
  };
}

export async function saveGame(snapshot) {
  // snapshot zaten normalize edilmiş gelmeli
  await AsyncStorage.setItem(GAME_SAVE_KEY, JSON.stringify(snapshot));
}

export async function clearGame() {
  await AsyncStorage.removeItem(GAME_SAVE_KEY);
}
