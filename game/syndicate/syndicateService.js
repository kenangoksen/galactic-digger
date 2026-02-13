// game/syndicate/syndicateService.js
// Federation (Clan) CRUD operations via Firestore
// Conforms to user schema: federations, specialty, titanFragments, federationPower

import {
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    increment,
    limit,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from "firebase/firestore";
import { db, getCurrentUserId } from "../../firebase/firebaseConfig";

// ─── Constants ───
export const FEDERATIONS_COL = "federations"; // was syndicates
const USERS_COL        = "users";
const MAX_MEMBERS      = 10;

// ─── Helpers ───
function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── User Profile ───

export async function ensureUserProfile(userId, displayName) {
  const ref = doc(db, USERS_COL, userId);
  const snap = await getDoc(ref);
  
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: displayName || `Digger_${userId.slice(0, 6)}`,
      federationId: null,   // was syndicateId
      specialty: null,      // "striker" | "technician" | "guardian" (was doctrine)
      specialtyLevel: 0,    // was doctrineLevel
      titanFragments: 0,    // was titanShards
      federationPower: 0,   // lifetime stellar fragments
      lastRaidDate: null,
      raidAttemptsToday: 0,
      createdAt: serverTimestamp(),
    });
  }
  
  return (await getDoc(ref)).data();
}

export async function getUserProfile(userId) {
  const snap = await getDoc(doc(db, USERS_COL, userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateUserProfile(userId, fields) {
  await updateDoc(doc(db, USERS_COL, userId), fields);
}

// ─── Federation CRUD ───

export async function createFederation(name) {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  
  // Check user not already in a federation
  const user = await getUserProfile(userId);
  if (user?.federationId) throw new Error("Already in a federation");
  
  const inviteCode = generateInviteCode();
  const fedRef = doc(collection(db, FEDERATIONS_COL));
  
  await setDoc(fedRef, {
    name: name.trim(),
    name_lower: name.trim().toLowerCase(), // For case-insensitive search
    leaderId: userId,
    inviteCode,
    memberCount: 1,
    memberIds: [userId],
    titanLevel: 1,
    totalTitansKilled: 0,
    createdAt: serverTimestamp(),
  });
  
  // Update user
  await updateUserProfile(userId, { federationId: fedRef.id });
  
  return { id: fedRef.id, inviteCode };
}

export async function joinFederationByCode(inviteCode) {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  
  const user = await getUserProfile(userId);
  if (user?.federationId) throw new Error("Already in a federation");
  
  // Find federation by invite code
  const q = query(
    collection(db, FEDERATIONS_COL),
    where("inviteCode", "==", inviteCode.toUpperCase()),
    limit(1)
  );
  const snap = await getDocs(q);
  
  if (snap.empty) throw new Error("Federation not found");
  
  const fedDoc = snap.docs[0];
  const fedData = fedDoc.data();
  
  if (fedData.memberIds.length >= MAX_MEMBERS) throw new Error("Federation is full");
  
  // Add member
  await updateDoc(fedDoc.ref, {
    memberIds: arrayUnion(userId),
    memberCount: increment(1),
  });
  
  await updateUserProfile(userId, { federationId: fedDoc.id });
  
  return { id: fedDoc.id, name: fedData.name };
}

export async function leaveFederation() {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  
  const user = await getUserProfile(userId);
  if (!user?.federationId) throw new Error("Not in a federation");
  
  const fedRef = doc(db, FEDERATIONS_COL, user.federationId);
  const fedSnap = await getDoc(fedRef);
  
  if (!fedSnap.exists()) {
    await updateUserProfile(userId, { federationId: null });
    return;
  }
  
  const fedData = fedSnap.data();
  
  // If leader and last member, delete federation
  if (fedData.memberIds.length <= 1) {
    await deleteDoc(fedRef);
  } else {
    // Remove member
    await updateDoc(fedRef, {
      memberIds: arrayRemove(userId),
      memberCount: increment(-1),
      // Transfer leadership if leader leaves
      ...(fedData.leaderId === userId && {
        leaderId: fedData.memberIds.find((id) => id !== userId),
      }),
    });
  }
  
  await updateUserProfile(userId, { federationId: null });
}

export async function searchFederations(searchTerm, maxResults = 10) {
  const term = searchTerm.trim();
  if (!term) return [];

  // 1. Try search by Invite Code first (exact match)
  const codeQuery = query(
    collection(db, FEDERATIONS_COL),
    where("inviteCode", "==", term.toUpperCase()),
    limit(1)
  );
  const codeSnap = await getDocs(codeQuery);
  if (!codeSnap.empty) {
    return codeSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // 2. Fallback to Name Search (Case-Insensitive via name_lower)
  // Note: This requires existing records to have name_lower. 
  // New records will have it. Old records might not be found by this until updated.
  const nameQuery = query(
    collection(db, FEDERATIONS_COL),
    where("name_lower", ">=", term.toLowerCase()),
    where("name_lower", "<=", term.toLowerCase() + "\uf8ff"),
    limit(maxResults)
  );
  
  const nameSnap = await getDocs(nameQuery);
  return nameSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getFederation(federationId) {
  const snap = await getDoc(doc(db, FEDERATIONS_COL, federationId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getFederationMembers(federationId) {
  const fed = await getFederation(federationId);
  if (!fed) return [];
  
  const members = await Promise.all(
    fed.memberIds.map((uid) => getUserProfile(uid))
  );
  
  return members.filter(Boolean);
}

export function subscribeFederation(federationId, callback) {
  return onSnapshot(doc(db, FEDERATIONS_COL, federationId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

// ─── Specialty (prev. Doctrine) ───

export async function chooseSpecialty(specialty) {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  
  const validSpecialties = ["striker", "technician", "guardian"];
  if (!validSpecialties.includes(specialty)) throw new Error("Invalid specialty");
  
  await updateUserProfile(userId, { specialty });
}

export async function levelUpSpecialty() {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  
  const user = await getUserProfile(userId);
  if (!user?.specialty) throw new Error("No specialty chosen");
  
  // Exponential Cost: 100 * 1.5^Level
  const currentLvl = user.specialtyLevel || 0;
  const cost = Math.floor(100 * Math.pow(1.5, currentLvl)); 
  
  if ((user.titanFragments || 0) < cost) throw new Error(`Not enough Titan Fragments (Need ${cost})`);
  
  await updateUserProfile(userId, {
    specialtyLevel: increment(1),
    titanFragments: increment(-cost),
  });
  
  return { newLevel: currentLvl + 1, cost };
}
