// components/MinersSheet.js
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useMemo, useRef } from "react";
import {
    Animated,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View
} from "react-native";
import { D, fmtD } from "../game/bn";

const MINER_PLACEHOLDER = require("../assets/images/sprites/miners/miner_01.png");

// Shared Icon Map (Same as SkillsSheet)
const SKILL_ICONS = {
    "s_clickstorm": "flash",
    "s_powersurge": "flame",
    "s_lucky": "eye",
    "s_metal": "magnet",
    "s_goldclicks": "cash",
    "s_darkritual": "skull",
    "s_superclicks": "hammer",
    "s_energize": "battery-charging",
    "s_reload": "refresh-circle",
};

function getSkillIconName(kind, value) {
  switch (kind) {
    case "unlockActiveSkill":
      return SKILL_ICONS[value] || "star"; // Match active skill icon
    case "tapMultiplier":
      return "finger-print";
    case "dpsMultiplier":
      return "flash";
    case "globalDpsMultiplier":
      return "planet";
    case "critChance":
      return "locate"; 
    case "critMultiplier":
      return "nuclear"; 
    case "mineralMultiplier":
      return "diamond";
    default:
      return "star";
  }
}

// Decimal-safe: dpsBase string/number/Decimal olabilir
function minerDpsPerLevel(miner) {
  return miner?.stats?.dpsBase ?? 0;
}

const MinerRow = memo(function MinerRow({
  miner,
  level,
  minerals,
  getNextCost,
  onBuyOrUpgrade, // (minerId) => void
  onBuySkill,     // (minerId, skillId) => void
  purchasedSkillsForMiner,
  tags = 0,       // Starlink Tags
}) {
  const cost = getNextCost(miner, level);

  // Decimal-safe compare
  const canBuy = D(minerals).gte(cost);

  const action = level <= 0 ? "UNLOCK" : "UPGRADE";
  const dpsPerLvl = minerDpsPerLevel(miner);
  
  // Base DPS
  let totalDpsVal = D(dpsPerLvl).mul(Math.max(1, level));
  
  // Apply Starlink Multiplier to displayed DPS
  if (tags > 0) {
      const tagMult = 1 + tags * 0.50; // hardcoded 0.50 or pass config?
      totalDpsVal = totalDpsVal.mul(tagMult);
  }
  
  const dpsLine = D(dpsPerLvl).gt(0)
    ? `${fmtD(totalDpsVal)} DPS`
    : "— DPS";

  // Animation ref (Keep subtle press effect)
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95, 
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };
  
  // ✅ SORT SKILLS BY LEVEL
  const sortedSkills = useMemo(() => {
     if (!miner.skills) return [];
     return [...miner.skills].sort((a, b) => (a.unlockAt || 0) - (b.unlockAt || 0));
  }, [miner.skills]);

  return (
    <View style={[styles.item, tags > 0 && styles.itemGilded]}>
      {tags > 0 && (
        <LinearGradient
            colors={['rgba(255, 215, 0, 0.15)', 'rgba(255, 215, 0, 0.05)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
        />
      )}
      {/* ICON BOX */}
      <View style={styles.iconBox}>
        <Image source={MINER_PLACEHOLDER} style={styles.icon} />
        {tags > 0 && (
             <View style={styles.tagBadge}>
                 <MaterialCommunityIcons name="star-four-points" size={8} color="#ffd700" />
                 <Text style={styles.tagBadgeTxt}>{tags}x</Text>
             </View>
        )}
        {level > 0 && (
          <View style={styles.lvlBadge}>
            <Text style={styles.lvlBadgeTxt}>{level}</Text>
          </View>
        )}
      </View>

      {/* INFO */}
      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.name}>{miner.name}</Text>
        <Text style={styles.dpsText}>{dpsLine}</Text>
        
        {/* SKILLS STRIP - Simplified */}
        {!!(sortedSkills.length > 0) && (
          <View style={styles.skillStrip}>
            {sortedSkills.map((sk) => {
              const unlockAt = Number(sk.unlockAt || 9999);
              const locked = level < unlockAt;
              const purchased = !!purchasedSkillsForMiner?.[sk.id];
              const skCost = D(sk.cost || 0);
              const canAffordSkill = !locked && !purchased && D(minerals).gte(skCost);

              let iconColor = "#ffffff40";
              const iconName = getSkillIconName(sk.kind, sk.value); // Use value for mapping match

              if (purchased) iconColor = "#4ade80"; // Green
              else if (canAffordSkill) iconColor = "#fbbf24"; // Gold
              else if (!locked) iconColor = "#94a3b8"; // Available grey

              return (
                <Pressable
                  key={sk.id}
                  disabled={locked || purchased}
                  onPress={() => onBuySkill && onBuySkill(miner.id, sk.id)}
                  style={[
                    styles.skillDot,
                    locked && styles.skillDotLocked,
                    purchased && styles.skillDotOwned,
                    canAffordSkill && styles.skillDotBuyable,
                  ]}
                >
                    {locked ? 
                        <Ionicons name="lock-closed" size={8} color="rgba(255,255,255,0.2)" /> : 
                        <Ionicons name={iconName} size={10} color={iconColor} />
                    }
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* ACTION BUTTON */}
      <Pressable
        onPress={() => onBuyOrUpgrade(miner.id)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!canBuy}
      >
        <Animated.View style={[{ transform: [{ scale }] }]}>
            <View style={[styles.buyBtn, !canBuy && styles.buyBtnDisabled]}>
              <Text style={styles.buyBtnAction}>{action}</Text>
              <View style={styles.costRow}>
                  <Text style={styles.costText}>{fmtD(cost)}</Text>
                  <MaterialCommunityIcons name="diamond-stone" size={10} color={canBuy ? "#fff" : "rgba(255,255,255,0.5)"} />
              </View>
            </View>
        </Animated.View>
      </Pressable>
    </View>
  );
});

function MinersSheetImpl({
  miners = [],
  owned = {},
  ownedSkills = {},
  tagsByMinerId = {}, // ✅
  minerals = 0,
  getNextCost,
  onBuyOrUpgrade,
  onBuySkill,
  onClose,
  unlockedCount = 2,
}) {
  const listRef = useRef(null);

  const data = useMemo(() => {
    const count = Math.max(2, Number(unlockedCount || 2));
    return miners.slice(0, Math.min(count, miners.length));
  }, [miners, unlockedCount]);

  return (
    <View style={styles.sheet} pointerEvents="auto">
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="pickaxe" size={20} color="#60a5fa" />
          <Text style={styles.title}>MINING OPERATIONS</Text>
        </View>
        
        <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        renderItem={({ item: m }) => {
          const lvl = Number(owned[m.id] || 0);
          const purchasedMap = ownedSkills?.[m.id] || {};
          return (
            <MinerRow
              miner={m}
              level={lvl}
              minerals={minerals}
              getNextCost={getNextCost}
              onBuyOrUpgrade={onBuyOrUpgrade}
              onBuySkill={onBuySkill}
              purchasedSkillsForMiner={purchasedMap}
              tags={tagsByMinerId[m.id] || 0} // ✅
            />
          );
        }}
      />
    </View>
  );
}

export default memo(MinersSheetImpl);

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 74,
    height: 260, // Standard height per user request
    borderRadius: 20,
    backgroundColor: "rgba(12, 16, 28, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)", // Blue border
    paddingTop: 12,
    paddingHorizontal: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
  },
  multBtn: {
      backgroundColor: "rgba(37, 99, 235, 0.2)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(37, 99, 235, 0.5)",
  },
  multBtnTxt: {
      color: "#60a5fa",
      fontSize: 10,
      fontWeight: "bold",
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#60a5fa", // Blue
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 10,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)", // Flat glass
    padding: 8,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    overflow: 'hidden', // For gradient
  },
  itemGilded: {
      borderColor: "rgba(255, 215, 0, 0.3)", // Gold border
      backgroundColor: "rgba(255, 215, 0, 0.05)", 
  },
  iconBox: {
    width: 36,
    height: 36,
    backgroundColor: "rgba(59, 130, 246, 0.15)", // Blue tint
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.2)",
  },
  tagBadge: {
      position: 'absolute',
      bottom: -4,
      left: -4, // Moved to Left
      backgroundColor: '#000',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#ffd700',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 3,
      paddingVertical: 1,
      zIndex: 10,
  },
  tagBadgeTxt: {
      color: '#ffd700',
      fontSize: 8,
      fontWeight: 'bold',
      marginLeft: 1,
  },
  icon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
  },
  lvlBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#1d4ed8', // Darker Blue
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  lvlBadgeTxt: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 2,
  },
  dpsText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "600",
  },
  skillStrip: {
    flexDirection: "row",
    marginTop: 4,
    gap: 4,
  },
  skillDot: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  skillDotLocked: {
    opacity: 0.5,
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.05)",
  },
  skillDotOwned: {
    backgroundColor: "rgba(74, 222, 128, 0.2)",
    borderColor: "#4ade80",
  },
  skillDotBuyable: {
    borderColor: "#fbbf24",
    backgroundColor: "rgba(251, 191, 36, 0.1)",
  },
  buyBtn: {
    backgroundColor: "#2563eb", // Solid Blue
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 70,
  },
  buyBtnDisabled: {
    backgroundColor: "rgba(255,255,255,0.05)",
    opacity: 0.5,
  },
  buyBtnAction: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  costText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
});
