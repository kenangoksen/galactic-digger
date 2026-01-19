// game/useGameEngine.js
// "Single source of truth" game state.
// Goals:
// - Minerals are credited directly on defeat (tray yok)
// - Purchases are atomic (stale minerals/level yok)
// - Tapping / zone change miner sheet scrollunu bozmaz

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import minersDef from "../assets/config/miners.json";
import planets from "../assets/config/planets.json";
import { PLANET_SPRITES } from "../assets/registry/planetSprites";

import { computeTotals, getNextCost } from "./damage";

// ---------------- Clicker Heroes-style monster HP ----------------
function baseMonsterHp(zone) {
  const z = Math.max(1, Math.floor(zone));
  return Math.floor(10 * (z - 1 + Math.pow(1.55, z - 1)));
}

function monsterHp(zone, step) {
  const hp = baseMonsterHp(zone);
  const isBoss = zone % 5 === 0 && step === 10;
  return isBoss ? hp * 10 : hp;
}

function monsterMineral(zone, step) {
  const z = Math.max(1, Math.floor(zone));
  const isBoss = z % 5 === 0 && step === 10;
  const base = Math.floor(Math.pow(1.60255, z - 1));
  return Math.max(1, isBoss ? base * 10 : base);
}

// ---------------- Economy reducer (atomic buys) ----------------
const ECO_INIT = {
  minerals: 0,
  ownedMiners: {}, // { miner_01: level, ... }
  ownedSkills: {}, // { miner_01: { skillId: true, ... }, ... }
};

function ecoReducer(state, action) {
  switch (action.type) {
    case "GAIN_MINERALS": {
      const add = Number(action.amount || 0);
      if (add <= 0) return state;
      return { ...state, minerals: state.minerals + add };
    }

    case "BUY_MINER": {
      const minerId = action.minerId;
      const def = minersDef.find((m) => m.id === minerId);
      if (!def) return state;

      const lvl = Number(state.ownedMiners[minerId] || 0);
      const cost = getNextCost(def, lvl);
      if (state.minerals < cost) return state;

      return {
        ...state,
        minerals: state.minerals - cost,
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

      const cost = Number(skill.cost || 0); // şimdilik 0 olabilir; görünmüyor
      if (cost > 0 && state.minerals < cost) return state;

      return {
        ...state,
        minerals: cost > 0 ? state.minerals - cost : state.minerals,
        ownedSkills: {
          ...state.ownedSkills,
          [minerId]: { ...ownedMap, [skill.id]: true },
        },
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

  const isBoss = zone % 5 === 0 && step === 10;

  // economy (atomic)
  const [eco, dispatchEco] = useReducer(ecoReducer, ECO_INIT);
  const minerals = eco.minerals;
  const ownedMiners = eco.ownedMiners;
  const ownedSkills = eco.ownedSkills;

  // planet visual
  const planetCount = planets?.length || 1;
  const globalStageIndex = (zone - 1) * 10 + (step - 1);
  const planetIndex = planetCount > 0 ? globalStageIndex % planetCount : 0;

  const currentPlanet =
    planets?.[planetIndex] ||
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

  useEffect(() => {
    const m = monsterHp(zone, step);
    setMaxHp(m);
    setHp(m);

    if (isBoss) setBossTimeMsLeft(30_000);
    else setBossTimeMsLeft(0);
  }, [zone, step, isBoss]);

  const hpPct = useMemo(() => (maxHp > 0 ? Math.max(0, hp / maxHp) : 0), [hp, maxHp]);

  // advance
  const advanceStepOrZone = useCallback(() => {
    if (mode === "farm") {
      setHp(monsterHp(zone, step));
      return;
    }

    if (step < 10) setStep((s) => s + 1);
    else {
      setZone((z) => z + 1);
      setStep(1);
    }
  }, [mode, step, zone]);

  // defeat (auto credit minerals)
  const onDefeat = useCallback(() => {
    const base = monsterMineral(zone, step);
    const gained = Math.max(1, Math.floor(base * totals.mineralMult));

    dispatchEco({ type: "GAIN_MINERALS", amount: gained });
    advanceStepOrZone();
  }, [advanceStepOrZone, step, totals.mineralMult, zone]);

  const applyDamage = useCallback(
    (dmg) => {
      const D = Number(dmg || 0);
      if (D <= 0) return;

      setHp((prev) => {
        const next = prev - D;
        if (next <= 0) {
          setTimeout(onDefeat, 0);
          return 0;
        }
        return next;
      });
    },
    [onDefeat]
  );

  const calcTapDamage = useCallback(() => {
    const isCritNow = Math.random() < critChance;
    const dmg = isCritNow ? tapDamageBase * critMult : tapDamageBase;
    return { dmg, isCrit: isCritNow };
  }, [critChance, critMult, tapDamageBase]);

  // DPS tick
  useEffect(() => {
    const tickMs = 120;
    const id = setInterval(() => {
      if (totalDps <= 0) return;
      const dmg = totalDps / (1000 / tickMs);
      applyDamage(dmg);
    }, tickMs);
    return () => clearInterval(id);
  }, [applyDamage, totalDps]);

  // boss timer tick
  useEffect(() => {
    if (!isBoss) return;
    if (bossTimeMsLeft <= 0) return;

    const t = setInterval(() => setBossTimeMsLeft((ms) => ms - 100), 100);
    return () => clearInterval(t);
  }, [isBoss, bossTimeMsLeft]);

  // boss failed
  useEffect(() => {
    if (!isBoss) return;
    if (bossTimeMsLeft > 0) return;

    setHp(monsterHp(zone, step));
    setBossTimeMsLeft(30_000);
  }, [bossTimeMsLeft, isBoss, step, zone]);

  // mode toggle
  const toggleMode = useCallback(() => {
    setMode((m) => (m === "progress" ? "farm" : "progress"));
  }, []);

  // buys (atomic)
  const buyOrUpgradeMiner = useCallback((minerId) => {
    dispatchEco({ type: "BUY_MINER", minerId });
  }, []);

  const buySkill = useCallback((minerId, skill) => {
    dispatchEco({ type: "BUY_SKILL", minerId, skill });
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
    isBoss,

    // combat
    maxHp,
    hp,
    hpPct,
    bossTimeMsLeft,

    // economy
    minerals,
    ownedMiners,
    ownedSkills,
    buyOrUpgradeMiner,
    buySkill,

    // totals / damage
    totalDps,
    calcTapDamage,
    applyDamage,
  };
}
