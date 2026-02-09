
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ARTIFACT_AFFIX, ARTIFACT_RARITY } from "../../game/artifacts/artifactTypes";

// Rarity Colors Mapping
const RARITY_COLORS = {
  [ARTIFACT_RARITY.COMMON]: "#9ca3af",     // Gray 400
  [ARTIFACT_RARITY.UNCOMMON]: "#4ade80",   // Green 400
  [ARTIFACT_RARITY.RARE]: "#60a5fa",       // Blue 400
  [ARTIFACT_RARITY.EPIC]: "#a78bfa",       // Purple 400
  [ARTIFACT_RARITY.LEGENDARY]: "#fbbf24",  // Amber 400
  [ARTIFACT_RARITY.MYTHIC]: "#f43f5e",     // Rose 500
};

const RARITY_LABELS = {
  [ARTIFACT_RARITY.COMMON]: "Common",
  [ARTIFACT_RARITY.UNCOMMON]: "Uncommon",
  [ARTIFACT_RARITY.RARE]: "Rare",
  [ARTIFACT_RARITY.EPIC]: "Epic",
  [ARTIFACT_RARITY.LEGENDARY]: "Legendary",
  [ARTIFACT_RARITY.MYTHIC]: "Mythic",
};

// Affix Icons Mapping
const AFFIX_ICONS = {
  [ARTIFACT_AFFIX.ANCIENT_POWER_ALL]: "book-open-variant",
  [ARTIFACT_AFFIX.IDLE_DPS]: "timer-sand",
  [ARTIFACT_AFFIX.CLICK_DAMAGE]: "cursor-default-click",
  [ARTIFACT_AFFIX.OFFLINE_EARNINGS]: "sleep",
  [ARTIFACT_AFFIX.CRIT_CHANCE]: "target",
  [ARTIFACT_AFFIX.SHARD_FIND]: "shimmer",
};

const AFFIX_LABELS = {
  [ARTIFACT_AFFIX.ANCIENT_POWER_ALL]: "Ancient Power (Global DMG)",
  [ARTIFACT_AFFIX.IDLE_DPS]: "Idle DPS",
  [ARTIFACT_AFFIX.CLICK_DAMAGE]: "Click Damage",
  [ARTIFACT_AFFIX.OFFLINE_EARNINGS]: "Offline Earnings",
  [ARTIFACT_AFFIX.CRIT_CHANCE]: "Crit Chance",
  [ARTIFACT_AFFIX.SHARD_FIND]: "Shard Find Chance",
};

function ArtifactCard({ artifact, onPress, style }) {
  if (!artifact) return null;

  const color = RARITY_COLORS[artifact.rarity] || "#ccc";
  const label = RARITY_LABELS[artifact.rarity] || artifact.rarity;

  // Calculate stars based on upgrade level
  // e.g. every 5 levels = 1 big star or just show number
  const starCount = Math.floor((artifact.upgradeLevel || 0) / 5);

  return (
    <Pressable style={[styles.card, { borderColor: color }, style]} onPress={onPress}>
      <LinearGradient
        colors={[`${color}20`, `${color}05`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="trophy-variant-outline" size={24} color={color} />
        </View>
        <View style={styles.titleContainer}>
            <Text style={[styles.rarity, { color }]}>{label} {artifact.rarity === 'MYTHIC' && '🔥'}</Text>
            <Text style={styles.name}>Artifact #{artifact.id.slice(-4)}</Text>
        </View>
        <View style={styles.levelBadge}>
             <Text style={styles.levelText}>Lv.{artifact.level}</Text>
        </View>
      </View>

      {/* AFFIXES */}
      <View style={styles.affixList}>
        {artifact.affixes.map((affix, idx) => {
            const icon = AFFIX_ICONS[affix.type] || "star";
            const name = AFFIX_LABELS[affix.type] || affix.type;
            
            // Format value
            let valStr = "";
            if (affix.type === ARTIFACT_AFFIX.CRIT_CHANCE || affix.type === ARTIFACT_AFFIX.SHARD_FIND) {
                valStr = `+${(Number(affix.value) * 100).toFixed(1)}%`;
            } else {
                 valStr = `+${(Number(affix.value) * 100).toFixed(0)}%`;
            }

            return (
                <View key={idx} style={styles.affixRow}>
                    <MaterialCommunityIcons name={icon} size={14} color="#ccc" style={{ marginRight: 6 }} />
                    <Text style={styles.affixText}>{name}</Text>
                    <Text style={[styles.affixValue, { color }]}>{valStr}</Text>
                </View>
            );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
    padding: 10,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 6,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  titleContainer: {
    flex: 1,
  },
  rarity: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  name: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  levelBadge: {
      alignItems: 'flex-end',
  },
  levelText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
  },
  upgradeText: {
      fontSize: 10,
      fontWeight: '900',
  },
  affixList: {},
  affixRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
  },
  affixText: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 12,
      flex: 1,
  },
  affixValue: {
      fontSize: 12,
      fontWeight: 'bold',
  },
});

export default memo(ArtifactCard);
