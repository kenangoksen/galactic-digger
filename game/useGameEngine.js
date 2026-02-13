// game/useGameEngine.js
// Modular game engine hook. Reducer and helpers extracted to separate modules.

import {
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";

import achievementsDef from "../assets/config/achievements.json";
import minersDef from "../assets/config/miners.json";
import planets from "../assets/config/planets.json";
import { PLANET_ANIM_META, PLANET_SPRITES } from "../assets/registry/planetSprites";

import { AppState } from "react-native";
import { createArtifact, getArtifactBonuses } from "./artifacts/artifactService";
import { ARTIFACT_AFFIX } from "./artifacts/artifactTypes";
import { D } from "./bn";
import { DAMAGE_CONFIG, STARLINK_CONFIG } from "./config";
import configCache from "./ConfigCache";
import { computeTotals, getBulkCost, getPrimalReward } from "./damage";
import { loadGame, saveGame, serializeEco } from "./persistGame";
import { DEFAULT_STATS, initStats } from "./stats";

// Extracted modules
import { ECO_INIT, ecoReducer } from "./ecoReducer";
import { calculateStellarRewindReward, getNextUnlockCost, monsterHp, monsterMineral } from "./monsterCalc";



// Re-export for external consumers
export { calculateStellarRewindReward, getNextUnlockCost } from "./monsterCalc";

export function useGameEngine() {
  // progress model
  const [mode, setMode] = useState("progress"); // "farm" | "progress"
  const [zone, setZone] = useState(1);
  const [step, setStep] = useState(1);
  const [maxUnlockedZone, setMaxUnlockedZone] = useState(1);
  const [isPrimal, setIsPrimal] = useState(false);
  const [isChest, setIsChest] = useState(false); // ğŸ“¦ Treasure Chest State
  



  // Syndicate Bonuses
  const [specialty, setSpecialty] = useState(null);
  const [specialtyLevel, setSpecialtyLevel] = useState(0);

  useEffect(() => {
    // Dynamic import to avoid cycles
    import("./syndicate/syndicateService").then(({ getUserProfile }) => {
        getUserProfile().then(p => {
            if (p) {
                setSpecialty(p.specialty);
                setSpecialtyLevel(p.specialtyLevel || 0); 
            }
        }).catch(() => {});
    });
  }, []);

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
  const minerals = eco.minerals; // âœ… Decimal dÄ±ÅŸarÄ±ya da Decimal dÃ¶ner
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
  
  // Time Warp Result State
  const [timeWarpResult, setTimeWarpResult] = useState(null);

  const resetGame = useCallback(async () => {
    // 1. Clear storage
    await import("./persistGame").then((m) => m.clearGame());
    // 2. Reset Memory
    setMode("progress");
    setZone(1);
    setMaxUnlockedZone(1); // âœ… Reset max zone too
    setStep(1);
    // ğŸ“Š Reset Memory Stats
    statsRef.current = initStats({}); 
    dispatchEco({ type: "RESET_GAME" });
  }, []);

  // 🪐 Planet visual — Pseudo-random based on GLOBAL STAGE (Zone + Step)
  const planetCount = planets?.length || 1;
  const globalStageIndex = (zone - 1) * 10 + (step - 1);
  // Use a large prime (9973) to scatter the index so 1,2,3... steps map to random-looking planets
  const planetIndex = planetCount > 0 ? ((globalStageIndex * 9973) % planetCount) : 0;
  const unlockedCount = eco.unlockedCount || 2;

  const currentPlanet = planets?.[planetIndex] ||
    planets?.[0] || {
      id: "planet_01",
      name: "Planet",
      sprite: "planet_01.png",
    };

  const currentPlanetImg = PLANET_SPRITES[currentPlanet.sprite] || PLANET_SPRITES["planet_01.png"];
  const currentPlanetData = currentPlanet.animated
    ? { animated: true, ...PLANET_ANIM_META[currentPlanet.sprite] }
    : null;

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

  // totals (tap + dps + crit + multipliers) â€” depends only on economy + zone
  const totals = useMemo(() => {
    return computeTotals({
      minersDef,
      ownedMiners,
      ownedSkills,
      zone,
      // Meta
      universalConstantsLevels: eco.universalConstantsLevels, // âœ… From Eco based on persistence
      cosmicProtocolLevels: eco.cosmicProtocols,
      constantsDef: configCache.getUniversalConstants()?.items, // âœ… From Cache
      protocolsDef: configCache.getCosmicProtocols()?.protocols, // âœ… From Cache
      tagsByMinerId: eco.tagsByMinerId,
      stellarFragmentsSpent: eco.stellarFragmentsSpentLifetime, // âœ…
      stellarFragments: eco.stellarFragments, // âœ… For Passive DPS
      dpsToTapMilestonesUnlocked: eco.dpsToTapMilestonesUnlocked, // âœ… Progress
      mineralBonusActive: Date.now() < (eco.mineralBonusEndTime || 0), // âœ… Ad Bonus Status
      activeArtifacts: eco.artifacts?.active?.map(id => eco.artifacts.byId[id]).filter(Boolean), // âœ… Artifacts
      // Syndicate
      specialty,
      specialtyLevel
    });
  }, [ownedMiners, ownedSkills, zone, eco.cosmicProtocols, eco.tagsByMinerId, eco.universalConstantsLevels, eco.stellarFragmentsSpentLifetime, eco.stellarFragments, eco.dpsToTapMilestonesUnlocked, eco.mineralBonusEndTime, eco.artifacts, specialty, specialtyLevel]);

  const tapDamageBase = totals.tapDamage;
  const totalClickDamage = D(tapDamageBase).mul(getTapMultiplier()).toNumber();
  
  // Apply Active Skills to DPS
  let totalDps = D(totals.dps).mul(getDpsMultiplier());
  // Apply Idle Bonus (Silent Observer)
  if (isIdle && totals.idleDpsMult > 1) {
      totalDps = totalDps.mul(totals.idleDpsMult);
  }
  totalDps = totalDps.toNumber();
  const dpsPctOfClick = totalClickDamage > 0 ? (totalDps / totalClickDamage) * 100 : 0;
  

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
  
  // ğŸ“Š Statistics Store
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

  // Sync Time Warp State (Fix)
  useEffect(() => {
    if (eco.lastTimeWarpResult) {
       if (__DEV__) console.log("Time Warp Result Sync Effect:", eco.lastTimeWarpResult); // ğŸ” Debug Log

       // Apply
       const targetZone = Number(eco.lastTimeWarpResult.finalZone);
       const targetStep = Number(eco.lastTimeWarpResult.finalStep);

       if (!isNaN(targetZone) && targetZone >= 1) {
           if (__DEV__) console.log("Setting Zone to:", targetZone); // ğŸ” Debug Log
           setZone(targetZone);
           if (targetZone > maxUnlockedZone) {
               if (__DEV__) console.log("Updating Max Zone to:", targetZone); // ğŸ” Debug Log
               setMaxUnlockedZone(targetZone);
           }
       } else {
           console.error("Time Warp Result gave NaN Zone!", eco.lastTimeWarpResult);
       }

       if (!isNaN(targetStep) && targetStep >= 1) {
           setStep(targetStep);
       }

       setMode("progress"); // Ensure we are moving
       
       // Force HP update immediately
       const validZone = !isNaN(targetZone) && targetZone >= 1 ? targetZone : zone;
       const validStep = !isNaN(targetStep) && targetStep >= 1 ? targetStep : step;
       
       const newHp = monsterHp(validZone, validStep, totals.hpGrowthMult || 1);
       setMaxHp(newHp);
       setHp(newHp);
    }
  }, [eco.lastTimeWarpResult, maxUnlockedZone, totals.hpGrowthMult]);

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
      // âœ… Hard Cap: 24 Hours (86400s)
      let remainingSeconds = Math.min(diffSeconds, 86400); 
      const originalSeconds = remainingSeconds; // For report

      const sEco = savedData.eco || {};
      let currentZone = Number(savedData.progress?.zone || 1);
      let currentStep = Number(savedData.progress?.step || 1);
      const startZone = currentZone;
      const startStep = currentStep;
      
      let totalEarned = D(0);
      let gainedFragments = D(0); // Potential future reward

      // 1. Calculate DPS (Static)
      let offlineDps = D(0);
      const minersDef = require("../assets/config/miners.json");
      
      // Re-calculate DPS from saved state
      Object.keys(sEco.ownedMiners || {}).forEach((mid) => {
        const lvl = sEco.ownedMiners[mid];
        const def = minersDef.find((m) => m.id === mid);
        if (def && lvl > 0) {
          const dpsBase = def.stats?.dpsBase || 0;
          offlineDps = offlineDps.add(D(dpsBase).mul(lvl));
        }
      });
      
      // âœ… Eternal Drift (Idle Dominance)
      const driftLevel = sEco.universalConstantsLevels?.['eternal_drift'] || 0;
      if (driftLevel > 0) {
          const driftMult = 1 + (Math.pow(1.5, driftLevel) - 1);
          offlineDps = offlineDps.mul(driftMult);
      }
      
      // âœ… Passive Fragment Bonus (if implemented in totals)
      // Usually totals.globalDpsMult accounts for this. 
      // We should ideally use `computeTotals` here but it requires full config context.
      // For now, let's assume raw DPS is close enough or replicate fragment bonus if key.
      const sfCount = Number(sEco.stellarFragments || 0);
      if (sfCount > 0) {
           offlineDps = offlineDps.mul(1 + sfCount * 0.10);
      }

      // Store Avg DPS for Report
      const avgDps = offlineDps;

      if (offlineDps.lte(0)) return;
      
      // ARTIFACT OFFLINE BONUS
      // Reconstitute artifacts from eco
      let artifactBonusMult = D(1);
      if (sEco.artifacts && sEco.artifacts.active && sEco.artifacts.byId) {
           const activeArts = sEco.artifacts.active.map(id => sEco.artifacts.byId[id]).filter(Boolean);
           const bonuses = getArtifactBonuses(activeArts);
           const offBonus = bonuses[ARTIFACT_AFFIX.OFFLINE_EARNINGS];
           if (offBonus) {
               artifactBonusMult = artifactBonusMult.plus(offBonus);
           }
      }

      // 2. Simulation Loop
      let iterations = 0;
      let farmZone = currentZone;
      let farmStep = currentStep;
      
      while (remainingSeconds > 0 && iterations < 10000) {
        iterations++;
        
        const isBoss = currentZone % 5 === 0;
        const zHp = monsterHp(currentZone, currentStep);
        const zReward = monsterMineral(currentZone, currentStep);

        let timeToKill = 0;
        if (offlineDps.gte(zHp)) {
            timeToKill = 0.1; // Instant
        } else {
            // Check max 30s rule
            const damageIn30s = offlineDps.mul(30);
            if (damageIn30s.lt(zHp)) {
                // FAIL! Cannot kill in 30s
                break; 
            }
            // Estimate kill time: HP / DPS
            // Approx for loop: 1s minimum per mob if not instant?
            // To be generous: 1s
            timeToKill = 1; 
        }

        // Stage Logic
        let mobsInStage = isBoss ? 1 : 10;
        let stageTime = timeToKill * mobsInStage;
        
        if (remainingSeconds >= stageTime) {
            // CLEARED STAGE
            remainingSeconds -= stageTime;
            totalEarned = totalEarned.add(D(zReward).mul(mobsInStage));
            
            // Advance
            if (isBoss) {
                currentZone++;
                currentStep = 1;
            } else {
                if (currentStep < 10) {
                    currentStep++;
                } else {
                    currentZone++;
                    currentStep = 1; 
                }
            }
            
            // Track farthest reached
            farmZone = currentZone;
            farmStep = currentStep;
        } else {
            // Partial farm
            break; 
        }
      }

      // 3. Farming (Wall Hit or Time Ran Out)
      // If we broke because of wall, retreat logic
      const zHp = monsterHp(currentZone, currentStep);
      const damageIn30s = offlineDps.mul(30);
      const canKill = damageIn30s.gte(zHp);
      
      if (!canKill) {
          // Retreat to previous zone end
          if (farmZone > 1 || farmStep > 1) {
              if (farmStep > 1) farmStep--;
              else {
                  farmZone--;
                  farmStep = 10;
              }
          }
      }
      
      // Calculate remaining time farming safe zone
      if (remainingSeconds > 0) {
           const fHp = monsterHp(farmZone, farmStep);
           const fReward = monsterMineral(farmZone, farmStep);
           
           if (fHp > 0) {
               // Total Dmg potential
               const potDmg = offlineDps.mul(remainingSeconds);
               // Rewards = (PotentialDamage / HP) * Reward
               // Safe approx:
               const farmed = potDmg.mul(fReward).div(fHp).floor();
               totalEarned = totalEarned.add(farmed);
           }
      }

      if (totalEarned.gt(0)) {
          // Apply Artifact Bonus
          totalEarned = totalEarned.mul(artifactBonusMult).floor();

          const zonesGained = Math.max(0, farmZone - startZone);
          
          if (__DEV__) console.log(`OFFLINE SIM: Reached Z${currentZone}. Gained ${zonesGained} Zones. Total: ${totalEarned}`);
          
          setOfflineEarnings({ 
              amount: totalEarned, 
              seconds: originalSeconds,
              avgDps: avgDps, // âœ… Pass DPS
              zonesGained: zonesGained, // âœ… Pass Zone Prog
              startZone: startZone,
              endZone: farmZone
          });
          
          // COMMIT PROGRESS
          // Put them at "Wall" (currentZone) so they see what they stuck on
          // OR if they advanced, update game state
          if (currentZone > startZone || (currentZone === startZone && currentStep > startStep)) {
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
        
        // ğŸ“Š Load Stats
        if (loaded.stats) {
            statsRef.current = initStats(loaded.stats);
        } else {
            statsRef.current = initStats({});
        }

        // ğŸ”„ RETROACTIVE SYNC: If stats are fresh but game is advanced, sync them up
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
                stats: statsRef.current, // ğŸ“Š
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
        stats: statsRef.current, // ğŸ“Š
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

    const s = statsRef.current; // âœ… Moved to top scope

    // ğŸ“Š Stats (Boss Spawned)
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
      if (respawningRef.current) return; // ğŸ›‘ Respawn sÄ±rasÄ±nda hasar yok

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

      // Ã–LMEDÄ°
      if (currentHp > 0) {
        hpRef.current = currentHp;
        setHp(currentHp);
        return;
      }

      // Ã–LDÃœ (Dead) ğŸ’€
      // 1. Durumu kilitle
      respawningRef.current = true;
      hpRef.current = 0;
      setHp(0); 

      // 2. Ã–dÃ¼l ver
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
        .mul(chestMul) // ğŸ“¦
        .mul(activeGoldMult)
        .floor();
      dispatchEco({ type: "GAIN_MINERALS", amount: gained });

      // ğŸ“Š Stats (Kill & Eco)
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

             // ARTIFACT SHARD FIND
             if (totals.shardFindChance > 0 && Math.random() < totals.shardFindChance) {
                 dispatchEco({ type: "GAIN_SHARDS", amount: 1 });
                 // Optional: Toast
             }
             
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

             // ğŸ“Š Stats (Fragments)
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

      // 3. Delay (200ms -> "KÄ±sa" dediÄŸi iÃ§in)
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
    // User requested: "Miner iÃ§erisinde skill'i satÄ±n aldÄ±ÄŸÄ±mda".
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
      setOwnedActiveSkills((prev) => ({
        ...prev,
        [skillId]: (prev[skillId] || 0) + 1,
      }));

      // ğŸ“Š Stats: Track Skill Purchases
      if (statsRef.current && statsRef.current.lifetime) {
          statsRef.current.lifetime.totalSkillsPurchased = (statsRef.current.lifetime.totalSkillsPurchased || 0) + 1;
      }
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

  // âœ… Ref for applyDamage to avoid stale closures in setInterval
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
      
      // ğŸ“Š Stats (Time) - ALWAYS TRACK TIME
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

      // ğŸ“Š Stats (DPS Damage)
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
    // Boss planet'e girince timer baÅŸlasÄ±n; Ã§Ä±kÄ±nca sÄ±fÄ±rlansÄ±n
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
    
    // ğŸ“Š Stats (Boss Failed)
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
              // ğŸ“Š Stats
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

      // âœ… optimistic update: UI hemen level artmÄ±ÅŸ gÃ¶rsÃ¼n
      setPendingOwnedMiners((prev) => {
        const base = Number(ownedMiners[minerId] || 0);
        const alreadyPending = Number(prev[minerId] || 0);
        return { ...prev, [minerId]: Math.max(base, alreadyPending) + multiplier };
      });

      dispatchEco({ type: "BUY_MINER", minerId, amount: multiplier });
      dispatchEco({ type: "CHECK_MILESTONES" }); // âœ… Check unlock milestones

      requestAnimationFrame(() => {
        buyLockRef.current = false;
      });
    },
    [ownedMiners],
  );

  useEffect(() => {
    // Reducer state gÃ¼ncellendiÄŸinde optimistic layer'Ä± temizle
    if (Object.keys(pendingOwnedMiners).length) {
      setPendingOwnedMiners({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownedMiners]);

  useEffect(() => {
    // Zaten hepsi aÃ§Ä±ksa Ã§Ä±k
    if (unlockedCount >= minersDef.length) return;

    // AÃ§Ä±lacak miner = unlockedCount (0-based)
    // Kural: Miner (n+1) aÃ§Ä±lmasÄ± iÃ§in minerals >= baseCost(miner n)
    // BaÅŸlangÄ±Ã§ta 2 aÃ§Ä±k => 3. miner iÃ§in miner[1] baseCost hedef.
    const prevIndex = unlockedCount - 1; // n
    if (prevIndex < 0) return;

    const prevMiner = minersDef[prevIndex];
    const threshold = D(prevMiner?.baseCost ?? 0);

    if (threshold.lte(0)) return;

    // âœ… anlÄ±k minerals yeterliyse unlockCount +1 (kalÄ±cÄ±)
    if (D(minerals).gte(threshold)) {
      dispatchEco({ type: "UNLOCK_UP_TO", count: unlockedCount + 1 });
      
      // ğŸ“Š Stats (Unlock) - Only if we actually increased unlock count
      if (statsRef.current && statsRef.current.lifetime) {
          statsRef.current.lifetime.totalMinersUnlocked = (statsRef.current.lifetime.totalMinersUnlocked || 0) + 1;
      }
    }
  }, [minerals, unlockedCount]);




  // ---------------- Prestige Logic ----------------
  const [showRewindModal, setShowRewindModal] = useState(false);
  const prestigeReward = calculateStellarRewindReward(maxUnlockedZone, totals.ascendRewardMult || 1); 
  
  const confirmStellarRewind = useCallback(() => {
     // 1. Generate Artifact
     const newArtifact = createArtifact(maxUnlockedZone);
     if (__DEV__) console.log("Creating Artifact:", newArtifact);
     
     // 2. Dispatch
     dispatchEco({ type: "PERFORM_STELLAR_REWIND", amount: prestigeReward, artifact: newArtifact });
     
     // ğŸ“Š Reset Rewind Stats
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

    // âœ… SPECIAL: Prestige Skill Intercept
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
    // ğŸ“Š Stats
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
    
    // 3x Boost Cost Logic
    if (multiplier === 3) {
        // Double check funds (UI handles it but safety first)
        if ((eco.shards || 0) < 50) return; 
        
        dispatchEco({ type: "GAIN_SHARDS", amount: -50 });
    }
    
    const total = offlineEarnings.amount.mul(multiplier);
    dispatchEco({ type: "GAIN_MINERALS", amount: total });
    
    setOfflineEarnings(null); 
  }, [offlineEarnings, eco.shards]);

  // ---------------- Cosmic Store Logic ----------------
  // ---------------- Cosmic Store Logic ----------------
  const [showCosmicStore, setShowCosmicStore] = useState(false);
  const [showBigBangModal, setShowBigBangModal] = useState(false);

  const buyProtocol = useCallback((protocolId) => {
      dispatchEco({ type: "UPGRADE_PROTOCOL", protocolId }); // âœ… Fixed type match
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
          if (statsRef.current.lifetime) {
              statsRef.current.lifetime.totalBigBangs = (statsRef.current.lifetime.totalBigBangs || 0) + 1;
          }
      }
  }, [calcBigBangGain]);

  // --- CLICKABLES SYSTEM ---
  const [activeClickable, setActiveClickable] = useState(null);
  const lastCometTimeRef = useRef(Date.now());
  const nextSpawnTimeRef = useRef(Date.now() + 30000); // Start with 30s delay

  // Spawn Loop (Piggyback on an existing loop or new enum?)
  // Let's use a dedicated effect for now to be clean, or merge into the main interval?
  // Game loop is complex. Let's add a lightweight interval for this.
  useEffect(() => {
      const interval = setInterval(() => {
          const now = Date.now();
          
          // 1. Check if active
          if (activeClickable) {
              // Check Expiry
              if (now > activeClickable.expiresAt) {
                  setActiveClickable(null);
                  // Schedule next
                  nextSpawnTimeRef.current = now + (20000 + Math.random() * 25000); // 20-45s
              }
              return;
          }

          // 2. Check Spawn Time
          if (now >= nextSpawnTimeRef.current) {
              // SPAWN!
              // Pity Check: 6 mins = 360000ms
              const timeSinceComet = now - lastCometTimeRef.current;
              let type = "SPACE_TRASH";
              
              if (timeSinceComet > 360000) {
                  type = "COMET"; // Pity Force
              } else {
                  // RNG: 20% Comet
                  if (Math.random() < 0.2) type = "COMET";
              }

              // Update Comet Time if Comet
              // Wait, strictly update on spawn or click? Usually spawn is enough to reset pity?
              // User said "6 dakika iÃ§inde Comet gelmediyse". So reset on spawn.
              if (type === "COMET") {
                  lastCometTimeRef.current = now;
              }

              // Safe Area (15-85% Y)
              const y = 0.15 + Math.random() * 0.70; 
              const x = 0.10 + Math.random() * 0.80; // avoid edges

              setActiveClickable({
                  id: now.toString(),
                  type,
                  x,
                  y,
                  createdAt: now,
                  expiresAt: now + 8000, // 8s TTL
              });
          }
      }, 1000); // Check every second
      return () => clearInterval(interval);
  }, [activeClickable]);

  const handleClickable = useCallback((item) => {
      if (!item) return;
      
      setActiveClickable(null);
      
      // Schedule next immediately on click (or wait? User said "interval 20-45s")
      // Usually interval starts AFTER click/despawn.
      nextSpawnTimeRef.current = Date.now() + (20000 + Math.random() * 25000);

      // REWARD
      if (item.type === "SPACE_TRASH") {
         // Formula: max(50, monsterMineral * 5)
         const baseReward = monsterMineral(zone, step);
         const scaled = D(baseReward).mul(5); 
         const finalAmount = scaled.lt(50) ? D(50) : scaled;
         
         dispatchEco({ type: "GAIN_MINERALS", amount: finalAmount });
         
         return { type: "MINERALS", amount: finalAmount };
      } else if (item.type === "COMET") {
         // 1-3 Shards
         const amount = 1;
         dispatchEco({ type: "GAIN_SHARDS", amount });
         
         return { type: "SHARDS", amount };
      }
      return null;
  }, [zone, step]);

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

  // 🏆 Achievements Watcher (Updates badge live)
  const [unclaimedAchievements, setUnclaimedAchievements] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
        // Calculate count from Ref (fresh data)
        const claimedList = eco.claimedAchievements || [];
        let count = 0;
        
        for (const ach of achievementsDef) {
            if (claimedList.includes(ach.id)) continue;

            const keys = ach.statKey.split(".");
            let val = statsRef.current;
            for (const k of keys) {
                val = val?.[k];
                if (val === undefined) break;
            }
            
            let numVal = 0;
            if (typeof val === 'string') {
                 numVal = D(val).toNumber();
            } else {
                 numVal = Number(val || 0);
            }

            if (numVal >= ach.threshold) {
                count++;
            }
        }

        setUnclaimedAchievements(prev => {
            if (prev !== count) return count;
            return prev;
        });

    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [eco.claimedAchievements]); // Re-create if claimed list changes

  return {
    // visuals / stage
    currentPlanet,
    currentPlanetImg,
    currentPlanetData, // 🎞️ Animation metadata (null for static)

    // progress
    mode,
    toggleMode,
    zone,
    step,
    isBossPlanet,
    isChest, // âœ… Exported for UI (e.g. show different sprite)

    // combat
    maxHp,
    hp,
    hpPct,
    bossTimeMsLeft,

    // economy
    minerals,
    eco, // âœ… Expose full eco state (needed for tags etc)
    ownedMiners: {
      ...ownedMiners,
      ...pendingOwnedMiners,
    },
    uiStreak, // Exported for Combo UI
    isIdle, // âœ… Exported for Mode Badge

    ownedSkills,
    buyOrUpgradeMiner,
    buySkill,

    // totals / damage
    totalDps,
    totalClickDamage,
    dpsPctOfClick,

    // Time Warp
    timeWarpResult: timeWarpResult || eco.lastTimeWarpResult,
    clearTimeWarpResult: () => {
        setTimeWarpResult(null); // Clear local if any
        dispatchEco({ type: "CLEAR_TIME_WARP_RESULT" });
    },
    
    // CLICKABLES
    activeClickable,
    handleClickable,


    // Tap & Skills Logic
    handleTap, 
    calcTapDamage, 
    activateSkill,
    unlockSkill: purchaseActiveSkill,
    activeSkills,
    skillCooldowns,
    activeSkillLevels: ownedActiveSkills,
    ownedActiveSkills,
    SKILLS_CONFIG, 
    isSkillUnlockable,
    resetSkillCooldowns,
    
    // Offline / Meta
    offlineEarnings,
    collectOfflineEarnings,
    unlockedCount,
    resetGame,
    isPrimal,

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
    isIdle, // âœ… Exposed
    hasIdleBonus: totals.idleDpsMult > 1.01, // âœ… Epsilon check to avoid false positives
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
    stats: statsRef.current, // ğŸ“Š
    getStats: () => statsRef.current, // âœ… Getter for fresh ref access
    claimedAchievements: eco.claimedAchievements || [], // ğŸ† Exposed for UI
    unclaimedAchievements, // 🔔 EXPOSED BADGE COUNT

    // Dev Tools Exports
    dispatchEco,
    setZone,
    setStep,
    setMaxUnlockedZone,
    
    // Big Bang Exports
    cosmicEssence: eco.cosmicEssence, // âœ… From eco
    universalConstantsLevels: eco.universalConstantsLevels, // âœ… From eco
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
    claimedAchievements: eco.claimedAchievements || [], // ğŸ† Exposed
    droneCount: eco.droneCount || 0,
    watchAdForShards: (amount = 25) => dispatchEco({ type: "GAIN_SHARDS", amount }),
    buyShopItem: (id, cost, payload) => dispatchEco({ type: "BUY_SHOP_ITEM", id, cost, payload }),
    toggleDrone: () => dispatchEco({ type: "TOGGLE_DRONE" }),
    activeDroneCount: eco.activeDroneCount || 0,
    droneCount: eco.droneCount || 0,
  };
}