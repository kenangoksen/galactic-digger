// game/useGameEngine.js
// Mevcut API korunur, planet görseli sistemi bozulmaz.
// Sadece ECONOMY (minerals/cost/buy) Decimal-safe yapılır.

import {
  unlockedCount,
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

import { D } from "./bn";
import { computeTotals, getNextCost } from "./damage";

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
      const { minerId, skill } = action;
      const def = minersDef.find((m) => m.id === minerId);
      if (!def || !skill) return state;

      const lvl = Number(state.ownedMiners[minerId] || 0);
      const unlockAt = Number(skill.unlockAt || 0);
      if (lvl < unlockAt) return state;

      const ownedMap = state.ownedSkills[minerId] || {};
      if (ownedMap[skill.id]) return state;

      const cost = D(skill.cost || 0); // ✅ Decimal parse
      if (cost.gt(0) && !D(state.minerals).gte(cost)) return state;

      return {
        ...state,
        minerals: cost.gt(0) ? D(state.minerals).sub(cost) : D(state.minerals),
        ownedSkills: {
          ...state.ownedSkills,
          [minerId]: { ...ownedMap, [skill.id]: true },
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

    default:
      return state;
  }
}

export function useGameEngine() {
  // progress model
  const [mode, setMode] = useState("progress"); // "farm" | "progress"
  const [zone, setZone] = useState(1);
  const [step, setStep] = useState(1);

  const isBossPlanet = zone % 5 === 0;

  // economy (atomic)
  const [eco, dispatchEco] = useReducer(ecoReducer, ECO_INIT);
  const minerals = eco.minerals; // ✅ Decimal dışarıya da Decimal döner
  const ownedMiners = eco.ownedMiners;
  const ownedSkills = eco.ownedSkills;
  const [pendingOwnedMiners, setPendingOwnedMiners] = useState({});

  // ✅ Planet visual — BURAYA DOKUNMADIM (senin sistem aynen)
  const planetCount = planets?.length || 1;
  const globalStageIndex = (zone - 1) * 10 + (step - 1);
  const planetIndex = planetCount > 0 ? globalStageIndex % planetCount : 0;

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
        if (mode !== "farm") {
          const bossPlanet = localZone % 5 === 0;

          if (bossPlanet) {
            // ✅ Boss planet: tek boss, ölünce direkt sonraki zone
            localZone += 1;
            localStep = 1;
          } else {
            // ✅ Normal planet: 10 sektör
            if (localStep < 10) localStep += 1;
            else {
              localZone += 1;
              localStep = 1;
            }
          }
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
    },
    [dispatchEco, mode, totals.mineralMult],
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

  const buySkill = useCallback((minerId, skill) => {
    if (buyLockRef.current) return;

    buyLockRef.current = true;

    dispatchEco({ type: "BUY_SKILL", minerId, skill });

    requestAnimationFrame(() => {
      buyLockRef.current = false;
    });
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
    unlockedCount,
  };
}
