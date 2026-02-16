// game/ecoReducer.js
// Economy reducer, ECO_INIT state, and time warp simulation.
// Extracted from useGameEngine.js for modularity.

import milestonesDef from "../assets/config/milestones.json";
import questsDef from "../assets/config/quests.json";
import { D } from "./bn"; // 🔢

import minersDef from "../assets/config/miners.json";
import configCache from "./ConfigCache";
import { getBulkCost } from "./damage";

import WEEKLY_REWARDS from "../assets/config/weeklyRewards.json";
export { WEEKLY_REWARDS };

// ---------------- Helper: Generate Daily Quests ----------------
function generateDailyQuests() {
    // 1. Ad quest is ALWAYS included
    const adQuest = questsDef.find(q => q.type === "WATCH_AD");
    const otherQuests = questsDef.filter(q => q.type !== "WATCH_AD");
    
    // 2. Pick 2 random quests from the rest
    const shuffled = [...otherQuests].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 2);
    
    // 3. Build final list: Ad quest first, then 2 random
    const all = adQuest ? [adQuest, ...selected] : selected;
    
    return all.map(q => {
        const target = q.targets[Math.floor(Math.random() * q.targets.length)];
        return {
            id: q.id,
            type: q.type,
            target: target,
            progress: 0,
            claimed: false,
            rewardType: q.rewardType,
            baseReward: q.baseReward,
            description: q.description,
            icon: q.icon
        };
    });
}

// ---------------- Economy Init ----------------
const RESET_ARTIFACTS_ON_BIG_BANG = true;

export const ECO_INIT = {
  // ... (existing state)
  minerals: D(0), 
  ownedMiners: {},
  ownedSkills: {},
  unlockedCount: 2,
  stellarFragments: D(0),
  cosmicProtocols: {}, 
  // STARLINK
  totalStarlinkTags: 0,
  unopenedTags: 0, 
  highestZoneLifetime: 0, 
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
  
  // DAIRY QUESTS
  dailyQuest: {
      lastResetDate: null,
      weeklyProgress: 0,
      weeklyClaimed: false,
      activeQuests: [], // Will be populated on first load
      rerollCount: 0,
      weekNumber: 0 // 0-3 rotation (4 weeks)
  }
};

// ... (Time Warp Simulation)

// ---------------- Economy Reducer ----------------
export function ecoReducer(state, action) {
  switch (action.type) {
    
    // --- DAILY QUESTS ---
    case "CHECK_DAILY_RESET": {
        const today = new Date().toISOString().split('T')[0];
        const lastReset = state.dailyQuest?.lastResetDate;
        const hasQuests = state.dailyQuest?.activeQuests?.length > 0;

        if (lastReset !== today || !hasQuests) {
            // New Day OR empty quests (after game reset)
            const isNewDay = lastReset !== today;
            return {
                ...state,
                dailyQuest: {
                    ...state.dailyQuest,
                    lastResetDate: today,
                    rerollCount: isNewDay ? 0 : (state.dailyQuest?.rerollCount || 0),
                    activeQuests: generateDailyQuests(),
                    // Reset weekly on new day if previously claimed
                    weeklyClaimed: isNewDay ? false : (state.dailyQuest?.weeklyClaimed || false),
                }
            };
        }
        return state;
    }

    case "INCREMENT_QUEST_STAT": {
        const { statType, amount = 1 } = action;
        if (!state.dailyQuest?.activeQuests) return state;

        const newQuests = state.dailyQuest.activeQuests.map(q => {
            if (q.type === statType && !q.claimed) {
                 return { ...q, progress: Math.min(q.target, q.progress + amount) };
            }
            return q;
        });

        return {
            ...state,
            dailyQuest: {
                ...state.dailyQuest,
                activeQuests: newQuests
            }
        };
    }

    case "CLAIM_QUEST_REWARD": {
        const { questIndex, double } = action;
        const quest = state.dailyQuest.activeQuests[questIndex];
        
        if (!quest || quest.claimed || quest.progress < quest.target) return state;

        // Calculate Reward
        let rewardAmount = quest.baseReward;
        
        // Dynamic Reward Scaling (e.g. Minerals based on DPS)
        let rewardMinerals = D(0);
        
        if (quest.rewardType === "minerals_minute") {
             // We need DPS from payload or state check. 
             // Ideally payload sends current minerals/sec worth
             rewardMinerals = D(action.payload?.dps || 0).mul(60 * rewardAmount);
        } else if (quest.rewardType === "minerals_hour") {
             rewardMinerals = D(action.payload?.dps || 0).mul(3600 * rewardAmount);
        }

        if (double) {
            rewardAmount *= 2;
            rewardMinerals = rewardMinerals.mul(2);
        }

        const newQuests = [...state.dailyQuest.activeQuests];
        newQuests[questIndex] = { ...quest, claimed: true };

        // Weekly Progress
        const newWeeklyProgress = (state.dailyQuest.weeklyProgress || 0) + 1;

        let newState = {
            ...state,
            dailyQuest: {
                ...state.dailyQuest,
                activeQuests: newQuests,
                weeklyProgress: newWeeklyProgress
            }
        };

        // Grant Rewards
        if (quest.rewardType === "shards") {
            newState.shards = (newState.shards || 0) + rewardAmount;
        } else if (quest.rewardType === "fragments") {
            newState.stellarFragments = state.stellarFragments.add(rewardAmount);
        } else if (quest.rewardType.startsWith("minerals")) {
            newState.minerals = state.minerals.add(rewardMinerals);
        }

        return newState;
    }

    case "REROLL_QUEST": {
        const { questIndex, cost } = action;
        if (state.shards < cost) return state;

        const newQuests = [...state.dailyQuest.activeQuests];
        // Pick a new random quest distinct from current ones if possible
        const existingIds = newQuests.map(q => q.id);
        const available = questsDef.filter(q => !existingIds.includes(q.id));
        
        let newTpl = available.length > 0 
            ? available[Math.floor(Math.random() * available.length)] 
            : questsDef[Math.floor(Math.random() * questsDef.length)];

        const target = newTpl.targets[Math.floor(Math.random() * newTpl.targets.length)];
        
        newQuests[questIndex] = {
            id: newTpl.id,
            type: newTpl.type,
            target: target,
            progress: 0,
            claimed: false,
            rewardType: newTpl.rewardType,
            baseReward: newTpl.baseReward,
            description: newTpl.description,
            icon: newTpl.icon
        };

        return {
            ...state,
            shards: state.shards - cost,
            dailyQuest: {
                ...state.dailyQuest,
                activeQuests: newQuests,
                rerollCount: (state.dailyQuest.rerollCount || 0) + 1
            }
        };
    }

    case "CLAIM_WEEKLY_CHEST": {
        if (state.dailyQuest.weeklyProgress < 15 || state.dailyQuest.weeklyClaimed) return state;

        const currentWeek = state.dailyQuest.weekNumber || 0;
        const weekRewardDef = WEEKLY_REWARDS[currentWeek % WEEKLY_REWARDS.length];
        
        let chestState = {
            ...state,
            dailyQuest: {
                ...state.dailyQuest,
                weeklyClaimed: true,
                // Advance to next week for next cycle
                weekNumber: (currentWeek + 1) % WEEKLY_REWARDS.length
            }
        };

        // Grant all rewards from current week definition
        for (const r of weekRewardDef.rewards) {
            if (r.type === "shards") {
                chestState.shards = (chestState.shards || 0) + r.amount;
            } else if (r.type === "fragments") {
                chestState.stellarFragments = D(chestState.stellarFragments).add(r.amount);
            } else if (r.type === "artifacts") {
                // Grant random artifacts
                const newActive = [...(chestState.artifacts?.active || [])];
                for (let i = 0; i < r.amount; i++) {
                    // Generate a placeholder artifact ID (real system may differ)
                    newActive.push({ id: `weekly_art_${Date.now()}_${i}`, rarity: "epic", source: "weekly_chest" });
                }
                chestState.artifacts = { ...chestState.artifacts, active: newActive };
            } else if (r.type === "minerals_hours") {
                // Grant minerals = DPS * hours * 3600
                const dps = action.payload?.dps || 0;
                const mineralGrant = D(dps).mul(3600 * r.amount);
                chestState.minerals = D(chestState.minerals).add(mineralGrant);
            }
        }

        return chestState;
    }
    
    // ... (Existing Cases)
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

    case "BUY_SKILLS_BULK": {
        const { skillsToBuy, totalCost } = action;
        if (!skillsToBuy || !skillsToBuy.length) return state;
        
        // Optimistic check: just deduct and update
        // We assume caller (useGameEngine) did the validation to avoid double-looping here
        if (D(state.minerals).lt(totalCost)) return state;

        const nextOwnedSkills = { ...state.ownedSkills };
        
        for (const { minerId, skillId } of skillsToBuy) {
            const current = nextOwnedSkills[minerId] || {};
            nextOwnedSkills[minerId] = { ...current, [skillId]: true };
        }

        return {
            ...state,
            minerals: D(state.minerals).sub(totalCost),
            ownedSkills: nextOwnedSkills
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
    
    case "GAIN_UNOPENED_TAG": {
        const amount = action.amount || 1;
        return {
            ...state,
            unopenedTags: (state.unopenedTags || 0) + amount,
            totalStarlinkTags: (state.totalStarlinkTags || 0) + amount,
            lifetimeTagsEarned: (state.lifetimeTagsEarned || 0) + amount,
        };
    }

    case "RESET_LAST_OPENED": {
        return { ...state, lastOpenedMinerId: null };
    }

    case "OPEN_TAG": {
        if ((state.unopenedTags || 0) <= 0) return state;

        // Randomly assign to a miner (CH logic: random initially)
        // Or if action passes a targetId (Regilding later), use that.
        // For OPEN_TAG (New), it's random.
        const ownedIds = Object.keys(state.ownedMiners).filter(id => state.ownedMiners[id] > 0);
        let targetId = "miner_01"; // Fallback
        
        if (ownedIds.length > 0) {
           targetId = ownedIds[Math.floor(Math.random() * ownedIds.length)];
        }

        const newTagsMap = { ...state.tagsByMinerId };
        newTagsMap[targetId] = (newTagsMap[targetId] || 0) + 1;

        return {
            ...state,
            unopenedTags: state.unopenedTags - 1,
            tagsByMinerId: newTagsMap,
            lastOpenedMinerId: targetId, // For UI toast/modal
        };
    }

    /* DEPRECATED: OLD RANDOM DROP LOGIC */
    case "REALIGN_TAG_SCATTER": {
        const { minerId } = action;
        const COST = 2; // 2 SF
        
        if (D(state.stellarFragments).lt(COST)) return state;
        
        const currentCount = state.tagsByMinerId[minerId] || 0;
        if (currentCount <= 0) return state;
        
        // Pick random target (not self)
        const ownedIds = Object.keys(state.ownedMiners).filter(id => state.ownedMiners[id] > 0 && id !== minerId);
        
        let targetId = "miner_01";
        if (ownedIds.length > 0) {
            targetId = ownedIds[Math.floor(Math.random() * ownedIds.length)];
        }
        
        const newTagsMap = { ...state.tagsByMinerId };
        newTagsMap[minerId] = currentCount - 1;
        newTagsMap[targetId] = (newTagsMap[targetId] || 0) + 1;
        
        return {
            ...state,
            stellarFragments: D(state.stellarFragments).sub(COST),
            tagsByMinerId: newTagsMap
        };
    }

    case "REALIGN_TAG_GATHER": {
        const { minerId } = action; // The one receiving the tag
        const COST = 80; // 80 SF
        
        if (D(state.stellarFragments).lt(COST)) return state;
        
        // Find valid sources (miners with tags > 0, excluding self)
        const potentialSources = Object.keys(state.tagsByMinerId).filter(
            id => id !== minerId && state.tagsByMinerId[id] > 0
        );
        
        if (potentialSources.length === 0) return state;
        
        // Pick random source to steal from
        const sourceId = potentialSources[Math.floor(Math.random() * potentialSources.length)];
        
        const newTagsMap = { ...state.tagsByMinerId };
        newTagsMap[sourceId] = (newTagsMap[sourceId] || 0) - 1;
        newTagsMap[minerId] = (newTagsMap[minerId] || 0) + 1;
        
        return {
            ...state,
            stellarFragments: D(state.stellarFragments).sub(COST),
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
        unopenedTags: p.unopenedTags || 0, // LOAD
        highestZoneLifetime: p.highestZoneLifetime || 0, // LOAD
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

        // DAILY QUESTS
        dailyQuest: p.dailyQuest ? {
          lastResetDate: p.dailyQuest.lastResetDate || null,
          weeklyProgress: Number(p.dailyQuest.weeklyProgress || 0),
          weeklyClaimed: Boolean(p.dailyQuest.weeklyClaimed || false),
          activeQuests: p.dailyQuest.activeQuests || [],
          rerollCount: Number(p.dailyQuest.rerollCount || 0),
          weekNumber: Number(p.dailyQuest.weekNumber || 0),
        } : state.dailyQuest,
      };
    }

    case "RESET_GAME": {
      const today = new Date().toISOString().split('T')[0];
      return { 
        ...ECO_INIT,
        dailyQuest: {
          ...ECO_INIT.dailyQuest,
          lastResetDate: today,
          activeQuests: generateDailyQuests(),
        }
      };
    }

    case "PERFORM_STELLAR_REWIND": {
       const gained = D(action.amount || 0);
       
       return {
          ...ECO_INIT,
          stellarFragments: D(state.stellarFragments).add(gained),
          cosmicProtocols: state.cosmicProtocols,
          totalStarlinkTags: state.totalStarlinkTags,
          unopenedTags: state.unopenedTags, // Persist unopened tags
          highestZoneLifetime: state.highestZoneLifetime, // Persist HZE
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
          dailyQuest: state.dailyQuest, // Preserve quest progress across rewind
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
            unopenedTags: state.unopenedTags, // Check if we should keep these? Assuming yes.
            highestZoneLifetime: 0, // RESET ON BIG BANG
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

    case "UPDATE_HIGHEST_ZONE": {
        const zone = action.zone;
        if (zone > (state.highestZoneLifetime || 0)) {
            return { ...state, highestZoneLifetime: zone };
        }
        return state;
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
