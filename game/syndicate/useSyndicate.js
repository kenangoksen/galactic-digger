// game/syndicate/useSyndicate.js
// React Hook for Federation system
// Schema matched: federations, specialty, titanFragments, federationPower

import { useCallback, useEffect, useRef, useState } from "react";
import { ensureAuth, getCurrentUserId } from "../../firebase/firebaseConfig";
import {
  canAttemptRaid,
  claimRaidReward,
  getRaidLeaderboard,
  getTodaysRaid,
  RAID_DURATION_MS,
  submitRaidDamage,
} from "./raidService";
import {
  chooseSpecialty,
  createFederation,
  ensureUserProfile,
  getFederation,
  getFederationMembers,
  getUserProfile,
  joinFederationByCode,
  leaveFederation,
  levelUpSpecialty,
  searchFederations,
  subscribeFederation,
  updateUserProfile,
} from "./syndicateService";

export default function useSyndicate(stellarFragmentsLifetime = 0) {
  // ─── State ───
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [federation, setFederation] = useState(null);
  const [members, setMembers] = useState([]);
  const [todaysRaid, setTodaysRaid] = useState(null);
  const [raidStatus, setRaidStatus] = useState(null); 
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState(null);
  
  const unsubRef = useRef(null);

  // ─── Initialize ───
  useEffect(() => {
    let mounted = true;
    
    async function init() {
      try {
        const initPromise = async () => {
             console.log("[useFederation] Starting init...");
             const user = await ensureAuth();
             console.log("[useFederation] Auth ensured:", user.uid);
             
             if (!mounted) return;
             setUserId(user.uid);
             
             console.log("[useFederation] Fetching profile...");
             const profile = await ensureUserProfile(user.uid);
             
             if (!mounted) return;
             setUserProfile({ id: user.uid, ...profile });
             
             if (profile.federationId) {
               console.log("[useFederation] Refreshing fed data...", profile.federationId);
               await refreshFederationData(profile.federationId);
             }
        };

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Connection timed out. Check internet or Firestore rules.")), 10000)
        );

        await Promise.race([initPromise(), timeoutPromise]);
        
        console.log("[useFederation] Init complete");
        if (mounted) setLoading(false);
      } catch (err) {
        console.error("[useFederation] Error:", err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    }
    
    init();
    return () => { mounted = false; };
  }, []);

  // ─── Sync Federation Power ───
  useEffect(() => {
    if (!userId || !userProfile) return;
    const currentPower = userProfile.federationPower || 0;
    if (stellarFragmentsLifetime > currentPower) {
      updateUserProfile(userId, { federationPower: stellarFragmentsLifetime });
    }
  }, [stellarFragmentsLifetime, userId]);

  // ─── Refresh Federation Data ───
  const refreshFederationData = useCallback(async (federationId) => {
    try {
      const [fed, mems, raid, status] = await Promise.all([
        getFederation(federationId),
        getFederationMembers(federationId),
        getTodaysRaid(federationId),
        canAttemptRaid(getCurrentUserId()),
      ]);
      
      setFederation(fed);
      setMembers(mems);
      setTodaysRaid(raid);
      setRaidStatus(status);
      
      const lb = await getRaidLeaderboard(federationId);
      setLeaderboard(lb);
      
      if (unsubRef.current) unsubRef.current();
      unsubRef.current = subscribeFederation(federationId, (updated) => {
        setFederation(updated);
      });
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // ─── Actions ───
  
  const doCreateFederation = useCallback(async (name) => {
    try {
      setError(null);
      const result = await createFederation(name);
      await refreshFederationData(result.id);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [refreshFederationData]);

  const doJoinFederation = useCallback(async (inviteCode) => {
    try {
      setError(null);
      const result = await joinFederationByCode(inviteCode);
      await refreshFederationData(result.id);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [refreshFederationData]);

  const doLeaveFederation = useCallback(async () => {
    try {
      setError(null);
      if (unsubRef.current) unsubRef.current();
      await leaveFederation();
      const profile = await getUserProfile(getCurrentUserId());
      setUserProfile({ id: getCurrentUserId(), ...profile });
      setFederation(null);
      setMembers([]);
      setTodaysRaid(null);
      setRaidStatus(null);
      setLeaderboard([]);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const doSearch = useCallback(async (term) => {
    try {
      return await searchFederations(term);
    } catch (err) {
      setError(err.message);
      return [];
    }
  }, []);

  const doUpdateName = useCallback(async (newName) => {
    if (!userId) throw new Error("Not authenticated");
    try {
      setError(null);
      await updateUserProfile(userId, { displayName: newName });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [userId]);

  const doChooseSpecialty = useCallback(async (specialty) => {
    try {
      setError(null);
      await chooseSpecialty(specialty);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const doLevelUpSpecialty = useCallback(async () => {
    try {
      setError(null);
      await levelUpSpecialty();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const doSubmitRaid = useCallback(async (tapCount) => {
    if (!federation?.id) throw new Error("Not in a federation");
    try {
      setError(null);
      const result = await submitRaidDamage(federation.id, tapCount);
      await refreshFederationData(federation.id);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [federation, refreshFederationData]);

  const doClaimReward = useCallback(async () => {
    if (!federation?.id) throw new Error("Not in a federation");
    try {
      setError(null);
      const rewards = await claimRaidReward(federation.id);
      return rewards;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [federation]);

  const refresh = useCallback(async () => {
    if (federation?.id) {
      await refreshFederationData(federation.id);
    }
  }, [federation, refreshFederationData]);

  // ─── Cleanup ───
  useEffect(() => {
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  return {
    // State
    loading,
    userId,
    userProfile,
    federation,
    syndicate: federation, // alias for UI compatibility if needed
    members,
    todaysRaid,
    raidStatus,
    leaderboard,
    error,
    
    // Computed
    isInSyndicate: !!federation, // keep UI compatibility
    isLeader: federation?.leaderId === userId,
    raidDurationMs: RAID_DURATION_MS,
    
    // Actions
    createSyndicate: doCreateFederation,
    joinSyndicate: doJoinFederation,
    leaveSyndicate: doLeaveFederation,
    searchSyndicates: searchFederations,
    chooseDoctrine: doChooseSpecialty,
    levelUpDoctrine: doLevelUpSpecialty,
    submitRaid: doSubmitRaid,
    claimReward: doClaimReward,
    updateName: doUpdateName,
    refresh,
  };
}
