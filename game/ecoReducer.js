// game/ecoReducer.js
// Economy reducer, ECO_INIT state, and time warp simulation.
// Extracted from useGameEngine.js for modularity.

import milestonesDef from "../assets/config/milestones.json";
import minersDef from "../assets/config/miners.json";

import { calculateSalvageValue, calculateUpgradeCost } from "./artifacts/artifactService";
import { D } from "./bn";
import configCache from "./ConfigCache";
import { getBulkCost, getProtocolBulkCost } from "./damage";
import { getNextUnlockCost, monsterHp, monsterMineral } from "./monsterCalc";

// ---------------- Economy Init ----------------
const RESET_ARTIFACTS_ON_BIG_BANG = true;

export const ECO_INIT = {
  minerals: D(0), 
  ownedMiners: {},
  ownedSkills: {},
  unlockedCount: 2,
  stellarFragments: D(0),
  cosmicProtocols: {}, 
  // STARLINK
  totalStarlinkTags: 0,
  tagsByMinerId: {},
  lifetimeTagsEarned: 0,
  // Universal Constants & Essence
  cosmicEssence: 0,
  universalConstantsLevels: {},
  lifetimeEssence: 0,
  spentEssence: 0,
  stellarFragmentsSpentLifetime: 0,
  mineralBonusEndTime: 0, 
  // SHARD SHOP
  shards: 0,
  droneCount: 0,
  activeDroneCount: 0,
  // ARTIFACTS
  artifacts: {
      active: [],
      junk: [],
      byId: {},
      forgeCores: D(0),
  },
  // EXPLORERS
  explorers: {
      active: [],
      byId: {},
      nextFreeSlotTime: null,
      totalExplorersLost: 0,
      totalQuestsCompleted: 0,
      unlocked: false,
  },
  // ACHIEVEMENTS
  claimedAchievements: [],
};

// ---------------- Time Warp Simulation ----------------
export function simulateTimeWarp(startZone, startStep, currentDps, durationSeconds) {
    let zone = Number(startZone);
    if (isNaN(zone) || zone < 1) zone = 1;
    let step = Number(startStep);
    if (isNaN(step) || step < 1) step = 1;
    let dps = D(currentDps);
    if (dps.lt(0) || isNaN(dps.e)) dps = D(0);
    let secondsLeft = durationSeconds;
    let gainedGold = D(0);
    let gainedFragments = D(0);
    let gainedZones = 0;
    const startZ = zone;

    let maxIterations = 10000;
    
    while (secondsLeft > 0 && maxIterations > 0) {
        maxIterations--;
        
        const hp = D(monsterHp(zone, step));
        const reward = D(monsterMineral(zone, step));
        const isBoss = zone % 5 === 0;

        let timeToKill = 0.5;
        
        if (dps.gte(hp)) {
            timeToKill = 0.1;
        } else {
            const ratio = hp.div(dps).toNumber();
            timeToKill = ratio; 
        }

        if (timeToKill > secondsLeft) {
            break; 
        }

        if (isBoss && timeToKill > 30) {
            const farmZone = Math.max(1, zone - 1);
            const farmStep = 1;
            const farmHp = D(monsterHp(farmZone, farmStep));
            const farmReward = D(monsterMineral(farmZone, farmStep));
            
            if (dps.gt(0)) {
                let farmKillTime = 1; 
                if (dps.gte(farmHp)) farmKillTime = 0.1;
                else farmKillTime = farmHp.div(dps).toNumber();
                
                const kills = Math.floor(secondsLeft / farmKillTime);
                gainedGold = gainedGold.add(farmReward.mul(kills));
            }
            break;
        }

        secondsLeft -= timeToKill;
        gainedGold = gainedGold.add(reward);

        if (isBoss) {
            zone++;
            step = 1;
        } else {
             if (step < 10) step++;
             else {
                 zone++;
                 step = 1;
             }
        }
    }
    
    gainedZones = Math.max(0, zone - startZ);
    gainedFragments = D(Math.floor(gainedZones / 10));

    return {
        finalZone: zone,
        finalStep: step,
        gainedGold,
        gainedZones,
        gainedFragments
    };
}

// ---------------- Economy Reducer ----------------
export function ecoReducer(state, action) {
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
        if (next > total) next = 0;
        return { ...state, activeDroneCount: next };
    }

    case "BUY_SHOP_ITEM": {
      const { id, cost, payload } = action;
      if (!id || !cost) return state;
      if ((state.shards || 0) < cost) return state;

      let newState = { ...state, shards: state.shards - cost };

      if (id.startsWith("timelapse_")) {
          const seconds = payload?.seconds || 3600;
          const dps = payload?.currentDps ? D(payload.currentDps) : D(0);
          
          if (dps.gt(0)) {
              let startZ = Number(payload.currentZone);
              if (isNaN(startZ) || startZ < 1) startZ = 1;
              let startS = Number(payload.currentStep);
              if (isNaN(startS) || startS < 1) startS = 1;
              
              if (__DEV__) console.log("Reducer BUY_SHOP_ITEM Simulation:", { startZ, startS, payload });

              const result = simulateTimeWarp(startZ, startS, dps, seconds);
              
              newState.minerals = D(state.minerals).add(result.gainedGold);
              newState.zone = result.finalZone;
              newState.step = result.finalStep;
              
              if (newState.zone > state.maxUnlockedZone) {
                  newState.maxUnlockedZone = newState.zone;
              }

              newState.lastTimeWarpResult = {
                  finalZone: result.finalZone,
                  finalStep: result.finalStep,
                  gainedGold: result.gainedGold,
                  gainedZones: result.gainedZones,
                  gainedFragments: result.gainedFragments
              };
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

    case "CLEAR_TIME_WARP_RESULT": {
      const next = { ...state };
      delete next.lastTimeWarpResult;
      return next;
    }

    case "BUY_MINER": {
      const { minerId, amount = 1 } = action;
      const def = minersDef.find((m) => m.id === minerId);
      if (!def) return state;

      const lvl = Number(state.ownedMiners[minerId] || 0);
      const cost = getBulkCost(def, lvl, amount);

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

      const cost = D(skill.cost || 0);
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
          if (newUnlocked[ms.id]) continue;
          
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
       
       return { 
          ...state, 
          dpsToTapMilestonesUnlocked: newUnlocked 
       };
    }

    case "GENERATE_SUMMON_POOL": {
        if (state.summonPool && state.summonPool.length > 0) return state;
        
        const protocols = configCache.getCosmicProtocols()?.protocols || [];
        const ownedIds = Object.keys(state.cosmicProtocols).filter(id => state.cosmicProtocols[id] > 0);
        
        const available = protocols.filter(p => !ownedIds.includes(p.id));
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
        
        const cost = Math.floor(Math.max(1, Math.pow(1.5, state.rerollCount || 0)));
        
        if (D(state.stellarFragments).lt(cost)) return state;
        
        const currentPool = [...(state.summonPool || [])];
        const exclude = [...currentPool];
        
        const available = protocols.filter(p => !ownedIds.includes(p.id) && !exclude.includes(p.id));
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

    case "CLAIM_ACHIEVEMENT": {
        const { id, reward } = action;
        if (!id) return state;
        
        if (state.claimedAchievements && state.claimedAchievements.includes(id)) {
            console.warn("Achievement already claimed:", id);
            return state;
        }

        return {
            ...state,
            shards: (state.shards || 0) + (Number(reward) || 0),
            claimedAchievements: [...(state.claimedAchievements || []), id]
        };
    }
    
    case "GAIN_TAG": {
        const amt = action.amount || 1;
        const target = action.targetMinerId || null;
        
        let newTagsMap = { ...state.tagsByMinerId };
        
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
         
         return state;
    }

    case "LOAD_STATE": {
      const p = action.payload;
      if (!p) return state;

      return {
        ...state,
        minerals: p.minerals ?? state.minerals,
        unlockedCount: p.unlockedCount ?? state.unlockedCount,
        ownedMiners: p.ownedMiners ?? state.ownedMiners,
        ownedSkills: p.ownedSkills ?? state.ownedSkills,
        stellarFragments: p.stellarFragments ?? state.stellarFragments,
        cosmicProtocols: p.cosmicProtocols ?? state.cosmicProtocols,
        summonPool: p.summonPool ?? state.summonPool,
        rerollCount: p.rerollCount ?? state.rerollCount,

        totalStarlinkTags: p.totalStarlinkTags || 0,
        tagsByMinerId: p.tagsByMinerId || {},
        lifetimeTagsEarned: p.lifetimeTagsEarned || 0,
        cosmicEssence: p.cosmicEssence || 0,
        universalConstantsLevels: p.universalConstantsLevels || {},
        lifetimeEssence: p.lifetimeEssence || 0,
        spentEssence: p.spentEssence || 0,
        stellarFragmentsSpentLifetime: p.stellarFragmentsSpentLifetime || 0,
        
        shards: p.shards ?? state.shards,
        droneCount: p.droneCount ?? state.droneCount,
        activeDroneCount: p.activeDroneCount ?? 0,
        
        artifacts: p.artifacts ? {
            active: p.artifacts.active || [],
            junk: p.artifacts.junk || [],
            byId: p.artifacts.byId || {},
            forgeCores: p.artifacts.forgeCores || D(0),
        } : state.artifacts,

        explorers: p.explorers ? {
            active: p.explorers.active || [],
            byId: p.explorers.byId || {},
            nextFreeSlotTime: p.explorers.nextFreeSlotTime || null,
            totalExplorersLost: Number(p.explorers.totalExplorersLost || 0),
            totalQuestsCompleted: Number(p.explorers.totalQuestsCompleted || 0),
            unlocked: Boolean(p.explorers.unlocked || false),
        } : state.explorers,

        claimedAchievements: p.claimedAchievements || state.claimedAchievements || [],
        mineralBonusEndTime: p.mineralBonusEndTime ?? state.mineralBonusEndTime ?? 0,
      };
    }

    case "RESET_GAME": {
      return { ...ECO_INIT };
    }

    case "PERFORM_STELLAR_REWIND": {
       const gained = D(action.amount || 0);
       
       return {
          ...ECO_INIT,
          stellarFragments: D(state.stellarFragments).add(gained),
          cosmicProtocols: state.cosmicProtocols,
          totalStarlinkTags: state.totalStarlinkTags,
          tagsByMinerId: state.tagsByMinerId,
          lifetimeTagsEarned: state.lifetimeTagsEarned,
          cosmicEssence: state.cosmicEssence,
          universalConstantsLevels: state.universalConstantsLevels,
          lifetimeEssence: state.lifetimeEssence,
          spentEssence: state.spentEssence,
          stellarFragmentsSpentLifetime: state.stellarFragmentsSpentLifetime,
          summonPool: state.summonPool,
          rerollCount: state.rerollCount,
          shards: state.shards,
          droneCount: state.droneCount,
          activeDroneCount: state.activeDroneCount,
          claimedAchievements: state.claimedAchievements || [],
          dpsToTapMilestonesUnlocked: state.dpsToTapMilestonesUnlocked || {},
          explorers: state.explorers,
          artifacts: (() => {
              const base = state.artifacts || {}; 
              const next = { ...base };
              next.active = next.active || [];
              next.junk = [...(next.junk || [])];
              next.byId = { ...(next.byId || {}) };
              next.forgeCores = next.forgeCores || D(0);
              
              if (action.artifact) {
                  next.junk.push(action.artifact.id);
                  next.byId[action.artifact.id] = action.artifact;
              }
              return next;
          })(),
       };
    }

    case "UNLOCK_PROTOCOL": {
        const { protocolId } = action;
        const ownedCount = Object.keys(state.cosmicProtocols).filter(k => state.cosmicProtocols[k] > 0).length;
        const cost = getNextUnlockCost(ownedCount);
        
        if (D(state.stellarFragments).lt(cost)) {
            if (__DEV__) console.log("Unlock failed: Not enough SF", state.stellarFragments, cost);
            return state;
        }
        
        return {
            ...state,
            stellarFragments: D(state.stellarFragments).sub(cost),
            cosmicProtocols: {
                ...state.cosmicProtocols,
                [protocolId]: 1
            },
            summonPool: null,
            rerollCount: 0
        };
    }

    case "DEBUG_ADD_ARTIFACT": {
        const z = action.zone || 100;
        const art = createArtifact(z);
        return {
           ...state,
           artifacts: (() => {
               const base = state.artifacts || {}; 
               const next = { ...base };
               next.active = next.active || [];
               next.junk = [...(next.junk || [])];
               next.byId = { ...(next.byId || {}) };
               next.forgeCores = next.forgeCores || D(0);
               
               next.junk.push(art.id);
               next.byId[art.id] = art;
               
               return next;
           })(),
        };
    }

    case "UPGRADE_PROTOCOL": {
        const { protocolId, amount = 1 } = action;
        const currentLvl = state.cosmicProtocols[protocolId] || 0;
        
        // Calculate Cost
        const cost = getProtocolBulkCost(currentLvl, amount);
        
        // Validation
        if (cost <= 0) return state;
        if (D(state.stellarFragments).lt(cost)) return state;

        return {
            ...state,
            stellarFragments: D(state.stellarFragments).sub(cost),
            stellarFragmentsSpentLifetime: (state.stellarFragmentsSpentLifetime || 0) + cost,
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

        let cost = 0;
        const model = def.leveling?.costModel;
        if (model === "levelPlus1") cost = currentLvl + 1;
        else if (model === "flat1") cost = 1;
        else cost = 999999;

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
        const gained = action.payload?.gainedEssence || 0;
        
        return {
            ...ECO_INIT,
            stellarFragments: state.stellarFragments,
            stellarFragmentsSpentLifetime: state.stellarFragmentsSpentLifetime,
            cosmicProtocols: state.cosmicProtocols,
            
            cosmicEssence: (state.cosmicEssence || 0) + gained,
            universalConstantsLevels: state.universalConstantsLevels,
            lifetimeEssence: (state.lifetimeEssence || 0) + gained,
            spentEssence: state.spentEssence,
            
            totalStarlinkTags: state.totalStarlinkTags,
            tagsByMinerId: state.tagsByMinerId,
            lifetimeTagsEarned: state.lifetimeTagsEarned,

            shards: state.shards,
            droneCount: state.droneCount,
            activeDroneCount: state.activeDroneCount,
            claimedAchievements: state.claimedAchievements || [],
            dpsToTapMilestonesUnlocked: state.dpsToTapMilestonesUnlocked || {},
            explorers: state.explorers,
            summonPool: state.summonPool,
            rerollCount: state.rerollCount,

            artifacts: RESET_ARTIFACTS_ON_BIG_BANG ? {
                active: [],
                junk: [],
                byId: {},
                forgeCores: D(0),
            } : state.artifacts,
        };
    }

    case "EXTEND_MINERAL_BONUS": {
        return { ...state, mineralBonusEndTime: action.endTime };
    }

    case "SPEND_SHARDS": {
        const { amount } = action;
        const current = state.shards || 0;
        if (current < amount) return state;
        
        return {
            ...state,
            shards: current - amount,
        };
    }

    case "COLLECT_QUEST": {
        const { explorerId } = action;
        const explorer = state.explorers.byId[explorerId];
        if (!explorer || !explorer.currentQuest) return state;

        const quest = explorer.currentQuest;
        
        let newState = { ...state };
        
        switch (quest.type) {
            case "MINERAL":
                newState.minerals = D(newState.minerals || 0).add(quest.baseReward);
                break;
                
            case "FRAGMENT":
                newState.stellarFragments = (newState.stellarFragments || 0) + quest.baseReward;
                break;
                
            case "SHARD":
                newState.shards = (newState.shards || 0) + quest.baseReward;
                break;
                
            case "ARTIFACT": {
                if (Math.random() < quest.baseReward) {
                     const { createArtifact } = require("./artifacts/artifactService");
                     const newArt = createArtifact(state.maxUnlockedZone || 1);
                     
                     if (newState.artifacts.active.length < 4) {
                         newState.artifacts.active = [...newState.artifacts.active, newArt.id];
                     } else {
                         newState.artifacts.junk = [...newState.artifacts.junk, newArt.id];
                     }
                     newState.artifacts.byId = { ...newState.artifacts.byId, [newArt.id]: newArt };
                }
                break;
            }
            
            case "PROTOCOL":
                break;
                
            case "RECRUIT": {
                const { generateExplorer } = require("./explorers/explorerService");
                const newExplorer = generateExplorer(state.maxUnlockedZone || 1);
                
                newState.explorers.byId = {
                    ...newState.explorers.byId,
                    [newExplorer.id]: newExplorer
                };
                newState.explorers.active = [...newState.explorers.active, newExplorer.id];
                break;
            }
        }

        const updatedExplorer = {
            ...explorer,
            currentQuest: null,
            questStartTime: null,
        };
        
        const nextById = { ...newState.explorers.byId, [explorerId]: updatedExplorer };
        
        newState.explorers = {
            ...newState.explorers,
            byId: nextById
        };

        return newState;
    }

    // --- ARTIFACTS ACTIONS ---
    case "EQUIP_ARTIFACT": {
        const { id } = action;
        if (!state.artifacts) return state;
        const art = state.artifacts.byId[id];
        if (!art || state.artifacts.active.includes(id)) return state;
        if (state.artifacts.active.length >= 4) return state;

        return {
            ...state,
            artifacts: {
                ...state.artifacts,
                junk: state.artifacts.junk.filter(jid => jid !== id),
                active: [...state.artifacts.active, id],
            }
        };
    }

    case "UNEQUIP_ARTIFACT": {
        const { id } = action;
        if (!state.artifacts || !state.artifacts.active.includes(id)) return state;

        return {
            ...state,
            artifacts: {
                ...state.artifacts,
                active: state.artifacts.active.filter(aid => aid !== id),
                junk: [...state.artifacts.junk, id],
            }
        };
    }

    case "SALVAGE_ARTIFACT": {
        const { id } = action;
        if (!state.artifacts) return state;
        const art = state.artifacts.byId[id];
        if (!art || state.artifacts.active.includes(id)) return state;

        const val = calculateSalvageValue(art);
        const nextById = { ...state.artifacts.byId };
        delete nextById[id];

        return {
            ...state,
            artifacts: {
                ...state.artifacts,
                junk: state.artifacts.junk.filter(jid => jid !== id),
                byId: nextById,
                forgeCores: D(state.artifacts.forgeCores).add(val),
            }
        };
    }

    case "UPGRADE_ARTIFACT": {
        const { id } = action;
        if (!state.artifacts) return state;
        const art = state.artifacts.byId[id];
        if (!art) return state;

        const cost = calculateUpgradeCost(art);
        if (D(state.artifacts.forgeCores).lt(cost)) return state;

        const newLevel = (art.level || 1) + 1;
        const oldLevel = art.level || 1;
        const scale = newLevel / oldLevel;
        
        const newAffixes = art.affixes.map(a => ({
            type: a.type,
            value: (parseFloat(a.value) * scale).toFixed(4)
        }));

        return {
            ...state,
            artifacts: {
                ...state.artifacts,
                byId: {
                    ...state.artifacts.byId,
                    [id]: { 
                        ...art, 
                        level: newLevel,
                        affixes: newAffixes
                    }
                },
                forgeCores: D(state.artifacts.forgeCores).sub(cost),
            }
        };
    }

    case "GRANT_EXPLORER": {
        const { createExplorer } = require("./explorers/explorerService");
        
        if (!state.explorers) {
            return {
                ...state,
                explorers: {
                    active: [],
                    byId: {},
                    nextFreeSlotTime: null,
                    totalExplorersLost: 0,
                    totalQuestsCompleted: 0,
                    unlocked: true,
                }
            };
        }

        if (state.explorers.active.length >= 5) {
            console.warn("Cannot grant explorer: all slots full");
            return state;
        }

        const newExplorer = createExplorer();
        
        return {
            ...state,
            explorers: {
                ...state.explorers,
                active: [...state.explorers.active, newExplorer.id],
                byId: {
                    ...state.explorers.byId,
                    [newExplorer.id]: newExplorer,
                },
                unlocked: true,
            }
        };
    }

    case "DISMISS_EXPLORER": {
        const { explorerId } = action;
        if (!state.explorers || !state.explorers.byId[explorerId]) return state;

        const newActive = state.explorers.active.filter(id => id !== explorerId);
        
        const newById = { ...state.explorers.byId };
        delete newById[explorerId];

        const totalLost = (state.explorers.totalExplorersLost || 0) + 1;

        return {
            ...state,
            explorers: {
                ...state.explorers,
                active: newActive,
                byId: newById,
                totalExplorersLost: totalLost,
            }
        };
    }

    case "GENERATE_QUESTS": {
        const { explorerId, quests } = action;
        
        if (!state.explorers || !state.explorers.byId[explorerId]) {
            console.warn("Cannot generate quests: explorer not found");
            return state;
        }

        return {
            ...state,
            explorers: {
                ...state.explorers,
                byId: {
                    ...state.explorers.byId,
                    [explorerId]: {
                        ...state.explorers.byId[explorerId],
                        availableQuests: quests,
                    }
                }
            }
        };
    }

    case "START_QUEST": {
        const { explorerId, quest } = action;
        
        if (!state.explorers || !state.explorers.byId[explorerId]) {
            console.warn("Cannot start quest: explorer not found");
            return state;
        }

        const explorer = state.explorers.byId[explorerId];
        
        if (explorer.currentQuest) {
            console.warn("Explorer already on quest");
            return state;
        }

        return {
            ...state,
            explorers: {
                ...state.explorers,
                byId: {
                    ...state.explorers.byId,
                    [explorerId]: {
                        ...explorer,
                        currentQuest: quest,
                        questStartTime: Date.now(),
                    }
                },
                totalQuestsCompleted: state.explorers.totalQuestsCompleted || 0,
            }
        };
    }

    default:
      return state;
  }
}
