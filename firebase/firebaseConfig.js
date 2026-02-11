// firebase/firebaseConfig.js
// Firebase initialization for Galactic Digger (v10 — Expo uyumlu)
// NOW USING: LOCAL ID (No Firebase Auth) for guest access

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAkyhagqA4FGBvZI_Q7MkU4m2GTS3xqSn0",
  authDomain: "galacticdigger-5caca.firebaseapp.com",
  projectId: "galacticdigger-5caca",
  storageBucket: "galacticdigger-5caca.firebasestorage.app",
  messagingSenderId: "116127623883",
  appId: "1:116127623883:web:632e1b9ce533c77464894e",
  measurementId: "G-SMV8MJWRY5",
};

// Global App Instance
let app;

try {
  if (getApps().length > 0) {
    app = getApp();
  } else {
    app = initializeApp(firebaseConfig);
  }
} catch (error) {
  console.error("Firebase Config Error:", error);
}

const db = getFirestore(app);

// ─── Local ID System (No Auth) ───
const LOCAL_USER_KEY = "GD_LOCAL_USER_ID";
let cachedUserId = null;

function generateId() {
  return 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

/**
 * Get or create a local persistent User ID.
 * Replaces ensureAuth().
 */
export async function ensureAuth() {
  if (cachedUserId) return { uid: cachedUserId };

  try {
    const stored = await AsyncStorage.getItem(LOCAL_USER_KEY);
    if (stored) {
      cachedUserId = stored;
    } else {
      cachedUserId = generateId();
      await AsyncStorage.setItem(LOCAL_USER_KEY, cachedUserId);
    }
    return { uid: cachedUserId };
  } catch (e) {
    console.error("Local ID Error:", e);
    // Fallback/Guest
    cachedUserId = generateId();
    return { uid: cachedUserId };
  }
}

/**
 * Synchronous get if available
 */
export function getCurrentUserId() {
  return cachedUserId;
}

// Initialize ID immediately if possible
ensureAuth();

export { app, db };
