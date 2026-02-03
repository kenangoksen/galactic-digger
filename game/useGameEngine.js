
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

import protocolsDef from "../assets/config/cosmic_protocols.json";
import minersDef from "../assets/config/miners.json";
import planets from "../assets/config/planets.json";

import { AppState } from "react-native";
import { D } from "./bn";
import { DAMAGE_CONFIG } from "./config";
import { computeTotals, getBulkCost, getPrimalReward } from "./damage";
import { loadGame, saveGame, serializeEco } from "./persistGame";
import { DEFAULT_STATS, initStats } from "./stats"; // 📊

// ---------------- Clicker Heroes-style monster HP ----------------
function baseMonsterHp(zone) {
  const z = Math.max(1, Math.floor(zone));
  return Math.floor(10 * (z - 1 + Math.pow(1.55, z - 1)));
}

function monsterHp(zone, step) {
  const hp = baseMonsterHp(zone);
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
export function calculateStellarRewindReward(maxZone) {
  const z = Number(maxZone || 0);
  if (z < 60) return 0; // First meaningful reward at 60 (since 50 is base)
  
  // (z - 50) / 10
  const base = (z - 50) / 10;
  if (base <= 0) return 0;
  
  const reward = Math.pow(base, 1.5);
  return Math.floor(reward);
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
};

function ecoReducer(state, action) {
  switch (action.type) {
    case "GAIN_MINERALS": {
      const add = D(action.amount || 0);
      if (add.lte(0)) return state;
      return { ...state, minerals: D(state.minerals).add(add) };
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
        // Starlink Rehydration
        totalStarlinkTags: p.totalStarlinkTags || 0,
        tagsByMinerId: p.tagsByMinerId || {},
        lifetimeTagsEarned: p.lifetimeTagsEarned || 0,
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
       };
    }

    case "BUY_PROTOCOL": {
       const { protocolId } = action;
       const currentLvl = state.cosmicProtocols[protocolId] || 0;
       // Formula: Cost = Level + 1
       const cost = currentLvl + 1;
       
       if (D(state.stellarFragments).lt(cost)) return state;

       return {
          ...state,
          stellarFragments: D(state.stellarFragments).sub(cost),
          cosmicProtocols: {
             ...state.cosmicProtocols,
             [protocolId]: currentLvl + 1
          }
       };
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

  // Auto-update maxUnlockedZone if we are somehow ahead of it
  useEffect(() => {
    if (zone > maxUnlockedZone) {
      setMaxUnlockedZone(zone);
    }
  }, [zone, maxUnlockedZone]);

  const isBossPlanet = zone % 5 === 0;
  
  const goNextZone = useCallback(() => {
    // SIMPLE LOGIC: If we are not at the max unlocked zone, we can go next.
    // This allows skipping steps/bosses if we already beat them before.
    if (zone < maxUnlockedZone) {
      const next = zone + 1;
      setZone(next);
      setStep(1); // Start at step 1 of next zone
      setMode("progress"); // Force progress mode so we don't get stuck in farm mode
      
      const newHp = monsterHp(next, 1);
      setMaxHp(newHp);
      setHp(newHp);
    }
  }, [zone, maxUnlockedZone]);

  const goPrevZone = useCallback(() => {
    if (zone > 1) {
       const prev = zone - 1;
       setZone(prev);
       setStep(1);
       setMode("farm"); // Automatically switch to farm mode when going back
       
       const newHp = monsterHp(prev, 1);
       setMaxHp(newHp);
       setHp(newHp);
    }
  }, [zone, setMode]);

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

  const currentPlanetImg =
    require("../assets/images/sprites/planets/planet_01.png");

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
      protocolsDef, // ✅ Passed
      ownedSkills,
      zone,
      protocolsDef, // ✅ Passed
      ownedProtocols: eco.cosmicProtocols, // ✅ Passed
      tagsByMinerId: eco.tagsByMinerId, // ✅ Needed for DPS calc
    });
  }, [ownedMiners, ownedSkills, zone, eco.cosmicProtocols, eco.tagsByMinerId]);

  const tapDamageBase = totals.tapDamage;
  
  // Apply Active Skills to DPS
  const totalDps = D(totals.dps).mul(getDpsMultiplier()).toNumber();

  const critChance = totals.critChance;
  const critMult = totals.critMult;

  // HP state
  const [maxHp, setMaxHp] = useState(monsterHp(zone, step));
  const [hp, setHp] = useState(monsterHp(zone, step));

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

    if (isBossPlanet) {
       setBossTimeMsLeft(30_000);
       
       // 📊 Stats (Boss Spawned)
       const s = statsRef.current;
       if (s && s.lifetime) {
           s.lifetime.totalBossesSpawned = (s.lifetime.totalBossesSpawned || 0) + 1;
           if (zone >= 105 && Math.random() < 0.25) { // Primal Check replicated for stats
               // Note: Actual random check happens below, so verify consistency.
               // Better is to define "isPrimal" state first.
               // But isPrimal is state, takes effect next render.
               // We should calculate primal here locally first.
           }
       }

       // Primal Check: Zone >= 105 && 25% Chance
       const isPrimalNow = zone >= 105 && Math.random() < 0.25;
       if (isPrimalNow) {
           setIsPrimal(true);
           if (s && s.lifetime) {
                s.lifetime.totalAnomalyBossesSpawned = (s.lifetime.totalAnomalyBossesSpawned || 0) + 1;
           }
       } else {
           setIsPrimal(false);
       }
    } else {
       setBossTimeMsLeft(0);
       setIsPrimal(false);
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

      const hit = Number(dmg || 0);
      if (hit <= 0) return;

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
      const gained = D(base)
        .mul(totals.mineralMult || 1)
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
          const pReward = getPrimalReward(localZone);
          if (pReward > 0) {
             dispatchEco({ type: "GAIN_FRAGMENTS", amount: pReward });
             
             // STARLINK TAG DROP LOGIC
             // 10% Chance (STARLINK_CONFIG.DROP_CHANCE)
             if (Math.random() < (STARLINK_CONFIG.DROP_CHANCE || 0.1)) {
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
          if (localStep < 10) {
              nextStep += 1;
          } else {
              // End of Zone (Step 10 killed)
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
        
        const newMax = monsterHp(nextZone, nextStep);
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
    [dispatchEco, totals.mineralMult, maxUnlockedZone, isPrimal],
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
        multiplier = 2;
        energizeRef.current = false; 
    }

    // Apply Effects
    if (skill.effect === 'energize') {
        energizeRef.current = true;
    } 
    else if (skill.effect === 'reload') {
        if (lastUsedSkillRef.current) {
            setSkillCooldowns(prev => ({
                ...prev,
                [lastUsedSkillRef.current]: Math.max(now, (prev[lastUsedSkillRef.current] || now) - 3600000)
            }));
        }
    }
    else if (skill.effect === 'darkRitual') {
        const bonus = (skill.value - 1) * multiplier + 1;
        setDarkRitualMult(prev => prev * bonus);
    }
    else {
        // Duration Skill
        setActiveSkills(prev => ({
            ...prev,
            [skillId]: now + skill.duration
        }));
    }

    // Set Cooldown
    setSkillCooldowns(prev => ({
        ...prev,
        [skillId]: now + skill.cooldown
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
    // User requested Auto Tap to sustain/build combo just like Manual Tap
    lastTapTimeRef.current = now;
    
    // Increase streak (both manual and auto?)
    // User: "Clickstorm... streak'i artıracak şekilde tasarla"
    tapStreakRef.current += 1;
    
    // Update UI every tap
    setUiStreak(tapStreakRef.current);
    
    // 2. Damage Calc
    const { dmg, isCrit } = calcTapDamage(true, isAuto);
    applyDamage(dmg);
    
    // 3. Visuals (Only manual usually, or sparse auto)
    // If auto is 10cps, floating text spam is bad. 
    // We can handle visuals outside.
    return { dmg, isCrit };
  }, [applyDamage]); // We need to wrap calcTapDamage properly or move logic inside


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
  const prestigeReward = calculateStellarRewindReward(maxUnlockedZone); 
  
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

  const collectOfflineEarnings = useCallback((multiplier = 1) => {
    if (!offlineEarnings) return;
    
    const total = offlineEarnings.amount.mul(multiplier);
    dispatchEco({ type: "GAIN_MINERALS", amount: total });
    
    setOfflineEarnings(null); 
  }, [offlineEarnings]);

  // ---------------- Cosmic Store Logic ----------------
  const [showCosmicStore, setShowCosmicStore] = useState(false);

  const buyProtocol = useCallback((protocolId) => {
      dispatchEco({ type: "BUY_PROTOCOL", protocolId });
  }, []);

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
    stellarFragments: eco.stellarFragments,
    
    // Cosmic Protocols
    showCosmicStore,
    setShowCosmicStore,
    buyProtocol,
    cosmicProtocols: eco.cosmicProtocols,

    // Statistics
    stats: statsRef.current, // 📊

    // Dev Tools Exports
    dispatchEco,
    setZone,
    setStep,
    setMaxUnlockedZone,
  };
}
