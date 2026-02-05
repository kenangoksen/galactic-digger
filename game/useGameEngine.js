
// game/useGameEngine.js
// Mevcut API korunur, planet görseli sistemi bozulmaz.
// Sadece ECONOMY (minerals/cost/buy) Decimal-safe yapılır.

import {
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";

import milestonesDef from "../assets/config/milestones.json";
import minersDef from "../assets/config/miners.json";
import planets from "../assets/config/planets.json";

import { AppState } from "react-native";
import { D } from "./bn";
import { DAMAGE_CONFIG } from "./config";
import configCache from "./ConfigCache"; // ✅ Central Config
import { computeTotals, getBulkCost, getPrimalReward, getProtocolBulkCost } from "./damage";
import { loadGame, saveGame, serializeEco } from "./persistGame";
import { DEFAULT_STATS, initStats } from "./stats"; // 📊

// ---------------- Clicker Heroes-style monster HP ----------------
// ---------------- Clicker Heroes-style monster HP ----------------
function baseMonsterHp(zone, hpMult = 1) {
  const z = Math.max(1, Math.floor(zone));
  // Apply HP Growth Multiplier (Graviton Law)
  // If hpMult < 1, it reduces the effective HP.
  const rawHp = 10 * (z - 1 + Math.pow(1.55, z - 1));
  return Math.floor(rawHp * hpMult);
}

function monsterHp(zone, step, hpMult = 1) {
  const hp = baseMonsterHp(zone, hpMult);
  const isBossPlanet = zone % 5 === 0;
  return isBossPlanet ? hp * 10 : hp;
}

function monsterMineral(zone, step) {
  const z = Math.max(1, Math.floor(zone));
  const isBossPlanet = z % 5 === 0;
  const base = Math.floor(Math.pow(1.60255, z - 1));
  return Math.max(1, isBossPlanet ? base * 10 : base);
}

// ---------------- Stellar Rewind Calculation ----------------
// Formula: ((MaxZone - 50) / 10) ^ 1.5
export function calculateStellarRewindReward(maxZone, rewardMult = 1) {
  const z = Number(maxZone || 0);
  if (z < 60) return 0; // First meaningful reward at 60 (since 50 is base)
  
  // (z - 50) / 10
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

// ---------------- Economy reducer (atomic buys, Decimal minerals) ----------------
const ECO_INIT = {
  minerals: D(0), // ✅ Decimal
  ownedMiners: {}, // { miner_01: level, ... }
  ownedSkills: {}, // { miner_01: { skillId: true, ... }, ... }
  unlockedCount: 2,
  stellarFragments: D(0), // ✅ Prestige Currency
  cosmicProtocols: {}, // { protocol_id: level }
  // STARLINK
  totalStarlinkTags: 0,
  tagsByMinerId: {}, // { minerId: count }
  lifetimeTagsEarned: 0,
  // Universal Constants & Essence
  cosmicEssence: 0,
  universalConstantsLevels: {},
  lifetimeEssence: 0,
  spentEssence: 0,
  stellarFragmentsSpentLifetime: 0,
  mineralBonusEndTime: 0, // ✅ Ad Bonus
  // SHARD SHOP
  shards: 0,
  droneCount: 0,
  activeDroneCount: 0,
};

function ecoReducer(state, action) {
  switch (action.type) {
    case "GAIN_MINERALS": {
      const add = D(action.amount || 0);
      if (add.lte(0)) return state;
      return { ...state, minerals: D(state.minerals).add(add) };
    }

    case "GAIN_SHARDS": {
      return { ...state, shards: (state.shards || 0) + (action.amount || 0) };
    }

    case "TOGGLE_DRONE": {
        const total = state.droneCount || 0;
        const current = state.activeDroneCount || 0;
        let next = current + 1;
        if (next > total) next = 0; // Loop back to 0 (Recall all)
        return { ...state, activeDroneCount: next };
    }

    case "BUY_SHOP_ITEM": {
      const { id, cost, payload } = action;
      if (!id || !cost) return state;
      if ((state.shards || 0) < cost) return state; // Check afford

      let newState = { ...state, shards: state.shards - cost };

      // Effects
      if (id.startsWith("timelapse_")) {
          const seconds = payload?.seconds || 3600;
          const dps = payload?.currentDps || D(0);
          const income = D(dps).mul(seconds);
          if (income.gt(0)) {
              newState.minerals = D(newState.minerals).add(income);
          }
      } else if (id === "auto_tapper") {
          newState.droneCount = (newState.droneCount || 0) + 1;
      } else if (id === "pack_fragments") {
          const amount = payload?.amount || 0;
          newState.stellarFragments = D(newState.stellarFragments).add(amount);
      } else if (id === "pack_tags") {
          const amount = payload?.amount || 0;
          newState.totalStarlinkTags = (newState.totalStarlinkTags || 0) + amount;
      }

      return newState;
    }

    case "BUY_MINER": {
      const { minerId, amount = 1 } = action;
      const def = minersDef.find((m) => m.id === minerId);
      if (!def) return state;

      const lvl = Number(state.ownedMiners[minerId] || 0);
      
      // Use getBulkCost for N levels
      const cost = getBulkCost(def, lvl, amount);

      // ✅ Decimal compare
      if (!D(state.minerals).gte(cost)) return state;

      return {
        ...state,
        minerals: D(state.minerals).sub(cost),
        ownedMiners: { ...state.ownedMiners, [minerId]: lvl + amount },
      };
    }

    case "BUY_SKILL": {
      const { minerId, skillId } = action;
      const def = minersDef.find((m) => m.id === minerId);
      if (!def) return state;

      const skill = def.skills?.find((s) => s.id === skillId);
      if (!skill) return state;

      const lvl = Number(state.ownedMiners[minerId] || 0);
      const unlockAt = Number(skill.unlockAt || 0);
      if (lvl < unlockAt) return state;

      const ownedMap = state.ownedSkills[minerId] || {};
      if (ownedMap[skillId]) return state;

      const cost = D(skill.cost || 0); // ✅ Decimal parse
      if (cost.gt(0) && !D(state.minerals).gte(cost)) return state;

      return {
        ...state,
        minerals: cost.gt(0) ? D(state.minerals).sub(cost) : D(state.minerals),
        ownedSkills: {
          ...state.ownedSkills,
          [minerId]: { ...ownedMap, [skillId]: true },
        },
      };
    }
    case "UNLOCK_UP_TO": {
      const upTo = Number(action.count || 2);
      if (!Number.isFinite(upTo)) return state;

      const next = Math.max(state.unlockedCount || 2, upTo);
      if (next === (state.unlockedCount || 2)) return state;

      return { ...state, unlockedCount: next };
    }

    case "CHECK_MILESTONES": {
       if (!milestonesDef.dpsToTapMilestones?.enabled) return state;
       
       let changed = false;
       const newUnlocked = { ...state.dpsToTapMilestonesUnlocked };
       
       for (const ms of milestonesDef.dpsToTapMilestones.milestones) {
          if (newUnlocked[ms.id]) continue; // Already unlocked
          
          if (ms.requirement.type === "minerLevelAtLeast") {
             const mId = ms.requirement.minerId || ms.minerId;
             const lvl = Number(state.ownedMiners[mId] || 0);
             if (lvl >= ms.requirement.value) {
                newUnlocked[ms.id] = true;
                changed = true;
             }
          }
       }
       
       if (!changed) return state;
       
       // Toast logic could go here
       return { 
          ...state, 
          dpsToTapMilestonesUnlocked: newUnlocked 
       };
    }
    // Summoning Logic
    case "GENERATE_SUMMON_POOL": {
        if (state.summonPool && state.summonPool.length > 0) return state;
        
        const protocols = configCache.getCosmicProtocols()?.protocols || [];
        const ownedIds = Object.keys(state.cosmicProtocols).filter(id => state.cosmicProtocols[id] > 0);
        
        // Random 4 not owned
        const available = protocols.filter(p => !ownedIds.includes(p.id));
        // Simple shuffle
        for (let i = available.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [available[i], available[j]] = [available[j], available[i]];
        }
        const newPool = available.slice(0, 4).map(p => p.id);
        
        return {
            ...state,
            summonPool: newPool
        };
    }
    
    case "REROLL_SLOT": {
        const { slotIndex } = action;
        const protocols = configCache.getCosmicProtocols()?.protocols || [];
        const ownedIds = Object.keys(state.cosmicProtocols).filter(id => state.cosmicProtocols[id] > 0);
        
        // Cost: 1.5 ^ rerollCount (min 1)
        const cost = Math.floor(Math.max(1, Math.pow(1.5, state.rerollCount || 0)));
        
        if (D(state.stellarFragments).lt(cost)) return state;
        
        const currentPool = [...(state.summonPool || [])];
        const exclude = [...currentPool]; // Avoid dupes in view
        
        const available = protocols.filter(p => !ownedIds.includes(p.id) && !exclude.includes(p.id));
         // Simple shuffle
        for (let i = available.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [available[i], available[j]] = [available[j], available[i]];
        }
        
        if (available.length > 0) {
            currentPool[slotIndex] = available[0].id;
        }
        
        return {
            ...state,
            stellarFragments: D(state.stellarFragments).sub(cost),
            summonPool: currentPool,
            rerollCount: (state.rerollCount || 0) + 1
        };
    }

    case "GAIN_FRAGMENTS": {
      return {
        ...state,
        stellarFragments: D(state.stellarFragments).add(action.amount || 0),
      };
    }
    
    case "GAIN_TAG": {
        // action: { targetMinerId: string (optional), amount: 1 }
        const amt = action.amount || 1;
        const target = action.targetMinerId || null;
        
        let newTagsMap = { ...state.tagsByMinerId };
        
        // If no target provided, pick a random owned miner > 0 level.
        let finalTarget = target;
        if (!finalTarget) {
            const ownedIds = Object.keys(state.ownedMiners).filter(id => state.ownedMiners[id] > 0);
            if (ownedIds.length > 0) {
                finalTarget = ownedIds[Math.floor(Math.random() * ownedIds.length)];
            }
        }
        
        if (finalTarget) {
            newTagsMap[finalTarget] = (newTagsMap[finalTarget] || 0) + amt;
        } else {
             // Fallback if no miners owned
             newTagsMap["unassigned"] = (newTagsMap["unassigned"] || 0) + amt;
        }
        
        return {
            ...state,
            totalStarlinkTags: (state.totalStarlinkTags || 0) + amt,
            lifetimeTagsEarned: (state.lifetimeTagsEarned || 0) + amt,
            tagsByMinerId: newTagsMap
        };
    }

    case "REDISTRIBUTE_TAGS": {
         const total = state.totalStarlinkTags || 0;
         if (total <= 0) return state;
         
         const ownedIds = Object.keys(state.ownedMiners).filter(id => state.ownedMiners[id] > 0);
         if (ownedIds.length === 0) return state;
         
         // Basic Redistribution: 80% to provided 'primary', rest to others?
         // For V1, let's just implement the mechanics if needed, or leave basic.
         // Since UI for redistribution isn't active yet, this is placeholder.
         return state;
    }

    case "LOAD_STATE": {
      // payload: { minerals: Decimal, unlockedCount, ownedMiners, ownedSkills }
      const p = action.payload;
      if (!p) return state;

      return {
        ...state,
        minerals: p.minerals ?? state.minerals,
        unlockedCount: p.unlockedCount ?? state.unlockedCount,
        ownedMiners: p.ownedMiners ?? state.ownedMiners,
        ownedSkills: p.ownedSkills ?? state.ownedSkills,
        // ✅ Rehydrate Meta Currencies
        stellarFragments: p.stellarFragments ?? state.stellarFragments,
        cosmicProtocols: p.cosmicProtocols ?? state.cosmicProtocols,
        summonPool: p.summonPool ?? state.summonPool,
        rerollCount: p.rerollCount ?? state.rerollCount,

        // Starlink Rehydration
        totalStarlinkTags: p.totalStarlinkTags || 0,
        tagsByMinerId: p.tagsByMinerId || {},
        lifetimeTagsEarned: p.lifetimeTagsEarned || 0,
        // Universal Constants & Essence Rehydration
        cosmicEssence: p.cosmicEssence || 0,
        universalConstantsLevels: p.universalConstantsLevels || {},
        lifetimeEssence: p.lifetimeEssence || 0,
        spentEssence: p.spentEssence || 0,
        stellarFragmentsSpentLifetime: p.stellarFragmentsSpentLifetime || 0,
        
        // SHARD SHOP REHYDRATION
        shards: p.shards ?? state.shards,
        droneCount: p.droneCount ?? state.droneCount,
        // Active drones reset on load or persist? User didn't specify, but safer to persist or reset?
        // Let's persist.
        activeDroneCount: p.activeDroneCount ?? 0,
      };
    }

    case "RESET_GAME": {
      return { ...ECO_INIT };
    }

    case "PERFORM_STELLAR_REWIND": {
       // amount: gained shards
       const gained = D(action.amount || 0);
       
       return {
          ...ECO_INIT, // Reset minerals, miners, unlockedCount, etc.
          stellarFragments: D(state.stellarFragments).add(gained),
          cosmicProtocols: state.cosmicProtocols, // Keep protocols!
          // Keep Starlink Tags!
          totalStarlinkTags: state.totalStarlinkTags,
          tagsByMinerId: state.tagsByMinerId,
          lifetimeTagsEarned: state.lifetimeTagsEarned,
          // Keep Universal Constants & Essence!
          cosmicEssence: state.cosmicEssence,
          universalConstantsLevels: state.universalConstantsLevels,
          lifetimeEssence: state.lifetimeEssence,
          spentEssence: state.spentEssence,
          stellarFragmentsSpentLifetime: state.stellarFragmentsSpentLifetime,
          // Keep Summoning State
          summonPool: state.summonPool,
          rerollCount: state.rerollCount,
          nextUnlockCostIndex: state.nextUnlockCostIndex,
       };
    }

    case "UNLOCK_PROTOCOL": {
        const { protocolId } = action;
        // Cost is based on OWNED COUNT
        const ownedCount = Object.keys(state.cosmicProtocols).filter(k => state.cosmicProtocols[k] > 0).length;
        const cost = getNextUnlockCost(ownedCount);
        
        if (D(state.stellarFragments).lt(cost)) {
            console.log("Unlock failed: Not enough SF", state.stellarFragments, cost);
            return state;
        }
        
        return {
            ...state,
            stellarFragments: D(state.stellarFragments).sub(cost),
            cosmicProtocols: {
                ...state.cosmicProtocols,
                [protocolId]: 1 // Unlock at level 1
            },
            summonPool: null, // Reset pool
            rerollCount: 0 // Reset reroll cost scaling
        };
    }

    case "UPGRADE_PROTOCOL": {
       const { protocolId, amount = 1 } = action; // Support bulk
       const currentLvl = state.cosmicProtocols[protocolId] || 0;
       if (currentLvl <= 0) return state; // Must unlock first
       
       // Bulk Cost Logic using new helper
       // Cost = Sum of (L+1)...(L+amount)
       const cost = getProtocolBulkCost(currentLvl, amount);
       
       if (D(state.stellarFragments).lt(cost)) return state;

       return {
          ...state,
          stellarFragments: D(state.stellarFragments).sub(cost),
          cosmicProtocols: {
             ...state.cosmicProtocols,
             [protocolId]: currentLvl + amount
          }
       };
    }

    case "BUY_UNIVERSAL_CONSTANT": {
        const { constantId } = action;
        const def = configCache.getConstantDef(constantId);
        if (!def) return state;

        const currentLvl = state.universalConstantsLevels[constantId] || 0;
        const maxLevel = def.leveling?.maxLevel || Infinity;
        if (currentLvl >= maxLevel) return state;

        // Cost Model
        let cost = 0;
        const model = def.leveling?.costModel;
        if (model === "levelPlus1") cost = currentLvl + 1;
        else if (model === "flat1") cost = 1;
        else cost = 999999; // Fallback

        if (state.cosmicEssence < cost) return state;

        return {
            ...state,
            cosmicEssence: state.cosmicEssence - cost,
            spentEssence: (state.spentEssence || 0) + cost,
            universalConstantsLevels: {
                ...state.universalConstantsLevels,
                [constantId]: currentLvl + 1
            }
        };
    }

    case "PERFORM_BIG_BANG": {
        // payload: { gainedEssence }
        const gained = action.payload?.gainedEssence || 0;
        
        return {
            ...ECO_INIT, // Reset minerals, miners, unlockedCount
            // Keep Meta
            stellarFragments: state.stellarFragments,
            stellarFragmentsSpentLifetime: state.stellarFragmentsSpentLifetime,
            cosmicProtocols: state.cosmicProtocols,
            
            // Keep Constants & Essence
            cosmicEssence: (state.cosmicEssence || 0) + gained,
            universalConstantsLevels: state.universalConstantsLevels,
            lifetimeEssence: (state.lifetimeEssence || 0) + gained,
            spentEssence: state.spentEssence,
            
            // Keep Starlink Tags
            totalStarlinkTags: state.totalStarlinkTags,
            tagsByMinerId: state.tagsByMinerId,
            lifetimeTagsEarned: state.lifetimeTagsEarned,
        };
    }

    case "EXTEND_MINERAL_BONUS": {
        return { ...state, mineralBonusEndTime: action.endTime };
    }

    default:
      return state;
  }
}

export function useGameEngine() {
  // progress model
  const [mode, setMode] = useState("progress"); // "farm" | "progress"
  const [zone, setZone] = useState(1);
  const [step, setStep] = useState(1);
  const [maxUnlockedZone, setMaxUnlockedZone] = useState(1);
  const [isPrimal, setIsPrimal] = useState(false);
  const [isChest, setIsChest] = useState(false); // 📦 Treasure Chest State
  


  // Auto-update maxUnlockedZone if we are somehow ahead of it
  useEffect(() => {
    if (zone > maxUnlockedZone) {
      setMaxUnlockedZone(zone);
    }
  }, [zone, maxUnlockedZone]);

  const isBossPlanet = zone % 5 === 0;
  
  // MOVED goNextZone and goPrevZone below totals to avoid ReferenceError

  // economy (atomic)
  const [eco, dispatchEco] = useReducer(ecoReducer, ECO_INIT);
  const minerals = eco.minerals; // ✅ Decimal dışarıya da Decimal döner
  const ownedMiners = eco.ownedMiners;
  const ownedSkills = eco.ownedSkills;
  const [pendingOwnedMiners, setPendingOwnedMiners] = useState({});

  // --- ACTIVE SKILLS STATE (Moved Here) ---
  const SKILLS_CONFIG = require("../assets/config/skills.json");
  
  const [activeSkills, setActiveSkills] = useState({}); 
  const [skillCooldowns, setSkillCooldowns] = useState({}); 
  const [ownedActiveSkills, setOwnedActiveSkills] = useState({}); 
  const [darkRitualMult, setDarkRitualMult] = useState(1); 
  
  const energizeRef = useRef(false);
  const lastUsedSkillRef = useRef(null);
  
  // Tag Toast
  const [tagToast, setTagToast] = useState(null); // { minerName: string } | null
  
  // Streak State
  const tapStreakRef = useRef(0);
  const lastTapTimeRef = useRef(Date.now());
  const [uiStreak, setUiStreak] = useState(0);
  const [isIdle, setIsIdle] = useState(false); // Siyalatas / Silent Observer check

  const resetGame = useCallback(async () => {
    // 1. Clear storage
    await import("./persistGame").then((m) => m.clearGame());
    // 2. Reset Memory
    setMode("progress");
    setZone(1);
    setMaxUnlockedZone(1); // ✅ Reset max zone too
    setStep(1);
    // 📊 Reset Memory Stats
    statsRef.current = initStats({}); 
    dispatchEco({ type: "RESET_GAME" });
  }, []);

  // ✅ Planet visual — BURAYA DOKUNMADIM (senin sistem aynen)
  const planetCount = planets?.length || 1;
  const globalStageIndex = (zone - 1) * 10 + (step - 1);
  const planetIndex = planetCount > 0 ? globalStageIndex % planetCount : 0;
  const unlockedCount = eco.unlockedCount || 2;

  const currentPlanet = planets?.[planetIndex] ||
    planets?.[0] || {
      id: "planet_01",
      name: "Planet",
      sprite: "planet_01.png",
    };

  const PLANET_IMAGES = useMemo(() => ({
    "planet_01.png": require("../assets/images/sprites/planets/planet_01.png"),
    "planet_02.png": require("../assets/images/sprites/planets/planet_02.png"),
    "planet_03.png": require("../assets/images/sprites/planets/planet_03.png"),
    "planet_04.png": require("../assets/images/sprites/planets/planet_04.png"),
  }), []);

  const currentPlanetImg = PLANET_IMAGES[currentPlanet.sprite] || PLANET_IMAGES["planet_01.png"];

  // --- MULTIPLIER HELPERS (Moved Up) ---
  const getDpsMultiplier = useCallback(() => {
      let mult = D(1);
      if (activeSkills['s_powersurge'] > Date.now()) mult = mult.times(2); // Powersurge
      mult = mult.times(darkRitualMult);
      return mult;
  }, [activeSkills, darkRitualMult]);

  const getTapMultiplier = useCallback(() => {
      let mult = D(1);
      if (activeSkills['s_superclicks'] > Date.now()) mult = mult.times(3); // Super Clicks
      return mult;
  }, [activeSkills]);
  
  const getGoldMultiplier = useCallback(() => {
      let mult = D(1);
      if (activeSkills['s_metal'] > Date.now()) mult = mult.times(2); // Metal Detector
      return mult;
  }, [activeSkills]);
  
  const getCritChanceBonus = useCallback(() => {
      if (activeSkills['s_lucky'] > Date.now()) return 0.5; // Lucky Strikes
      return 0;
  }, [activeSkills]);

  // totals (tap + dps + crit + multipliers) — depends only on economy + zone
  const totals = useMemo(() => {
    return computeTotals({
      minersDef,
      ownedMiners,
      ownedSkills,
      zone,
      // Meta
      universalConstantsLevels: eco.universalConstantsLevels, // ✅ From Eco based on persistence
      cosmicProtocolLevels: eco.cosmicProtocols,
      constantsDef: configCache.getUniversalConstants()?.items, // ✅ From Cache
      protocolsDef: configCache.getCosmicProtocols()?.protocols, // ✅ From Cache
      tagsByMinerId: eco.tagsByMinerId,
      stellarFragmentsSpent: eco.stellarFragmentsSpentLifetime, // ✅
      stellarFragments: eco.stellarFragments, // ✅ For Passive DPS
      dpsToTapMilestonesUnlocked: eco.dpsToTapMilestonesUnlocked, // ✅ Progress
      mineralBonusActive: Date.now() < (eco.mineralBonusEndTime || 0), // ✅ Ad Bonus Status
    });
  }, [ownedMiners, ownedSkills, zone, eco.cosmicProtocols, eco.tagsByMinerId, eco.universalConstantsLevels, eco.stellarFragmentsSpentLifetime, eco.stellarFragments, eco.dpsToTapMilestonesUnlocked, eco.mineralBonusEndTime]);

  const tapDamageBase = totals.tapDamage;
  
  // Apply Active Skills to DPS
  let totalDps = D(totals.dps).mul(getDpsMultiplier());
  // Apply Idle Bonus (Silent Observer)
  if (isIdle && totals.idleDpsMult > 1) {
      totalDps = totalDps.mul(totals.idleDpsMult);
  }
  totalDps = totalDps.toNumber();

  const goNextZone = useCallback(() => {
    // SIMPLE LOGIC: If we are not at the max unlocked zone, we can go next.
    // This allows skipping steps/bosses if we already beat them before.
      if (zone < maxUnlockedZone) {
      const next = zone + 1;
      setZone(next);
      setStep(1); // Start at step 1 of next zone
      setMode("progress"); // Force progress mode so we don't get stuck in farm mode
      
      const newHp = monsterHp(next, 1, totals.hpGrowthMult || 1);
      setMaxHp(newHp);
      setHp(newHp);
    }
  }, [zone, maxUnlockedZone, totals.hpGrowthMult]);

  const goPrevZone = useCallback(() => {
    if (zone > 1) {
       const prev = zone - 1;
       setZone(prev);
       setStep(1);
       setMode("farm"); // Automatically switch to farm mode when going back
       
       const newHp = monsterHp(prev, 1, totals.hpGrowthMult || 1);
       setMaxHp(newHp);
       setHp(newHp);
    }
  }, [zone, setMode, totals.hpGrowthMult]);

  const critChance = totals.critChance;
  const critMult = totals.critMult;

  // HP state
  // We need to use useMemo or effect to update HP if totals change? 
  // Probably not mid-fight, but for next spawn.
  const [maxHp, setMaxHp] = useState(monsterHp(zone, step, 1)); // Init with 1 to avoid undefined error before totals
  const [hp, setHp] = useState(monsterHp(zone, step, 1));

  // boss timer ms
  const [bossTimeMsLeft, setBossTimeMsLeft] = useState(0);
  const dpsRef = useRef(0);
  const buyLockRef = useRef(false);
  const zoneRef = useRef(zone);
  const stepRef = useRef(step);
  const hpRef = useRef(hp);
  const maxHpRef = useRef(maxHp);
  const modeRef = useRef(mode);
  
  // 📊 Statistics Store
  const statsRef = useRef(initStats());

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // --- SAVE / LOAD ---
  const [hydrated, setHydrated] = useState(false);
  const saveTimerRef = useRef(null);

  // ---- STATE REFS (For Event Listeners) ----
  // We use a ref to hold the latest state so AppState listener 
  // can access it without needing to re-bind (and risk staleness/perf issues).
  const latestStateRef = useRef({ mode, zone, step, eco });

  useEffect(() => {
    latestStateRef.current = { mode, zone, step, eco, maxUnlockedZone };
  }, [mode, zone, step, eco, maxUnlockedZone]);

  // ---- OFFLINE EARNINGS STATE ----
  const [offlineEarnings, setOfflineEarnings] = useState(null);

  // Helper: Smart Offline Progression
  // 1. Calculate time needed to clear 1 stage (10 mobs) or 1 boss.
  // 2. If time < remaining, advance & earn.
  // 3. If fail (boss > 30s), farm the PREVIOUS zone for rest of time.
  const calcOffline = useCallback((savedData) => {
    if (!savedData) return;

    const now = Date.now();
    const lastSave = savedData.savedAt || now;
    let diffSeconds = Math.floor((now - lastSave) / 1000);

    if (diffSeconds > 5) {
      // Cap time at 4 hours
      let remainingSeconds = Math.min(diffSeconds, 14400);
      const originalSeconds = remainingSeconds; // For report

      const sEco = savedData.eco || {};
      let currentZone = Number(savedData.progress?.zone || 1);
      let currentStep = Number(savedData.progress?.step || 1);
      let totalEarned = D(0);

      // 1. Calculate DPS (Static)
      let offlineDps = D(0);
      const minersDef = require("../assets/config/miners.json");
const SKILLS_CONFIG = require("../assets/config/skills.json"); // New import
      
      Object.keys(sEco.ownedMiners || {}).forEach((mid) => {
        const lvl = sEco.ownedMiners[mid];
        const def = minersDef.find((m) => m.id === mid);
        if (def && lvl > 0) {
          const dpsBase = def.stats?.dpsBase || 0;
          offlineDps = offlineDps.add(D(dpsBase).mul(lvl));
        }
      });
      
      // ✅ Eternal Drift (Idle Dominance)
      // Constant ID: eternal_drift
      // Formula: 1 + ((1.5^level - 1) * (base/0.30)) -> base 0.30 => scale 1
      const driftLevel = sEco.universalConstantsLevels?.['eternal_drift'] || 0;
      if (driftLevel > 0) {
          const driftMult = 1 + (Math.pow(1.5, driftLevel) - 1);
          offlineDps = offlineDps.mul(driftMult);
      }

      if (offlineDps.lte(0)) return;

      // 2. Simulation Loop
      // Limit iterations to prevent freezing on huge time skips (e.g. max 1000 zones)
      let iterations = 0;
      
      while (remainingSeconds > 0 && iterations < 1000) {
        iterations++;
        
        const isBoss = currentZone % 5 === 0;
        const zHp = monsterHp(currentZone, currentStep);
        const zReward = monsterMineral(currentZone, currentStep);

        // Time to kill 1 mob
        // time = hp / dps
        // If dps is huge, time is very small (min 0.1s frame)
        // D might not handle division resulting in float well if valid BigNumber lib isn't used for seconds.
        // Assuming we can get a number ratio.
        
        // We need a way to divide BigNumbers to get a number. 
        // D(zHp).div(offlineDps) -> conversion to number?
        // Let's assume zHp/OfflineDps ratio.
        
        // Simplified Logic: 
        // We interpret D as having a .toNumber() or we use string approx for ratio?
        // Actually typical BN libs have .toNumber() but it might overflow.
        // We can check if Dps > Hp -> instant kill.
        
        let timeToKill = 0;
        if (offlineDps.gte(zHp)) {
            timeToKill = 0.1; // Instant
        } else {
            // approximation: (HP / DPS)
            // Safety: if HP is massive compared to DPS, this will be huge
            // We can check "Can we kill it in 30s?"
            // 30 * DPS >= HP ?
            const damageIn30s = offlineDps.mul(30);
            if (damageIn30s.lt(zHp)) {
                // FAIL! Cannot kill in 30s (Boss or tough mob)
                // We hit a WALL.
                break; 
            }
            
            // Calculate exact time (approximate for simulation)
            // We don't have exact float division on generic BN easily without loss
            // estimation: count how many seconds.
            // Let's assume average 1s if DPS ~ HP.
            // For simulation speed, let's say if we can kill it, we take (HP/DPS) seconds.
            // We use a simple loop or estimate?
            // Let's just say: time = 1s * (HP/DPS_val)?? No.
            
            // Allow simplified approach:
            // If DPS * 30 > HP, passed. Time taken = 30 * (HP / MaxPossibleDmg) ??
            // Time = 30 * (HP / (DPS*30)) = (HP/DPS)
            
            // Since we established Dps*30 >= HP, check Dps >= HP/30
            // We can just subtract "estimated" time.
            // Let's deduct 1 second per mob for simplicity unless it's a boss?
            // No, accurate time is needed for rewards.
            
            // Let's deduct 1s for now to be generous/fast, OR
            // treat "Farm Mode" if we can't insta-kill.
            timeToKill = 1; 
        }

        // Stage Logic
        let mobsInStage = isBoss ? 1 : 10;
        let stageTime = timeToKill * mobsInStage;
        
        // If Boss, hard limit 30s check was passed above.
        // If Normal stage, 10 mobs * time per mob.
        
        if (remainingSeconds >= stageTime) {
            // CLEARED STAGE
            remainingSeconds -= stageTime;
            totalEarned = totalEarned.add(D(zReward).mul(mobsInStage));
            
            // Advance
            if (isBoss) {
                currentZone++;
                currentStep = 1;
            } else {
                if (currentStep < 10) currentStep++; // Should be 10 steps per zone logic? 
                // Logic says: Normal planet: 10 sectors. 
                // "if (localStep < 10) localStep += 1; else { localZone += 1; localStep = 1; }"
                // Wait, logic in Engine says:
                // if (localStep < 10) localStep += 1;
                // else { localZone += 1; localStep = 1; }
                // So step goes 1..10. At 10, killing moves to next zone? No.
                // Step 1..9 -> next step. Step 10 -> Next zone Zone+1, Step 1.
                // Correct.
                
                if (currentStep < 10) {
                    currentStep++;
                } else {
                    currentZone++;
                    currentStep = 1; 
                }
            }
        } else {
            // Not enough time to clear full stage, partial farm then break
            // We stay in this zone for remainder
            break; 
        }
      }

      // 3. Farming (Wall Hit or Time Ran Out)
      // If we broke the loop because we hit a wall (Boss too strong), 
      // we must retreat to previous safe zone to farm.
      // If we broke because time ran out, we farm where we are.
      
      // Check current strength against current zone
      const zHp = monsterHp(currentZone, currentStep);
      const damageIn30s = offlineDps.mul(30);
      const canKill = damageIn30s.gte(zHp);
      
      let farmZone = currentZone;
      let farmStep = currentStep;
      
      if (!canKill) {
          // Retreat!
          // If we are at Zone 1 Step 1 and cant kill, nowhere to go (0 earnings).
          if (farmZone > 1 || farmStep > 1) {
              // Go back one stage
              if (farmStep > 1) farmStep--;
              else {
                  farmZone--;
                  farmStep = 10; // Farm end of prev zone
              }
          }
      }
      
      // Calculate farming on the "Farm Zone" for remaining seconds
      if (remainingSeconds > 0) {
           const fHp = monsterHp(farmZone, farmStep);
           const fReward = monsterMineral(farmZone, farmStep);
           
           // Earned = (Time * DPS / HP) * Reward
           // Safe calc using BN
           if (fHp > 0) {
               // Total Dmg potential
               const potDmg = offlineDps.mul(remainingSeconds);
               const farmed = potDmg.mul(fReward).div(fHp).floor();
               totalEarned = totalEarned.add(farmed);
           }
      }

      if (totalEarned.gt(0)) {
          console.log(`OFFLINE SIM: Reached Z${currentZone}-${currentStep}. Farmed Z${farmZone}. Total: ${totalEarned}`);
          setOfflineEarnings({ amount: totalEarned, seconds: originalSeconds });
          
          // COMMIT PROGRESS
          // We update the state refs to simulate "Loading" this new state
          // When the engine consumes this, it should update.
          // But we are inside existing engine state.
          // We should ideally `setZone(currentZone)` etc.
          // Check if we actually advanced?
          const startZone = Number(savedData.progress?.zone || 1);
          if (farmZone > startZone || (farmZone === startZone && farmStep > (savedData.progress?.step||1))) {
             // We advanced!
             // Update state
             // NOTE: We only update to the "Farm Zone" (Safe zone), 
             // or should we put them at the "Wall" to try again?
             // "Takıldığı yerde bir önceki zone'a geçsin orda farming yapsın"
             // Typically we leave them at the max reached zone so they see the wall?
             // "bir sonraki bosu geçebilecek değil mi?" -> Means they want to try.
             // Let's put them at currentZone (The Wall) if they reached it.
             // But if we farmed `farmZone`, maybe put them there?
             // Putting them at `currentZone` (The Wall) is better UX for "Progress".
             
             // BUT: Logic says "Retreat to farm".
             // Let's set them to `currentZone` (Highest Reached).
             // If they can't beat it, they will just fail boss timer online.
             
             setZone(currentZone);
             setStep(currentStep);
          }
      }
    }
  }, []);

  // Initial Load & AppState Logic
  useEffect(() => {
    let alive = true;

    // 1. Initial Load
    (async () => {
      const loaded = await loadGame();
      if (!alive) return;

      if (loaded) {
        setMode(loaded.progress.mode);
        const z = Number(loaded.progress.zone || 1);
        setZone(z);
        setStep(Number(loaded.progress.step || 1));
        // Load maxUnlockedZone (fallback to zone if missing)
        const maxZ = Number(loaded.progress.maxUnlockedZone || z);
        setMaxUnlockedZone(maxZ);
        
        dispatchEco({ type: "LOAD_STATE", payload: loaded.eco });
        
        // 📊 Load Stats
        if (loaded.stats) {
            statsRef.current = initStats(loaded.stats);
        } else {
            statsRef.current = initStats({});
        }

        // 🔄 RETROACTIVE SYNC: If stats are fresh but game is advanced, sync them up
        const s = statsRef.current;
        if (s && s.lifetime) {
            // 1. Sync Levels
            const realTotalLevels = Object.values(loaded.eco.ownedMiners || {}).reduce((a, b) => a + Number(b), 0);
            if (realTotalLevels > (s.lifetime.totalMinerLevels || 0)) {
                s.lifetime.totalMinerLevels = realTotalLevels;
            }
            // 2. Sync Unlocks
            const realUnlocked = Number(loaded.eco.unlockedCount || 0);
            if (realUnlocked > (s.lifetime.totalMinersUnlocked || 0)) {
                s.lifetime.totalMinersUnlocked = realUnlocked;
            }
            // 3. Sync Highest Level
            const realMaxLvl = Math.max(0, ...Object.values(loaded.eco.ownedMiners || {}).map(Number));
            if (realMaxLvl > (s.lifetime.highestMinerLevel || 0)) {
                s.lifetime.highestMinerLevel = realMaxLvl;
            }
        }
        
        calcOffline(loaded);
      }
      setHydrated(true);
    })();

    // 2. AppState Listener
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        // Going Background: Save immediately using REF
        if (hydrated) {
             const current = latestStateRef.current;
             const snapshot = {
                version: 1,
                savedAt: Date.now(), // FRESH TIME
                progress: { 
                    mode: current.mode, 
                    zone: current.zone, 
                    step: current.step,
                    maxUnlockedZone: current.maxUnlockedZone 
                },
                eco: serializeEco(current.eco),
                stats: statsRef.current, // 📊
             };
             saveGame(snapshot).catch(e => console.warn("BG Save Failed", e));
        }
      } else if (state === "active") {
        // Coming Foreground: Check time diff
        import("./persistGame").then(m => m.loadGame()).then(saved => {
           if (alive && saved) calcOffline(saved);
        });
      }
    });

    return () => {
      alive = false;
      sub.remove();
    };
  }, [calcOffline, hydrated]); // Hydrated dependency ensures we start saving only after load

  // Auto-Save Loop (Backup)
  // We keep this running just in case AppState fails or crash occurs
  useEffect(() => {
    if (!hydrated) return; // Don't save before load!

    // debounce
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
       const current = latestStateRef.current; // Use ref here too for consistency
       if (!current) return;

       const snapshot = {
        version: 1,
        savedAt: Date.now(),
        progress: { 
            mode: current.mode, 
            zone: current.zone, 
            step: current.step,
            maxUnlockedZone: current.maxUnlockedZone 
        },
        eco: serializeEco(current.eco),
        stats: statsRef.current, // 📊
      };

      saveGame(snapshot).catch(() => {});
    }, 2000); // 2s debounce is safer than 1s/400ms to avoid IO trashing

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [hydrated, mode, zone, step, eco, maxUnlockedZone]); // Dependency updated
  useEffect(() => {
    zoneRef.current = zone;
  }, [zone]);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    hpRef.current = hp;
  }, [hp]);
  useEffect(() => {
    maxHpRef.current = maxHp;
  }, [maxHp]);

  useEffect(() => {
    const m = monsterHp(zone, step);
    setMaxHp(m);
    setHp(m);

    const s = statsRef.current; // ✅ Moved to top scope

    // 📊 Stats (Boss Spawned)
    if (isBossPlanet) {
       
       // Calculate Boss Time based on Constants
       
       // Calculate Boss Time based on Constants
       // Base 30s * (1 + Chronal Margin Effectiveness)
       const baseTime = 30_000;
       const timeEff = totals.protocolModifiers?.bossTimerEff || 1;
       setBossTimeMsLeft(baseTime * timeEff);
       
       if (s && s.lifetime) {
           s.lifetime.totalBossesSpawned = (s.lifetime.totalBossesSpawned || 0) + 1;
           if (zone >= 105 && Math.random() < 0.25) { // Primal Check replicated for stats
               // Note: Actual random check happens below, so verify consistency.
               // Better is to define "isPrimal" state first.
               // But isPrimal is state, takes effect next render.
               // We should calculate primal here locally first.
           }
       }

        // Primal Check: Zone >= 105 && 25% Chance + Protocol Bonus
        const chance = 0.25 + (totals.protocolModifiers?.anomalyChanceBonus || 0);
        const isPrimalNow = zone >= 105 && Math.random() < chance;
       if (isPrimalNow) {
           setIsPrimal(true);
           if (s && s.lifetime) {
                s.lifetime.totalAnomalyBossesSpawned = (s.lifetime.totalAnomalyBossesSpawned || 0) + 1;
           }
       } else {
           setIsPrimal(false);
       }
        
        // No Chests on Boss Levels (usually rule is: Chests replace monsters, not bosses)
        setIsChest(false);
    } else {
       setBossTimeMsLeft(0);
       setIsPrimal(false);
       
       
       // CHEST SPAWN LOGIC (non-boss)
       // Base Chance 1-2% + Protocol
       // Universal Constant: Treasure Manifest amplifies sources
       const eff = totals.protocolModifiers?.treasureChanceEff || 1;
       const baseProtocolChance = (totals.protocolModifiers?.treasureChestChance || 0);
       
       // Effective Chance = (Base 0.01 + Protocol) * Effectiveness
       const chestChance = (0.01 + baseProtocolChance) * eff;
       
       const isChestNow = Math.random() < chestChance;
       setIsChest(isChestNow);
       
       if (isChestNow) {
           // Toast? 
           // setTagToast({ message: "Cosmic Geode Found!" }); // Too spammy if frequent?
           // Maybe only distinct visual later.
           
           if (s && s.lifetime) {
                // Track total chests?
           }
       }
    }
  }, [zone, step, isBossPlanet]);

  const hpPct = useMemo(
    () => (maxHp > 0 ? Math.max(0, hp / maxHp) : 0),
    [hp, maxHp],
  );

  const respawningRef = useRef(false);

  const applyDamage = useCallback(
    (dmg) => {
      if (respawningRef.current) return; // 🛑 Respawn sırasında hasar yok

      const rawHit = Number(dmg || 0);
      if (rawHit <= 0) return;
      
      let hit = rawHit;
      
      // BOSS DPS BONUS
      const isBoss = zoneRef.current % 5 === 0; // Safe read from ref or use isBossPlanet from scope if reliable
      if (isBoss) {
          const bossMul = totals.protocolModifiers?.bossDpsMult || 1;
          hit *= bossMul;
      }

      let currentHp = hpRef.current;
      
      // HP azal
      currentHp -= hit;

      // ÖLMEDİ
      if (currentHp > 0) {
        hpRef.current = currentHp;
        setHp(currentHp);
        return;
      }

      // ÖLDÜ (Dead) 💀
      // 1. Durumu kilitle
      respawningRef.current = true;
      hpRef.current = 0;
      setHp(0); 

      // 2. Ödül ver
      const localZone = zoneRef.current;
      const localStep = stepRef.current;
      const base = monsterMineral(localZone, localStep);
      const activeGoldMult = getGoldMultiplier(); // Metal Detector
      
      // BOSS REWARD BONUS
      let bossRewardMul = 1;
      if (localZone % 5 === 0) {
           bossRewardMul = totals.protocolModifiers?.bossRewardMult || 1;
      }
      
      // CHEST REWARD BONUS (10x)
      let chestMul = 1;
      if (isChest) {
          chestMul = 10;
      }
      
      const gained = D(base)
        .mul(totals.mineralMult || 1)
        .mul(bossRewardMul)
        .mul(chestMul) // 📦
        .mul(activeGoldMult)
        .floor();
      dispatchEco({ type: "GAIN_MINERALS", amount: gained });

      // 📊 Stats (Kill & Eco)
      const s = statsRef.current;
      if (s && s.lifetime) {
          // Kills
          s.lifetime.totalMonstersKilled = (s.lifetime.totalMonstersKilled || 0) + 1;
          s.thisRewind.monstersKilled = (s.thisRewind.monstersKilled || 0) + 1;

          if (localZone % 5 === 0) {
             s.lifetime.totalBossesKilled = (s.lifetime.totalBossesKilled || 0) + 1;
             s.thisRewind.bossesKilled = (s.thisRewind.bossesKilled || 0) + 1;
             // Anomaly
             if (isPrimal) {
                 s.lifetime.totalAnomalyBossesKilled = (s.lifetime.totalAnomalyBossesKilled || 0) + 1;
                 s.thisRewind.anomalyBossesKilled = (s.thisRewind.anomalyBossesKilled || 0) + 1;
             }
          }

          // Gold
          s.lifetime.totalGoldEarned = D(s.lifetime.totalGoldEarned).add(gained).toString();
          s.thisRewind.goldEarned = D(s.thisRewind.goldEarned).add(gained).toString();
          s.thisSession.goldEarned = D(s.thisSession.goldEarned).add(gained).toString();

          // Highest Sector
          if (localZone > (s.lifetime.highestSector || 1)) s.lifetime.highestSector = localZone;
          if (localZone > (s.thisRewind.highestSector || 1)) s.thisRewind.highestSector = localZone;
      }

      // Primal Reward
      if (isPrimal) {
          const rawPReward = getPrimalReward(localZone);
          if (rawPReward > 0) {
             const fragMult = totals.protocolModifiers?.anomalyFragmentMult || 1;
             const pReward = Math.floor(rawPReward * fragMult);
             
             dispatchEco({ type: "GAIN_FRAGMENTS", amount: pReward });
             
              // STARLINK TAG DROP LOGIC
              // 10% Chance + Protocol Bonus
              const dropChance = (STARLINK_CONFIG.DROP_CHANCE || 0.1) + (totals.protocolModifiers?.starlinkTagDropBonus || 0);
              if (Math.random() < dropChance) {
                 dispatchEco({ type: "GAIN_TAG", amount: 1 });
                 // Toast Logic (We don't know who got it until we check state, 
                 // but dispatch happens asynchronously. 
                 // For now, simpler: Just show "Starlink Tag Found!"
                 // Or we can peek at who would get it (random).
                 setTagToast({ message: "Starlink Tag Found!" });
                 setTimeout(() => setTagToast(null), 3000);
             }

             // 📊 Stats (Fragments)
             if (s && s.lifetime) {
                 s.lifetime.totalStellarFragmentsEarned = D(s.lifetime.totalStellarFragmentsEarned).add(pReward).toString();
                 s.lifetime.totalAnomalySfEarned = D(s.lifetime.totalAnomalySfEarned).add(pReward).toString();
                 
                 s.thisRewind.sfGained = D(s.thisRewind.sfGained).add(pReward).toString();
                 s.thisRewind.sfFromAnomalies = D(s.thisRewind.sfFromAnomalies).add(pReward).toString();
                 
                 if (D(pReward).gt(s.lifetime.biggestSfGainOneRewind)) {
                     // Technically biggest drop, not run total. Naming mismatch?
                     // "Biggest SF Gain In One Rewind" usually means MAX(sfGained). 
                     // Or "Biggest Single Drop"? User asked "Biggest Single Loot Drop" separately.
                     // I'll update "Biggest Single Loot" here.
                 }
             }
          }
      }

      // 3. Delay (200ms -> "Kısa" dediği için)
      setTimeout(() => {
        let nextZone = localZone;
        let nextStep = localStep;
        
        const isFarm = modeRef.current === "farm";
        const bossPlanet = localZone % 5 === 0;

        // --- Next Level Logic ---
        if (bossPlanet) {
          // Boss Planet
          if (isFarm) {
             // Farm Boss: Stay on step 1 (Farm modu boss kesince step 1'e atar genelde)
             nextStep = 1; 
          } else {
             // Progress: Next Zone
             nextZone += 1;
             nextStep = 1;
          }
        } else {
          // Normal Planet (Steps 1-10)
          // KUMA / Warp Drive Check
          const requiredKills = Math.max(2, 10 - (totals.zoneMonsterReducer || 0));
          
          if (localStep < requiredKills) {
              nextStep += 1;
          } else {
              // End of Zone
              if (isFarm) {
                  nextStep = 1; // Loop back
              } else {
                  nextZone += 1; // Next Zone
                  nextStep = 1;
              }
          }
        }

        // Commit progression
        if (!isFarm && nextZone > maxUnlockedZone) {
          setMaxUnlockedZone(nextZone);
        }

        zoneRef.current = nextZone;
        stepRef.current = nextStep;
        
        const newMax = monsterHp(nextZone, nextStep, totals.hpGrowthMult || 1);
        hpRef.current = newMax;
        maxHpRef.current = newMax;

        setZone(nextZone);
        setStep(nextStep);
        setMaxHp(newMax);
        setHp(newMax);

        // Respawn bitti, tekrar vurabiliriz
        respawningRef.current = false;
        
      }, 500); 
    },
    [dispatchEco, totals.mineralMult, totals.hpGrowthMult, maxUnlockedZone, isPrimal],
  );

  // ---------------------------------------------------------------------------
  // NEW: Active Skills System (Clicker Heroes Style)
  // ---------------------------------------------------------------------------
  
 

  // --- METHODS ---
  // --- METHODS ---
  const isSkillUnlockable = (skillId) => {
    // 1. Find the target active skill
    const activeSkillDef = SKILLS_CONFIG.find(s => s.id === skillId);
    if (!activeSkillDef) return false;

    // 2. Identify the Miner responsible for unlocking it
    const minerId = activeSkillDef.minerUnlockId;
    if (!minerId) return false;

    // 3. Check if user owns the SPECIFIC 'unlockActiveSkill' upgrade for this skill
    const purchasedMap = eco.ownedSkills[minerId] || {};
    const minerDef = minersDef.find(m => m.id === minerId);
    
    if (!minerDef?.skills) return false;

    for (const sk of minerDef.skills) {
        if (sk.kind === "unlockActiveSkill" && sk.value === skillId) {
             // Found the unlocker skill. Is it purchased?
             return !!purchasedMap[sk.id];
        }
    }
    
    // Fallback: If no unlock skill defined in miner, maybe default unlock?
    // For now, assume strict requirement. return false.
    // User requested: "Miner içerisinde skill'i satın aldığımda".
    // If I haven't added the skill to miners.json yet (e.g. miners 4-9), this will return false.
    // To prevent blocking access to miners 4-9 while I update json, I can add a fallback check?
    // "If no unlocker skill exists in definition, use old logic (miner owned > 0)"
    
    const hasUnlockerDefined = minerDef.skills.some(sk => sk.kind === "unlockActiveSkill" && sk.value === skillId);
    if (!hasUnlockerDefined) {
        return (eco.ownedMiners[minerId] || 0) > 0;
    }
    
    return false;
  };

  const purchaseActiveSkill = (skillId) => {
    const skill = SKILLS_CONFIG.find(s => s.id === skillId);
    if (!skill) return;
    const cost = D(skill.cost);
    
    // Check cost against Minerals
    if (eco.minerals.lt(cost)) return;
    
    // Deduct
    dispatchEco({ type: "GAIN_MINERALS", amount: cost.times(-1) });
    setOwnedActiveSkills(prev => ({ ...prev, [skillId]: (prev[skillId]||0) + 1 }));
  };

  const resetSkillCooldowns = () => {
    setSkillCooldowns({});
    // Optional: Also clear active skills? Or let them run out?
    // User asked to reset cooldowns.
  };

  const activateSkill = (skillId) => {
    const skill = SKILLS_CONFIG.find(s => s.id === skillId);
    if (!skill) return;

    const now = Date.now();
    if (skillCooldowns[skillId] && skillCooldowns[skillId] > now) return;

    // Handle Energize Consumption
    let multiplier = 1;
    if (energizeRef.current && skill.effect !== 'energize') {
        // Base 2x, plus protocol bonus (s_energize)
        const energizeBonus = totals.protocolModifiers?.skillValueBonus?.['s_energize'] || 0;
        multiplier = 2 + energizeBonus;
        energizeRef.current = false; 
    }

    // Apply Effects
    if (skill.effect === 'energize') {
        energizeRef.current = true;
    } 
    else if (skill.effect === 'reload') {
        if (lastUsedSkillRef.current) {
            const baseReduction = 3600000;
            const extraRed = totals.protocolModifiers?.skillValueBonus?.['s_reload'] || 0;
            setSkillCooldowns(prev => ({
                ...prev,
                [lastUsedSkillRef.current]: Math.max(now, (prev[lastUsedSkillRef.current] || now) - (baseReduction + extraRed))
            }));
        }
    }
    else if (skill.effect === 'darkRitual') {
        const extraVal = totals.protocolModifiers?.skillValueBonus?.['s_darkritual'] || 0;
        const baseVal = skill.value + extraVal;
        const bonus = (baseVal - 1) * multiplier + 1;
        setDarkRitualMult(prev => prev * bonus);
    }
    else {
        // Duration Skill
        // Apply Protocol Duration Bonus
        const bonusMs = totals.protocolModifiers?.skillDurationBonusMs?.[skillId] || 0;
        setActiveSkills(prev => ({
            ...prev,
            [skillId]: now + skill.duration + bonusMs
        }));
    }

    // Set Cooldown
    // Apply Protocol Cooldown Reduction (multiplicative)
    // Formula: cooldown * (1 - reduction) ... we stored 'mult' in modifiers (e.g. 0.95^lvl)
    const cdMult = totals.protocolModifiers?.skillCooldownMult?.[skillId];
    // Default 1 if undefined
    const finalCdMult = (cdMult !== undefined) ? cdMult : 1;
    
    setSkillCooldowns(prev => ({
        ...prev,
        [skillId]: now + (skill.cooldown * finalCdMult)
    }));
    
    if (skill.effect !== 'reload' && skill.effect !== 'energize') {
         lastUsedSkillRef.current = skillId;
    }
  };

  // --- LOOPS ---
  // 1. Skill Expiry & Effects Loop (100ms)
  // Loop moved to after handleTap definition to avoid TDZ

  const calcTapDamage = useCallback((trackStats = false, isAuto = false) => {
    const s = statsRef.current;
    
    // 1. Base (from Totals)
    // totals.tapDamage already includes (Miners Fixed + DPS * Ratio)
    let dmg = D(totals.tapDamage);
    
    // 2. Tap Power Multiplier (Fragsworth)
    // We assume 'tapPowerLevel' is tracked somewhere.
    // For now, let's use a placeholder '1.0' or read from 'ownedConstants'?
    // Let's assume 'totals.breakdown.tapMult' is part of it.
    // User requested separate explicit multiplier.
    // "TapPowerMultiplier = 1 + tapPowerLevel * 0.2"
    // We'll calculate it if we have a level source. 
    // Assuming level 0 for now as no upgrade exists yet.
    const tapPowerLevel = 0; // TODO: Connect to upgrade
    const tapPowerMult = 1 + tapPowerLevel * DAMAGE_CONFIG.TAP_POWER_PER_LEVEL;
    dmg = dmg.mul(tapPowerMult);
    
    // 3. Streak Multiplier (Juggernaut)
    // StreakMultiplier = 1 + min(count, cap) * bonus
    const streakCount = tapStreakRef.current;
    const cappedStreak = Math.min(streakCount, DAMAGE_CONFIG.STREAK_CAP);
    const streakMult = 1 + cappedStreak * DAMAGE_CONFIG.STREAK_BONUS_PER_TAP;
    dmg = dmg.mul(streakMult);
    
    // 3.5. Protocol Combo Bonus (Momentum Combo Core)
    // "Adds a stacking tap combo bonus... per level"
    // Formula: (BonusPerTap * Level) * Count
    // We calculated (BonusPerTap * Level) in modifiers as 'comboBonusPerTap'.
    const pComboBonus = totals.protocolModifiers?.comboBonusPerTap || 0;
    if (pComboBonus > 0) {
        // Linear stacking? "each consecutive tap increases ... by +0.01%".
        // It implies (1 + count * bonus).
        // Similar to streakMult but separate or additive to it?
        // User: "Additive in percent form". 
        // Let's multiply dmg by (1 + count * pComboBonus).
        const pStreakMult = 1 + streakCount * pComboBonus;
        dmg = dmg.mul(pStreakMult);
    }
    
    // 4. Crit (Bhaal + Lucky Strikes)
    // Base Chance + Bonus
    // Base Mult + Bonus
    const critChance = totals.critChance; // aggregated in damage.js
    const critBonus = getCritChanceBonus();
    const finalCritChance = Math.min(1.0, critChance + critBonus);
    
    const isCritNow = Math.random() < finalCritChance;
    
    let finalDmg = dmg;
    if (isCritNow) {
        const critMultBase = totals.critMult;
        // Apply Crit Multiplier logic if separate? 
        // totals.critMult already includes 'critMultiplier' ancient/skill bonuses.
        // Formula: Dmg * CritMult
        finalDmg = finalDmg.mul(critMultBase);
    }
    
    // 5. Skill Multipliers (Super Clicks, Energize)
    // We delegate to getTapMultiplier which checks activeSkills
    finalDmg = finalDmg.mul(getTapMultiplier());
    
    // --- Stats Tracking ---
    if (trackStats && s && s.lifetime) {
        // Taps
        s.lifetime.totalTaps = (s.lifetime.totalTaps || 0) + 1;
        s.thisRewind.totalTaps = (s.thisRewind.totalTaps || 0) + 1;
        s.thisSession.totalTaps = (s.thisSession.totalTaps || 0) + 1;

        // Damage (Safe decimal add)
        s.lifetime.totalTapDamage = D(s.lifetime.totalTapDamage).add(finalDmg).toString();
        s.lifetime.totalDamage = D(s.lifetime.totalDamage).add(finalDmg).toString();
        
        s.thisRewind.damageTap = D(s.thisRewind.damageTap).add(finalDmg).toString();
        s.thisRewind.damageAll = D(s.thisRewind.damageAll).add(finalDmg).toString();
        
        s.thisSession.damageAll = D(s.thisSession.damageAll).add(finalDmg).toString();

        // Peaks
        if (D(finalDmg).gt(s.lifetime.highestTapHit)) s.lifetime.highestTapHit = finalDmg;
        if (D(finalDmg).gt(s.thisRewind.highestTapHit)) s.thisRewind.highestTapHit = finalDmg;

        // Stats: Streak
        if (streakCount > (s.lifetime.longestStreak || 0)) s.lifetime.longestStreak = streakCount;
        if (streakCount > (s.thisRewind.longestStreak || 0)) s.thisRewind.longestStreak = streakCount;

        // Crit
        if (isCritNow) {
            s.lifetime.totalCriticalTaps = (s.lifetime.totalCriticalTaps || 0) + 1;
            s.thisRewind.criticalTaps = (s.thisRewind.criticalTaps || 0) + 1;
            if (D(finalDmg).gt(s.lifetime.peakCriticalTapHit)) s.lifetime.peakCriticalTapHit = finalDmg;
            if (D(finalDmg).gt(s.thisRewind.peakCritTapHit)) s.thisRewind.peakCritTapHit = finalDmg;
        }
    }

    return { dmg: finalDmg, isCrit: isCritNow };
  }, [totals.tapDamage, totals.critChance, totals.critMult, activeSkills, getCritChanceBonus, getTapMultiplier]);





  const handleTap = useCallback((isAuto = false) => {
    const now = Date.now();
    
    // 1. Streak Update
    lastTapTimeRef.current = now;
    
    // Check for Momentum Combo Core (Protocol ID: momentum_combo_core)
    const hasComboProtocol = (eco.cosmicProtocols?.['momentum_combo_core'] || 0) > 0;

    if (hasComboProtocol) {
        tapStreakRef.current += 1;
        setUiStreak(tapStreakRef.current);
    } else {
        // Reset if they mistakenly click or protocol is locked
        if (tapStreakRef.current > 0) {
            tapStreakRef.current = 0;
            setUiStreak(0);
        }
    }
    
    // Reset Idle Logic
    setIsIdle(false);
    
    // 2. Damage Calc
    
    // 2. Damage Calc
    const { dmg, isCrit } = calcTapDamage(true, isAuto);
    applyDamage(dmg);
    
    // 3. Visuals (Only manual usually, or sparse auto)
    // If auto is 10cps, floating text spam is bad. 
    // We can handle visuals outside.
    return { dmg, isCrit };
  }, [applyDamage, calcTapDamage, eco.cosmicProtocols]);


  // Re-calc if static stats change

  useEffect(() => {
    dpsRef.current = totalDps;
  }, [totalDps]);

  // ✅ Ref for applyDamage to avoid stale closures in setInterval
  const applyDamageRef = useRef(applyDamage);
  useEffect(() => {
    applyDamageRef.current = applyDamage;
  }, [applyDamage]);

  // --- ACTIVE SKILLS LOOP ---
  useEffect(() => {
    const timer = setInterval(() => {
        const now = Date.now();
        
        // 1. Streak Timeout
        if (tapStreakRef.current > 0) {
            if (now - lastTapTimeRef.current > DAMAGE_CONFIG.STREAK_TIMEOUT_MS) {
                tapStreakRef.current = 0;
                setUiStreak(0);
            }
        }
        
        // 2. Clickstorm ('s_clickstorm')
        const csExpiry = activeSkills['s_clickstorm'];
        if (csExpiry && csExpiry > now) {
            handleTap(true); // isAuto = true
        }
    }, 100); // 10 ticks/sec
    return () => clearInterval(timer);
  }, [activeSkills, handleTap]);

  // --- IDLE CHECK LOOP (1s) ---
  useEffect(() => {
      const timer = setInterval(() => {
          const now = Date.now();
          const timeSinceTap = now - lastTapTimeRef.current;
          if (timeSinceTap > 60000 && !isIdle) {
              setIsIdle(true);
          }
      }, 1000);
      return () => clearInterval(timer);
  }, [isIdle]);

  useEffect(() => {
    const TICK_MS = 250;

    const id = setInterval(() => {
      const dps = dpsRef.current;
      
      // 📊 Stats (Time) - ALWAYS TRACK TIME
      const s = statsRef.current;
      if (s && s.lifetime) {
          s.lifetime.totalTimePlayed = (s.lifetime.totalTimePlayed || 0) + TICK_MS;
          s.thisRewind.timePlayed = (s.thisRewind.timePlayed || 0) + TICK_MS;
          // In combat vs idle? Assuming always combat for now
          s.lifetime.totalTimeInCombat = (s.lifetime.totalTimeInCombat || 0) + TICK_MS;
          
          if (dps > 0) {
             if (D(dps).gt(s.lifetime.highestDps)) s.lifetime.highestDps = D(dps).toString();
             if (D(dps).gt(s.thisRewind.highestDps)) s.thisRewind.highestDps = D(dps).toString();
          }
      }

      // Damage only if DPS > 0
      if (dps <= 0) return;

      const dmg = dps * (TICK_MS / 1000);

      // 📊 Stats (DPS Damage)
      if (s && s.lifetime) {
          s.lifetime.totalDpsDamage = D(s.lifetime.totalDpsDamage).add(dmg).toString();
          s.lifetime.totalDamage = D(s.lifetime.totalDamage).add(dmg).toString();
          
          s.thisRewind.damageDps = D(s.thisRewind.damageDps).add(dmg).toString();
          s.thisRewind.damageAll = D(s.thisRewind.damageAll).add(dmg).toString();
          
          s.thisSession.damageAll = D(s.thisSession.damageAll).add(dmg).toString();
      }

      applyDamageRef.current(dmg);
    }, TICK_MS);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // Boss planet'e girince timer başlasın; çıkınca sıfırlansın
    if (isBossPlanet) {
      setBossTimeMsLeft(30_000);
    } else {
      setBossTimeMsLeft(0);
    }
  }, [isBossPlanet, zone]);

  // boss timer tick
  useEffect(() => {
    if (!isBossPlanet) return;
    if (bossTimeMsLeft <= 0) return;

    const t = setInterval(() => {
      setBossTimeMsLeft((ms) => Math.max(0, ms - 100));
    }, 100);

    return () => clearInterval(t);
  }, [isBossPlanet, bossTimeMsLeft]);

  // boss failed
  useEffect(() => {
    if (!isBossPlanet) return;
    if (bossTimeMsLeft > 0) return;

    const newMax = monsterHp(zone, 1);
    setMaxHp(newMax);
    setHp(newMax);
    setHp(newMax);
    setBossTimeMsLeft(30_000);
    
    // 📊 Stats (Boss Failed)
    const s = statsRef.current;
    if (s && s.lifetime) {
        s.lifetime.totalBossesFailed = (s.lifetime.totalBossesFailed || 0) + 1;
        s.thisRewind.bossesFailed = (s.thisRewind.bossesFailed || 0) + 1;
    }
  }, [bossTimeMsLeft, isBossPlanet, zone]);

  // mode toggle
  const toggleMode = useCallback(() => {
    setMode((m) => (m === "progress" ? "farm" : "progress"));
  }, []);

  // buys (atomic)
  const buyOrUpgradeMiner = useCallback(
    (minerId, multiplier = 1) => {
      if (buyLockRef.current) return;

      buyLockRef.current = true;

      // 0. Cost Check (to ensure we don't track stats for failed buys)
      const def = minersDef.find((m) => m.id === minerId);
      if (def) {
          const lvl = Number(ownedMiners[minerId] || 0);
          const cost = getBulkCost(def, lvl, multiplier);
          
          if (D(minerals).gte(cost)) {
              // 📊 Stats
              if (statsRef.current && statsRef.current.lifetime) {
                  const s = statsRef.current;
                  s.lifetime.totalGoldSpent = D(s.lifetime.totalGoldSpent).add(cost).toString();
                  s.lifetime.totalMinersPurchased = (s.lifetime.totalMinersPurchased || 0) + multiplier;
                  
                  s.thisRewind.goldSpent = D(s.thisRewind.goldSpent).add(cost).toString();
                  
                  // Purchases Count
                  s.lifetime.totalPurchasesCount = (s.lifetime.totalPurchasesCount || 0) + 1;
                  s.lifetime.totalPurchasesCount = (s.lifetime.totalPurchasesCount || 0) + 1;
                  if (D(cost).gt(s.lifetime.biggestSinglePurchase)) {
                      s.lifetime.biggestSinglePurchase = D(cost).toString();
                  }

                  // Levels
                  s.lifetime.totalMinerLevels = (s.lifetime.totalMinerLevels || 0) + multiplier;
                  const newLvl = lvl + multiplier;
                  if (newLvl > (s.lifetime.highestMinerLevel || 0)) {
                      s.lifetime.highestMinerLevel = newLvl;
                  }
                  
                  // Unlock count check? No, unlock count is separate.
                  // But miners unlocked is separate. 
                  // If lvl was 0 and now > 0, it means we "Purchased" a new miner type?
                  // "Total Miners Unlocked" vs "Total Miners Purchased" (items vs upgrades)
                  // "Total Miners Purchased" is likely quantity of upgrades.
                  // "Total Miners Unlocked" is tracked in UNLOCK_UP_TO or manually here if lvl==0.
                  if (lvl === 0) {
                       s.lifetime.totalMinersUnlocked = (s.lifetime.totalMinersUnlocked || 0) + 1;
                  }
              }
          }
      }

      // ✅ optimistic update: UI hemen level artmış görsün
      setPendingOwnedMiners((prev) => {
        const base = Number(ownedMiners[minerId] || 0);
        const alreadyPending = Number(prev[minerId] || 0);
        return { ...prev, [minerId]: Math.max(base, alreadyPending) + multiplier };
      });

      dispatchEco({ type: "BUY_MINER", minerId, amount: multiplier });
      dispatchEco({ type: "CHECK_MILESTONES" }); // ✅ Check unlock milestones

      requestAnimationFrame(() => {
        buyLockRef.current = false;
      });
    },
    [ownedMiners],
  );

  useEffect(() => {
    // Reducer state güncellendiğinde optimistic layer'ı temizle
    if (Object.keys(pendingOwnedMiners).length) {
      setPendingOwnedMiners({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownedMiners]);

  useEffect(() => {
    // Zaten hepsi açıksa çık
    if (unlockedCount >= minersDef.length) return;

    // Açılacak miner = unlockedCount (0-based)
    // Kural: Miner (n+1) açılması için minerals >= baseCost(miner n)
    // Başlangıçta 2 açık => 3. miner için miner[1] baseCost hedef.
    const prevIndex = unlockedCount - 1; // n
    if (prevIndex < 0) return;

    const prevMiner = minersDef[prevIndex];
    const threshold = D(prevMiner?.baseCost ?? 0);

    if (threshold.lte(0)) return;

    // ✅ anlık minerals yeterliyse unlockCount +1 (kalıcı)
    if (D(minerals).gte(threshold)) {
      dispatchEco({ type: "UNLOCK_UP_TO", count: unlockedCount + 1 });
      
      // 📊 Stats (Unlock) - Only if we actually increased unlock count
      if (statsRef.current && statsRef.current.lifetime) {
          statsRef.current.lifetime.totalMinersUnlocked = (statsRef.current.lifetime.totalMinersUnlocked || 0) + 1;
      }
    }
  }, [minerals, unlockedCount]);




  // ---------------- Prestige Logic ----------------
  const [showRewindModal, setShowRewindModal] = useState(false);
  const prestigeReward = calculateStellarRewindReward(maxUnlockedZone, totals.ascendRewardMult || 1); 
  
  const confirmStellarRewind = useCallback(() => {
     dispatchEco({ type: "PERFORM_STELLAR_REWIND", amount: prestigeReward });
     
     // 📊 Reset Rewind Stats
     if (statsRef.current) {
        // Update Lifetime
        if (statsRef.current.lifetime) {
            statsRef.current.lifetime.totalRewinds = (statsRef.current.lifetime.totalRewinds || 0) + 1;
            if (D(prestigeReward).gt(0)) {
                 statsRef.current.lifetime.totalRewindsWithGain = (statsRef.current.lifetime.totalRewindsWithGain || 0) + 1;
            }
        }
        
        // Reset This Rewind
        statsRef.current.thisRewind = {
            ...DEFAULT_STATS.thisRewind,
            startTime: Date.now(),
        };
     }

     setShowRewindModal(false);
     setMode("progress");
     setZone(1);
     setMaxUnlockedZone(1);
     setStep(1);
  }, [prestigeReward]);

  const buySkill = useCallback((minerId, skillId) => {
    if (buyLockRef.current) return;

    // 1. Validate Miner
    const minerDef = minersDef.find((m) => m.id === minerId);
    if (!minerDef) return;

    // 2. Validate Skill
    const skill = minerDef.skills?.find((s) => s.id === skillId);
    if (!skill) return;

    // ✅ SPECIAL: Prestige Skill Intercept
    if (skill.kind === "prestige_unlock") {
        setShowRewindModal(true);
        return;
    }

    // 3. check level
    const lvl = Number(ownedMiners[minerId] || 0);
    const unlockAt = Number(skill.unlockAt || 9999);
    if (lvl < unlockAt) return;

    // 4. check cost
    const cost = D(skill.cost || 0);
    if (D(minerals).lt(cost)) return;

    // 5. check if owned
    if (ownedSkills?.[minerId]?.[skillId]) return;

    buyLockRef.current = true;
    // 📊 Stats
    if (statsRef.current && statsRef.current.lifetime) {
        const s = statsRef.current;
        s.lifetime.totalGoldSpent = D(s.lifetime.totalGoldSpent).add(cost).toString();
        s.lifetime.totalSkillsPurchased = (s.lifetime.totalSkillsPurchased || 0) + 1;
        s.lifetime.totalPurchasesCount = (s.lifetime.totalPurchasesCount || 0) + 1;
        
        s.thisRewind.goldSpent = D(s.thisRewind.goldSpent).add(cost).toString();
        
        // Skill Levels / Count
        s.lifetime.totalSkillLevels = (s.lifetime.totalSkillLevels || 0) + 1; // 1 level per buy
        
        if (D(cost).gt(s.lifetime.biggestSinglePurchase)) {
            s.lifetime.biggestSinglePurchase = D(cost).toString();
        }
    }

    dispatchEco({ type: "BUY_SKILL", minerId, skillId, cost });

    requestAnimationFrame(() => {
      buyLockRef.current = false;
    });
  }, [minerals, ownedMiners, ownedSkills]);

  // ---------------- Auto Tapper Loop ----------------
  useEffect(() => {
    // Only ACTIVE drones tap
    const count = eco.activeDroneCount || 0;
    if (count <= 0) return;
    
    // 10 clicks per second = 100ms interval
    const interval = setInterval(() => {
        for(let i=0; i<count; i++) {
             handleTap(true); // isAuto = true
        }
    }, 100);

    return () => clearInterval(interval);
  }, [eco.activeDroneCount, handleTap]);

  const collectOfflineEarnings = useCallback((multiplier = 1) => {
    if (!offlineEarnings) return;
    
    const total = offlineEarnings.amount.mul(multiplier);
    dispatchEco({ type: "GAIN_MINERALS", amount: total });
    
    setOfflineEarnings(null); 
  }, [offlineEarnings]);

  // ---------------- Cosmic Store Logic ----------------
  // ---------------- Cosmic Store Logic ----------------
  const [showCosmicStore, setShowCosmicStore] = useState(false);
  const [showBigBangModal, setShowBigBangModal] = useState(false);

  const buyProtocol = useCallback((protocolId) => {
      dispatchEco({ type: "UPGRADE_PROTOCOL", protocolId }); // ✅ Fixed type match
  }, []);

  // BIG BANG LOGIC
  // BIG BANG LOGIC
  const calcBigBangGain = useCallback(() => {
      const highestZone = statsRef.current?.thisRewind?.highestZoneReached || maxUnlockedZone;
      const spentSF = eco.stellarFragmentsSpentLifetime || 0;
      
      let sectorTerm = Math.max(0, Math.floor((highestZone - 100) / 50));
      let spentTerm = Math.floor(Math.log10(Math.max(1, spentSF)) / 2);
      
      let gain = Math.max(0, sectorTerm + spentTerm);
      if (highestZone >= 150 && gain < 1) gain = 1;
      return { gain, highestZone }; // Return object for UI use
  }, [maxUnlockedZone, eco.stellarFragmentsSpentLifetime]);

  const performBigBang = useCallback(() => {
      // 1. Calculate Essence Gain
      const { gain } = calcBigBangGain();

      // 2. Dispatch
      dispatchEco({ type: "PERFORM_BIG_BANG", payload: { gainedEssence: gain } });
      
      // 3. Reset Local State
      setMode("progress");
      setZone(1);
      setShowBigBangModal(false); // Close modal
      setStep(1);
      setMaxUnlockedZone(1);
      setHp(monsterHp(1,1));
      setMaxHp(monsterHp(1,1));
      
      // Stats Reset if needed
      if (statsRef.current) {
          statsRef.current.thisRewind = { startTime: Date.now() };
      }
  }, [calcBigBangGain]);

  const buyUniversalConstant = useCallback((constantId) => {
      dispatchEco({ type: "BUY_UNIVERSAL_CONSTANT", constantId });
  }, []);

  const watchAdForMinerals = useCallback(() => {
      // 4 hours in ms
      const DURATION = 4 * 60 * 60 * 1000;
      const now = Date.now();
      const currentEnd = eco.mineralBonusEndTime || 0;
      
      // If active, add to end. If not, start from now.
      const newEnd = Math.max(now, currentEnd) + DURATION;
      
      dispatchEco({ type: "EXTEND_MINERAL_BONUS", endTime: newEnd });
  }, [eco.mineralBonusEndTime]);

  return {
    // visuals / stage
    currentPlanet,
    currentPlanetImg,

    // progress
    mode,
    toggleMode,
    zone,
    step,
    isBossPlanet,
    isChest, // ✅ Exported for UI (e.g. show different sprite)

    // combat
    maxHp,
    hp,
    hpPct,
    bossTimeMsLeft,

    // economy
    minerals,
    eco, // ✅ Expose full eco state (needed for tags etc)
    ownedMiners: {
      ...ownedMiners,
      ...pendingOwnedMiners,
    },
    uiStreak, // Exported for Combo UI
    isIdle, // ✅ Exported for Mode Badge

    ownedSkills,
    buyOrUpgradeMiner,
    buySkill,

    // totals / damage
    totalDps,
    // totals / damage
    totalDps,
    totalDps,
    handleTap, // ✅ Exported for UI (GameStage onTap)
    calcTapDamage, // Raw calc
    // Skills API
    activateSkill,
    unlockSkill: purchaseActiveSkill,
    activeSkills,
    skillCooldowns,
    activeSkillLevels: ownedActiveSkills,
    ownedActiveSkills,
    SKILLS_CONFIG, // ✅ Exported for UI
    isSkillUnlockable,
    resetSkillCooldowns,
    
    // Offline
    offlineEarnings,
    unlockedCount,
    resetGame,
    isPrimal,
    isIdle, // ⬅️ Exported for UI effects 
    
    // Skills API
    activateSkill,
    unlockSkill: purchaseActiveSkill,
    activeSkills,
    skillCooldowns,
    activeSkillLevels: ownedActiveSkills,
    ownedActiveSkills,
    SKILLS_CONFIG,
    isSkillUnlockable,
    
    // Offline
    offlineEarnings,
    collectOfflineEarnings,

    // Zone Nav
    maxUnlockedZone,
    goNextZone,
    goPrevZone,
    
    // Prestige
    showRewindModal,
    setShowRewindModal,
    confirmStellarRewind,
    prestigeReward,
    
    // Starlink
    tagToast,

    // Idle State
    isIdle, // ✅ Exposed
    hasIdleBonus: totals.idleDpsMult > 1.01, // ✅ Epsilon check to avoid false positives
    stellarFragments: eco.stellarFragments,
    
    // Cosmic Protocols
    showCosmicStore,
    setShowCosmicStore,
    buyProtocol, // Legacy support if needed, or aliased to upgrade logic
    cosmicProtocols: eco.cosmicProtocols,
    
    // Summoning Exports (NEW)
    summonPool: eco.summonPool,
    rerollCount: eco.rerollCount || 0,
    getNextUnlockCost: () => {
        const ownedCount = Object.keys(eco.cosmicProtocols || {}).filter(k => eco.cosmicProtocols[k] > 0).length;
        return getNextUnlockCost(ownedCount);
    },
    
    unlockProtocol: (id) => dispatchEco({ type: "UNLOCK_PROTOCOL", protocolId: id }),
    rerollSlot: (idx) => dispatchEco({ type: "REROLL_SLOT", slotIndex: idx }),
    generateSummonPool: () => dispatchEco({ type: "GENERATE_SUMMON_POOL" }),
    upgradeProtocol: (id, amount = 1) => dispatchEco({ type: "UPGRADE_PROTOCOL", protocolId: id, amount }),

    // Statistics
    stats: statsRef.current, // 📊

    // Dev Tools Exports
    dispatchEco,
    setZone,
    setStep,
    setMaxUnlockedZone,
    
    // Big Bang Exports
    cosmicEssence: eco.cosmicEssence, // ✅ From eco
    universalConstantsLevels: eco.universalConstantsLevels, // ✅ From eco
    performBigBang,
    buyUniversalConstant,
    showBigBangModal,
    setShowBigBangModal,
    calcBigBangGain,
    
    // Ads
    mineralBonusEndTime: eco.mineralBonusEndTime,
    watchAdForMinerals,

    // SHARD SHOP
    shards: eco.shards,
    droneCount: eco.droneCount || 0,
    watchAdForShards: (amount = 25) => dispatchEco({ type: "GAIN_SHARDS", amount }),
    buyShopItem: (id, cost, payload) => dispatchEco({ type: "BUY_SHOP_ITEM", id, cost, payload }),
    toggleDrone: () => dispatchEco({ type: "TOGGLE_DRONE" }),
    activeDroneCount: eco.activeDroneCount || 0,
    droneCount: eco.droneCount || 0,
  };
}
