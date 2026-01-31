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

import minersDef from "../assets/config/miners.json";
import planets from "../assets/config/planets.json";
import { PLANET_SPRITES } from "../assets/registry/planetSprites";

import { AppState } from "react-native";
import { D } from "./bn";
import { computeTotals, getNextCost } from "./damage";
import { loadGame, saveGame, serializeEco } from "./persistGame";

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

// ---------------- Economy reducer (atomic buys, Decimal minerals) ----------------
const ECO_INIT = {
  minerals: D(0), // ✅ Decimal
  ownedMiners: {}, // { miner_01: level, ... }
  ownedSkills: {}, // { miner_01: { skillId: true, ... }, ... }
  unlockedCount: 2,
};

function ecoReducer(state, action) {
  switch (action.type) {
    case "GAIN_MINERALS": {
      const add = D(action.amount || 0);
      if (add.lte(0)) return state;
      return { ...state, minerals: D(state.minerals).add(add) };
    }

    case "BUY_MINER": {
      const minerId = action.minerId;
      const def = minersDef.find((m) => m.id === minerId);
      if (!def) return state;

      const lvl = Number(state.ownedMiners[minerId] || 0);
      const cost = getNextCost(def, lvl); // genelde Decimal döner

      // ✅ Decimal compare
      if (!D(state.minerals).gte(cost)) return state;

      return {
        ...state,
        minerals: D(state.minerals).sub(cost),
        ownedMiners: { ...state.ownedMiners, [minerId]: lvl + 1 },
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
      };
    }

    case "RESET_GAME": {
      return { ...ECO_INIT };
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

  const isBossPlanet = zone % 5 === 0;
  
  const goNextZone = useCallback(() => {
    if (zone < maxUnlockedZone) {
      const next = zone + 1;
      setZone(next);
      setStep(1);
      // Reset HP for new zone
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
       // Reset HP for new zone
       const newHp = monsterHp(prev, 1);
       setMaxHp(newHp);
       setHp(newHp);
    }
  }, [zone]);

  // economy (atomic)
  const [eco, dispatchEco] = useReducer(ecoReducer, ECO_INIT);
  const minerals = eco.minerals; // ✅ Decimal dışarıya da Decimal döner
  const ownedMiners = eco.ownedMiners;
  const ownedSkills = eco.ownedSkills;
  const [pendingOwnedMiners, setPendingOwnedMiners] = useState({});

  const resetGame = useCallback(async () => {
    // 1. Clear storage
    await import("./persistGame").then((m) => m.clearGame());
    // 2. Reset Memory
    setMode("progress");
    setZone(1);
    setStep(1);
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
    PLANET_SPRITES[currentPlanet.sprite] ||
    require("../assets/images/sprites/planets/planet_01.png");

  // totals (tap + dps + crit + multipliers) — depends only on economy + zone
  const totals = useMemo(() => {
    return computeTotals({
      minersDef,
      ownedMiners,
      ownedSkills,
      zone,
    });
  }, [ownedMiners, ownedSkills, zone]);

  const tapDamageBase = totals.tapDamage;
  const totalDps = totals.dps;

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
        setZone(loaded.progress.zone);
        setStep(loaded.progress.step);
        // Load maxUnlockedZone (fallback to loaded zone if missing)
        setMaxUnlockedZone(loaded.progress.maxUnlockedZone || loaded.progress.zone || 1);
        
        dispatchEco({ type: "LOAD_STATE", payload: loaded.eco });
        
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
                    step: current.step 
                },
                eco: serializeEco(current.eco),
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

    if (isBossPlanet) setBossTimeMsLeft(30_000);
    else setBossTimeMsLeft(0);
  }, [zone, step, isBossPlanet]);

  const hpPct = useMemo(
    () => (maxHp > 0 ? Math.max(0, hp / maxHp) : 0),
    [hp, maxHp],
  );

  const applyDamage = useCallback(
    (dmg) => {
      const hit = Number(dmg || 0);
      if (hit <= 0) return;

      // authoritative snapshots
      let localZone = zoneRef.current;
      let localStep = stepRef.current;

      let currentHp = hpRef.current;
      let remainingDmg = hit;

      // safety: currentHp invalid ise düzelt
      const cap = monsterHp(localZone, localStep);
      if (currentHp <= 0 || currentHp > cap) currentHp = cap;

      let kills = 0;

      while (remainingDmg > 0) {
        if (remainingDmg < currentHp) {
          // mob hayatta kalır
          currentHp -= remainingDmg;
          remainingDmg = 0;
          break;
        }

        // mob öldü
        remainingDmg -= currentHp;
        kills++;

        // reward (kill başına)
        const base = monsterMineral(localZone, localStep);
        const gained = D(base)
          .mul(totals.mineralMult || 1)
          .floor();
        dispatchEco({ type: "GAIN_MINERALS", amount: gained });

        // next step/zone
        // next step/zone
        // Use ref for mode to avoid stale closure in game loop
        const isFarm = modeRef.current === "farm";
        const bossPlanet = localZone % 5 === 0;

        if (bossPlanet) {
          // Boss Planet
          if (isFarm) {
             // Farm Boss: Stay on step 1
             localStep = 1; 
          } else {
             // Progress: Next Zone
             localZone += 1;
             localStep = 1;
          }
        } else {
          // Normal Planet (Steps 1-10)
          if (localStep < 10) {
              localStep += 1;
          } else {
              // End of Zone (Step 10 killed)
              if (isFarm) {
                  localStep = 1; // Loop back
              } else {
                  localZone += 1; // Next Zone
                  localStep = 1;
              }
          }
        }
           
        // Update Max Unlocked Zone if progressed (only if NOT farming, usually)
        if (!isFarm) {
           // We'll update the state after the loop
        }

        // yeni mobun hp’si
        currentHp = monsterHp(localZone, localStep);

        // safety: çok yüksek DPS’te runaway olmasın
        if (kills > 2000) break;
      }

      // commit state ONCE (no race)
      zoneRef.current = localZone;
      stepRef.current = localStep;
      hpRef.current = currentHp;

      const newMax = monsterHp(localZone, localStep);
      maxHpRef.current = newMax;

      setZone(localZone);
      setStep(localStep);
      setMaxHp(newMax);
      setHp(currentHp);
      
      // Update persistent max zone
      if (localZone > maxUnlockedZone) {
          setMaxUnlockedZone(localZone);
      }
    },
    [dispatchEco, totals.mineralMult, maxUnlockedZone], // Remove mode from dependency
  );

  const calcTapDamage = useCallback(() => {
    const isCritNow = Math.random() < critChance;
    const dmg = isCritNow ? tapDamageBase * critMult : tapDamageBase;
    return { dmg, isCrit: isCritNow };
  }, [critChance, critMult, tapDamageBase]);

  useEffect(() => {
    dpsRef.current = totalDps;
  }, [totalDps]);

  useEffect(() => {
    const TICK_MS = 250;

    const id = setInterval(() => {
      const dps = dpsRef.current;
      if (dps <= 0) return;

      const dmg = dps * (TICK_MS / 1000);
      applyDamage(dmg);
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
    setBossTimeMsLeft(30_000);
  }, [bossTimeMsLeft, isBossPlanet, zone]);

  // mode toggle
  const toggleMode = useCallback(() => {
    setMode((m) => (m === "progress" ? "farm" : "progress"));
  }, []);

  // buys (atomic)
  const buyOrUpgradeMiner = useCallback(
    (minerId) => {
      if (buyLockRef.current) return;

      buyLockRef.current = true;

      // ✅ optimistic update: UI hemen level artmış görsün
      setPendingOwnedMiners((prev) => {
        const base = Number(ownedMiners[minerId] || 0);
        const alreadyPending = Number(prev[minerId] || 0);
        return { ...prev, [minerId]: Math.max(base, alreadyPending) + 1 };
      });

      dispatchEco({ type: "BUY_MINER", minerId });

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
    }
  }, [minerals, unlockedCount]);



  const buySkill = useCallback((minerId, skillId) => {
    if (buyLockRef.current) return;

    // 1. Validate Miner
    const minerDef = minersDef.find((m) => m.id === minerId);
    if (!minerDef) return;

    // 2. Validate Skill
    const skill = minerDef.skills?.find((s) => s.id === skillId);
    if (!skill) return;

    // 3. check level
    const lvl = Number(ownedMiners[minerId] || 0);
    const unlockAt = Number(skill.unlockAt || 9999);
    if (lvl < unlockAt) {
        // Not unlocked yet
        return;
    }

    // 4. check cost
    const cost = D(skill.cost || 0);
    if (D(minerals).lt(cost)) {
        // Can't afford
        return;
    }

    // 5. check if owned
    if (ownedSkills?.[minerId]?.[skillId]) {
        // Already owned
        return;
    }

    buyLockRef.current = true;
    dispatchEco({ type: "BUY_SKILL", minerId, skillId, cost });

    requestAnimationFrame(() => {
      buyLockRef.current = false;
    });
  }, [minerals, ownedMiners, ownedSkills]);

  const collectOfflineEarnings = useCallback((multiplier = 1) => {
    if (!offlineEarnings) return;
    
    const total = offlineEarnings.amount.mul(multiplier);
    dispatchEco({ type: "GAIN_MINERALS", amount: total });
    
    setOfflineEarnings(null); // Close modal
  }, [offlineEarnings]);

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
    ownedMiners: {
      ...ownedMiners,
      ...pendingOwnedMiners,
    },

    ownedSkills,
    buyOrUpgradeMiner,
    buySkill,

    // totals / damage
    totalDps,
    calcTapDamage,
    applyDamage,
    applyDamage,
    unlockedCount,
    resetGame,
    
    // Offline
    offlineEarnings,
    collectOfflineEarnings,

    // Zone Nav
    maxUnlockedZone,
    goNextZone,
    goPrevZone,
  };
}
