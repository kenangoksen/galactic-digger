import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { memo, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

const MAX_EXPLORERS = 5;

function ExplorersSheet({
  visible,
  onClose,
  explorers, // { active: [], byId: {}, nextFreeSlotTime, unlocked }
  onStartQuest,
  onPurchase,
  currentShards,
  onDismiss,
  onCollect, // ✅ Add prop
}) {
  if (!visible) return null;

  const activeExplorers = explorers?.active || [];
  const byId = explorers?.byId || {};
  const unlocked = explorers?.unlocked || false;

  // Unlock check
  if (!unlocked) {
    return (
      <View style={styles.sheet} pointerEvents="auto">
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="rocket-launch" size={20} color="#fbbf24" />
            <Text style={styles.title}>EXPLORERS</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>
        
        <View style={styles.lockedContainer}>
          <MaterialCommunityIcons name="lock" size={64} color="#64748b" />
          <Text style={styles.lockedTitle}>Explorers Locked</Text>
          <Text style={styles.lockedText}>
            Reach Zone 140 and perform your first Stellar Rewind to unlock Explorers!
          </Text>
        </View>
      </View>
    );
  }

  // Slots
  const slots = [];
  for (let i = 0; i < MAX_EXPLORERS; i++) {
    const explorerId = activeExplorers[i];
    const explorer = explorerId ? byId[explorerId] : null;
    slots.push({ index: i, explorer });
  }

  return (
    <View style={styles.sheet} pointerEvents="auto">
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="rocket-launch" size={16} color="#fbbf24" />
          <Text style={styles.title}>EXPLORERS ({activeExplorers.length}/{MAX_EXPLORERS})</Text>
        </View>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
      </View>
      
      {/* CONTENT */}
      <View style={styles.content}>
        <FlatList
          data={slots}
          keyExtractor={item => `slot_${item.index}`}
          renderItem={({ item }) => (
            <ExplorerSlot 
              slot={item} 
              onStartQuest={onStartQuest}
              onPurchase={onPurchase}
              currentShards={currentShards}
              onDismiss={onDismiss}
              onCollect={onCollect}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

function ExplorerSlot({ slot, onStartQuest, onPurchase, currentShards, onDismiss, onCollect }) {
  const { explorer } = slot;

  if (!explorer) {
    // Empty slot
    const canAfford = (currentShards || 0) >= 40;
    
    return (
      <Pressable 
        style={[styles.slotCard, styles.emptySlot, !canAfford && { opacity: 0.6 }]}
        onPress={onPurchase} // Make whole slot clickable
      >
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
            <MaterialCommunityIcons name="plus-circle-outline" size={28} color={canAfford ? "#a78bfa" : "#64748b"} />
            <View>
                <Text style={styles.emptyText}>Recruit Explorer</Text>
                <Text style={{color: canAfford ? "#a78bfa" : "#64748b", fontSize: 11, fontWeight: 'bold'}}>
                    Cost: 40 Shards
                </Text>
            </View>
        </View>
        
        <View style={styles.purchaseBtn}>
            <MaterialCommunityIcons name="diamond-stone" size={14} color={canAfford ? "#a78bfa" : "#64748b"} />
        </View>
      </Pressable>
    );
  }

  // Explorer exists
  const isOnQuest = explorer.currentQuest !== null;
  const rarityColor = getRarityColor(explorer.rarity);

  // Force re-render every second for timer
  const [, setTick] = useState(0);
  useEffect(() => {
    if (isOnQuest) {
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }
  }, [isOnQuest]);

  // Calculate progress if on quest
  let progress = 0;
  let timeRemaining = "";
  if (isOnQuest && explorer.questStartTime) {
    const elapsed = Date.now() - explorer.questStartTime;
    const duration = explorer.currentQuest.duration;
    progress = Math.min(elapsed / duration, 1);
    
    const remaining = Math.max(0, duration - elapsed);
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
    
    if (hours > 0) {
      timeRemaining = `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      timeRemaining = `${minutes}m ${seconds}s`;
    } else {
      timeRemaining = `${seconds}s`;
    }
  }

  return (
    <View style={[styles.slotCard, { borderColor: rarityColor, position: 'relative', overflow: 'visible' }]}>
      
      {/* DISMISS BUTTON (Shop Style - Smaller) */}
      {!isOnQuest && onDismiss && (
          <View style={{position: 'absolute', top: -4, right: -3, zIndex: 999 }}>
              <Pressable 
                onPress={() => onDismiss(explorer)}
                hitSlop={12}
                style={{ backgroundColor: '#000', borderRadius: 9 }} // Small bg to hide card border
              >
                <Ionicons name="close-circle" size={14} color="#ef4444" />
              </Pressable>
          </View>
      )}

      {/* LEFT: Explorer Info */}
      <View style={styles.explorerLeft}>
        <Text style={[styles.explorerName, { color: rarityColor }]}>{explorer.name}</Text>
        <Text style={styles.explorerRarity}>{explorer.rarity} • Lv.{explorer.level}</Text>
        <View style={styles.bonusRow}>
          <MaterialCommunityIcons name="star" size={12} color="#fbbf24" />
          <Text style={styles.bonusText}>
            {getBonusLabel(explorer.bonusType)}: +{(explorer.bonusValue * 100).toFixed(0)}%
          </Text>
        </View>
      </View>

      {/* RIGHT: Quest Status or Start Button */}
      <View style={styles.explorerRight}>
        {isOnQuest ? (
          progress >= 1 ? (
             <Pressable 
                style={[styles.startQuestBtn, { backgroundColor: '#10b981' }]} 
                onPress={() => onCollect && onCollect(explorer)}
             >
                <MaterialCommunityIcons name="check-circle-outline" size={16} color="#fff" />
                <Text style={styles.startQuestText}>COLLECT</Text>
             </Pressable>
          ) : (
            <View style={styles.questProgress}>
                {/* Progress Bar with Countdown */}
                <View style={styles.progressBarContainer}>
                <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                <Text style={styles.countdownText}>{timeRemaining}</Text>
                </View>
                {/* Reward */}
                <Text style={styles.rewardText} numberOfLines={1}>
                {getRewardLabel(explorer.currentQuest)}
                </Text>
            </View>
          )
        ) : (
          <Pressable 
            style={styles.startQuestBtn} 
            onPress={() => onStartQuest(explorer.id)}
          >
            <MaterialCommunityIcons name="rocket-launch-outline" size={16} color="#fff" />
            <Text style={styles.startQuestText}>Start Quest</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function getRewardLabel(quest) {
  const { D, fmtD } = require("../game/bn");
  const { QUEST_TYPE } = require("../game/explorers/explorerTypes");
  
  if (!quest) return "N/A";
  
  switch (quest.type) {
    case QUEST_TYPE.MINERAL:
      return `${fmtD(quest.baseReward)} Minerals`;
    case QUEST_TYPE.FRAGMENT:
      return `+${fmtD(quest.baseReward)} Fragments`;
    case QUEST_TYPE.SHARD:
      return `+${fmtD(quest.baseReward)} Shards`;
    case QUEST_TYPE.ARTIFACT:
      return `${(quest.baseReward * 100).toFixed(0)}% Chance: Artifact`;
    case QUEST_TYPE.PROTOCOL:
      return "Protocol Boost";
    case QUEST_TYPE.RECRUIT:
      return "New Explorer";
    default:
      return "Unknown Reward";
  }
}

function getRarityColor(rarity) {
  const colors = {
    COMMON: "#9ca3af",
    UNCOMMON: "#4ade80",
    RARE: "#3b82f6",
    EPIC: "#a855f7",
    FABLED: "#ec4899",
    MYTHICAL: "#f97316",
    LEGENDARY: "#eab308",
    TRANSCENDENT: "#06b6d4",
  };
  return colors[rarity] || "#9ca3af";
}

function getBonusLabel(bonusType) {
  const labels = {
    MINERAL_BONUS: "Mineral Bonus",
    FRAGMENT_BONUS: "Fragment Bonus",
    SHARD_BONUS: "Shard Bonus",
    PROTOCOL_ACTIVATION: "Protocol Activation",
    RECRUITMENT_SPEED: "Recruitment Speed",
    EXTRA_LIVES: "Extra Lives",
  };
  return labels[bonusType] || bonusType;
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 74, // Match MinersSheet
    height: 280, // Match MinersSheet
    // top: 200, // REMOVED
    backgroundColor: "rgba(15, 23, 42, 0.98)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#fbbf24", 
    zIndex: 50,
    paddingTop: 10, // Reduced from 16 to move header up
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6, // Reduced from 8
    // paddingTop removed
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6, // Reduced from 8
  },
  title: {
    fontSize: 12, // Reduced from 16
    fontWeight: "800",
    color: "#fbbf24",
    letterSpacing: 0.5, // Reduced from 1
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
    gap: 12,
  },
  
  // LOCKED STATE
  lockedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#cbd5e1",
    marginTop: 16,
    marginBottom: 8,
  },
  lockedText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
  },
  
  // SLOT CARD
  slotCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8, // Reduced radius
    padding: 8, // Reduced from 16
    borderWidth: 1, // Reduced border width
    borderColor: "rgba(255,255,255,0.1)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8, // Reduced gap
    marginBottom: 6, // Compact spacing
  },
  emptySlot: {
    flexDirection: "row", 
    alignItems: "center",
    justifyContent: "space-between", 
    paddingVertical: 8, 
    paddingHorizontal: 8,
    borderStyle: "dashed",
    height: 52, // Even shorter
  },
  emptyText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "bold",
  },
  purchaseBtn: {
    width: 28, 
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(167, 139, 250, 0.1)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.3)",
  },
  purchaseBtnText: {
    color: "#a78bfa",
    fontSize: 10,
    fontWeight: "bold",
  },
  
  // EXPLORER CARD - LEFT SIDE
  explorerLeft: {
    flex: 1,
  },
  explorerName: {
    fontSize: 13, // Reduced
    fontWeight: "bold",
  },
  explorerRarity: {
    fontSize: 10, // Reduced
    color: "#94a3b8",
    marginTop: 1,
  },
  bonusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  bonusText: {
    color: "#cbd5e1",
    fontSize: 10, // Reduced
    fontWeight: "600",
  },
  
  // EXPLORER CARD - RIGHT SIDE
  explorerRight: {
    flex: 0.8,
    alignItems: "flex-end",
  },
  questProgress: {
    width: "100%",
  },
  progressBarContainer: {
    height: 24, // Compact bar
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
    marginBottom: 4,
  },
  progressBarFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#4ade80",
    borderRadius: 6,
  },
  countdownText: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    textAlign: "center",
    lineHeight: 24, // Match bar
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
    zIndex: 1,
  },
  rewardText: {
    color: "#cbd5e1",
    fontSize: 10,
    textAlign: "right",
  },
  startQuestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4, // Reduced from 6
    backgroundColor: "#2563eb",
    paddingVertical: 6, // Reduced from 10
    paddingHorizontal: 10, // Reduced from 16
    borderRadius: 6, // Reduced from 8
  },
  startQuestText: {
    color: "#fff",
    fontSize: 11, // Reduced from 13
    fontWeight: "bold",
  },
});

export default memo(ExplorersSheet);
