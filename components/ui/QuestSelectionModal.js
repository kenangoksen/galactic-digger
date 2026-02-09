import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { D, fmtD } from "../../game/bn";
import { QUEST_TYPE } from "../../game/explorers/explorerTypes";

const REROLL_COST = D(10); // 10 Shards to reroll quests

const QUEST_ICONS = {
  [QUEST_TYPE.MINERAL]: "diamond-stone",
  [QUEST_TYPE.FRAGMENT]: "star-four-points",
  [QUEST_TYPE.SHARD]: "cube-outline",
  [QUEST_TYPE.ARTIFACT]: "trophy",
  [QUEST_TYPE.PROTOCOL]: "flash",
  [QUEST_TYPE.RECRUIT]: "account-search",
};

const QUEST_COLORS = {
  [QUEST_TYPE.MINERAL]: "#ef4444",
  [QUEST_TYPE.FRAGMENT]: "#a855f7",
  [QUEST_TYPE.SHARD]: "#fbbf24",
  [QUEST_TYPE.ARTIFACT]: "#ec4899",
  [QUEST_TYPE.PROTOCOL]: "#3b82f6",
  [QUEST_TYPE.RECRUIT]: "#10b981",
};

const QUEST_LABELS = {
  [QUEST_TYPE.MINERAL]: "Mineral Expedition",
  [QUEST_TYPE.FRAGMENT]: "Fragment Hunt",
  [QUEST_TYPE.SHARD]: "Shard Discovery",
  [QUEST_TYPE.ARTIFACT]: "Artifact Search",
  [QUEST_TYPE.PROTOCOL]: "Protocol Boost",
  [QUEST_TYPE.RECRUIT]: "Scout Mission",
};

function formatDuration(ms) {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default function QuestSelectionModal({
  visible,
  onClose,
  explorer,
  quests, // Array of 4 quests
  onSelectQuest,
  onRerollQuests,
  currentShards,
}) {
  if (!visible || !explorer) return null;

  const canReroll = D(currentShards).gte(REROLL_COST);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <MaterialCommunityIcons name="rocket-launch" size={20} color="#fbbf24" />
              <Text style={styles.title}>SELECT QUEST</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          {/* EXPLORER INFO */}
          <View style={styles.explorerInfo}>
            <Text style={styles.explorerName}>{explorer.name}</Text>
            <Text style={styles.explorerLevel}>Level {explorer.level} • {explorer.rarity}</Text>
          </View>

          {/* QUESTS */}
          <ScrollView contentContainerStyle={styles.content}>
            {quests.map((quest, idx) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                onSelect={() => onSelectQuest(quest)}
              />
            ))}
          </ScrollView>

          {/* REROLL BUTTON */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.rerollBtn, !canReroll && styles.disabledBtn]}
              onPress={() => {
                if (canReroll) {
                  onRerollQuests();
                }
              }}
            >
              <MaterialCommunityIcons name="refresh" size={18} color="#fff" />
              <Text style={styles.rerollText}>
                Reroll Quests ({fmtD(REROLL_COST)} Shards)
              </Text>
            </Pressable>
            {!canReroll && (
              <Text style={styles.warningText}>Insufficient Shards</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function QuestCard({ quest, onSelect }) {
  const icon = QUEST_ICONS[quest.type] || "help-circle";
  const color = QUEST_COLORS[quest.type] || "#64748b";
  const label = QUEST_LABELS[quest.type] || quest.type;
  const duration = formatDuration(quest.duration);
  const deathRisk = (quest.deathRisk * 100).toFixed(1);

  // Format reward based on type
  let rewardText = "";
  if (quest.type === QUEST_TYPE.MINERAL || quest.type === QUEST_TYPE.FRAGMENT || quest.type === QUEST_TYPE.SHARD) {
    rewardText = `~${fmtD(quest.baseReward)}`;
  } else if (quest.type === QUEST_TYPE.ARTIFACT) {
    rewardText = `${(quest.baseReward * 100).toFixed(0)}% chance`;
  } else if (quest.type === QUEST_TYPE.PROTOCOL || quest.type === QUEST_TYPE.RECRUIT) {
    rewardText = "Guaranteed";
  }

  return (
    <Pressable
      style={[styles.questCard, { borderColor: color }]}
      onPress={onSelect}
    >
      <View style={styles.questLeft}>
          {/* HEADER */}
          <View style={styles.questHeader}>
            <MaterialCommunityIcons name={icon} size={18} color={color} />
            <Text style={[styles.questLabel, { color }]}>{label}</Text>
          </View>

          {/* STATS */}
          <View style={styles.questStats}>
            <View style={styles.statRow}>
              <MaterialCommunityIcons name="clock-outline" size={12} color="#94a3b8" />
              <Text style={styles.statText}>{duration}</Text>
            </View>
            <View style={styles.statRow}>
              <MaterialCommunityIcons name="gift-outline" size={12} color="#94a3b8" />
              <Text style={styles.statText}>{rewardText}</Text>
            </View>
            {Number(deathRisk) > 0 && (
                <View style={styles.statRow}>
                <MaterialCommunityIcons name="skull-outline" size={12} color="#ef4444" />
                <Text style={[styles.statText, { color: '#ef4444' }]}>{deathRisk}%</Text>
                </View>
            )}
          </View>
      </View>

      {/* SELECT BUTTON */}
      <View style={[styles.selectBtn, { backgroundColor: color }]}>
        <Text style={styles.selectText}>SELECT</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: "#fbbf24",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12, // Reduced from 16
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(251, 191, 36, 0.3)",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6, // Reduced from 8
  },
  title: {
    fontSize: 14, // Reduced from 16
    fontWeight: "800",
    color: "#fbbf24",
    letterSpacing: 0.5, // Reduced from 1
  },
  closeBtn: {
    padding: 4,
  },
  explorerInfo: {
    padding: 12, // Reduced from 16
    backgroundColor: "rgba(255,255,255,0.03)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    flexDirection: "row", // Horizontal layout for compact
    alignItems: "center",
    justifyContent: "space-between",
  },
  explorerName: {
    fontSize: 14, // Reduced from 18
    fontWeight: "bold",
    color: "#fff",
  },
  explorerLevel: {
    fontSize: 11, // Reduced from 12
    color: "#94a3b8",
    // marginTop removed due to row layout
  },
  content: {
    padding: 12, // Reduced from 16
    gap: 8, // Reduced from 12
  },
  questCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8, // Reduced from 12
    padding: 10, // Reduced from 16
    borderWidth: 1, // Reduced from 2
    flexDirection: "row", // Row layout for compact
    alignItems: "center",
    justifyContent: "space-between",
  },
  // New layout style wrapper
  questLeft: {
    flex: 1,
    gap: 4,
  },
  questHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6, // Reduced from 10
    marginBottom: 2, // Reduced from 12
  },
  questLabel: {
    fontSize: 13, // Reduced from 16
    fontWeight: "bold",
  },
  questStats: {
    flexDirection: "row", // Horizontal stats
    gap: 8, // Reduced
    flexWrap: "wrap",
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4, // Reduced from 6
  },
  statText: {
    fontSize: 11, // Reduced from 13
    color: "#cbd5e1",
  },
  selectBtn: {
    paddingVertical: 6, // Reduced from 10
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: "center",
    marginLeft: 8,
  },
  selectText: {
    color: "#fff",
    fontSize: 11, // Reduced from 13
    fontWeight: "bold",
  },
  footer: {
    padding: 12, // Reduced from 16
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  rerollBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366f1",
    paddingVertical: 10, // Reduced from 12
    borderRadius: 8,
  },
  rerollText: {
    color: "#fff",
    fontSize: 13, // Reduced from 14
    fontWeight: "bold",
  },
  disabledBtn: {
    opacity: 0.4,
    backgroundColor: "#555",
  },
  warningText: {
    color: "#ef4444",
    fontSize: 11, // Reduced from 12
    textAlign: "center",
    marginTop: 6, // Reduced from 8
    fontWeight: "600",
  },
});
