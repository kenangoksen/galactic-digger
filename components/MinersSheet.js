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

console.log("MINERSHEET FILE: components/MinersSheet.js loaded");

const MINER_PLACEHOLDER = require("../assets/images/sprites/miners/miner_01.png");



function getSkillIconName(kind) {
  switch (kind) {
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
}) {
  const cost = getNextCost(miner, level);

  // Decimal-safe compare
  const canBuy = D(minerals).gte(cost);

  const action = level <= 0 ? "UNLOCK" : "UPGRADE";

  const dpsPerLvl = minerDpsPerLevel(miner);

  // totalDps = dpsPerLvl * level (en az 1)
  const totalDps = D(dpsPerLvl).mul(Math.max(1, level));

  const dpsLine = D(dpsPerLvl).gt(0)
    ? `${fmtD(totalDps)} DPS`
    : "— DPS";

  // Animation ref
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.85, // More aggressive shrink
      useNativeDriver: true,
      speed: 20,
      bounciness: 12,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 12,
    }).start();
  };

  return (
    <View style={styles.rowWrapper}>
      <LinearGradient
        colors={["rgba(255,255,255,0.03)", "rgba(255,255,255,0.005)"]}
        style={styles.rowGradient}
      >
        <View style={styles.row}>
          <View style={styles.iconContainer}>
            <Image source={MINER_PLACEHOLDER} style={styles.icon} />
             {level > 0 && (
              <View style={styles.lvlBadge}>
                <Text style={styles.lvlBadgeTxt}>{level}</Text>
              </View>
            )}
          </View>

          <View style={styles.mid}>
            <View style={styles.headerLine}>
               <Text numberOfLines={1} style={styles.name}>{miner.name}</Text>
               <Text style={styles.subLine}>{dpsLine}</Text>
            </View>
            
            {!!(miner.skills && miner.skills.length) && (
              <View style={styles.skillStrip}>
                {miner.skills.map((sk) => {
                  const unlockAt = Number(sk.unlockAt || 9999);
                  const locked = level < unlockAt;
                  const purchased = !!purchasedSkillsForMiner?.[sk.id];
                  
                  // Cost check for visual feedback
                  const skCost = D(sk.cost || 0);
                  const canAffordSkill = !locked && !purchased && D(minerals).gte(skCost);

                  // Icon Color Logic
                  let iconColor = "#ffffff50"; // default locked gray
                  const iconName = getSkillIconName(sk.kind);

                  if (purchased) iconColor = "#4ade80"; // Bright Green
                  else if (canAffordSkill) iconColor = "#fbbf24"; // Bright Gold
                  else if (!locked) iconColor = "#94a3b8"; // Unlocked but cant afford

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
                        !locked && !purchased && !canAffordSkill && styles.skillDotCantAfford
                      ]}
                    >{locked ? <Ionicons name="lock-closed" size={8} color="rgba(255,255,255,0.3)" /> : <Ionicons name={iconName} size={10} color={iconColor} />}{purchased && <View style={styles.skillBadge}><Ionicons name="checkmark" size={6} color="#000" /></View>}</Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <Pressable
            onPress={() => onBuyOrUpgrade(miner.id)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={!canBuy}
          >
            <Animated.View
              style={[
                styles.btnFrame,
                !canBuy && styles.btnFrameDisabled,
                { transform: [{ scale }] },
              ]}
            >
              <LinearGradient
                colors={
                  canBuy
                    ? ["#4d79ff", "#002db3"]
                    : ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.02)"]
                }
                style={styles.btnGradient}
              >
                <Text style={[styles.btnTxt, !canBuy && styles.btnTxtDisabled]}>
                  {action}
                </Text>
                <View style={styles.costRow}>
                  <MaterialCommunityIcons 
                    name="diamond-stone" 
                    size={9} 
                    color={canBuy ? "#80b3ff" : "rgba(255,255,255,0.3)"} 
                  />
                  <Text style={[styles.btnCost, !canBuy && styles.btnTxtDisabled]}>
                    {fmtD(cost)}
                  </Text>
                </View>
              </LinearGradient>
            </Animated.View>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
});

function MinersSheetImpl({
  miners = [],
  owned = {},
  ownedSkills = {},
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
      {/* Glossy Header Handle */}
      <View style={styles.handleContainer}>
         <View style={styles.handleBar} />
      </View>

      <Pressable onPress={onClose} style={styles.closeChevron} hitSlop={12}>
        <MaterialCommunityIcons name="chevron-down" size={24} color="rgba(255,255,255,0.4)" />
      </Pressable>

      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.list}
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
            />
          );
        }}
        ListFooterComponent={<View style={{ height: 20 }} />}
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
    height: 260, // Ultra compact
    borderRadius: 20,
    backgroundColor: "rgba(12, 16, 28, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(70, 100, 200, 0.2)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 8,
  },

  handleContainer: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 2,
  },
  handleBar: {
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
  },

  closeChevron: {
    position: "absolute",
    top: 4,
    right: 10,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },

  list: {
    paddingTop: 4,
    paddingBottom: 20,
    paddingHorizontal: 8,
  },

  rowWrapper: {
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.3)",
  },

  rowGradient: {
    padding: 6, // Ultra compact padding
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconContainer: {
    marginRight: 8,
  },
  icon: {
    width: 36, // Mini icon
    height: 36,
    resizeMode: "contain",
  },
  lvlBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    backgroundColor: '#002db3',
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  lvlBadgeTxt: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },

  mid: {
    flex: 1,
    minWidth: 0,
    paddingRight: 6,
    justifyContent: 'center',
  },
  
  headerLine: {
      marginBottom: 2,
  },

  name: {
    color: "#e0e6ff",
    fontSize: 11, // Tweak: 12 -> 11
    fontWeight: "800",
    letterSpacing: 0.1,
  },

  subLine: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10, 
    fontWeight: '600',
  },

  btnFrame: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  btnFrameDisabled: {
    opacity: 0.6,
  },

  btnGradient: {
    width: 72, // Narrow
    paddingVertical: 5, // Thin
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  btnTxt: {
    color: "white",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  btnTxtDisabled: {
    color: "rgba(255,255,255,0.3)",
  },
  
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 0,
  },

  btnCost: {
    color: "#b3d1ff",
    fontSize: 9,
    fontWeight: "700",
  },

  skillStrip: {
    flexDirection: "row",
    marginTop: 1,
    gap: 3,
  },

  skillDot: {
    width: 18, // Tweak: 14 -> 18
    height: 18, // Tweak: 14 -> 18
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },

  skillDotLocked: {
    opacity: 0.3,
  },

  skillDotOwned: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderColor: "#4ade80",
    borderWidth: 1,
  },
  
  skillDotBuyable: {
    borderColor: "#fbbf24",
    borderWidth: 1,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 2,
  },

  skillDotCantAfford: {
      backgroundColor: "rgba(255,255,255,0.02)",
      borderColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
  },

  skillBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      backgroundColor: '#4ade80',
      width: 8,
      height: 8,
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#000',
  },

  skillDotIcon: {
    // Only used for Emoji fallback if vectors fail (removed vector text wrapper)
  },
});
