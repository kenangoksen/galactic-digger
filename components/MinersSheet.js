// components/MinersSheet.js
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useMemo, useRef, useState } from "react";
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
import { getBulkCost } from "../game/damage";
import MinerDetailsModal from "./MinerDetailsModal";
import StellarRealignmentModal from "./StellarRealignmentModal"; // ✅ New Modal

const MINER_PLACEHOLDER = require("../assets/images/sprites/miners/miner_01.png");

// Shared Icon Map (Same as SkillsSheet)
// Shared Icon Map (Same as MinerDetailsModal)
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
    "dpsMultiplier": "sword-cross",
    "globalDpsMultiplier": "earth",
    "tapMultiplier": "finger-print",
    "mineralMultiplier": "diamond-stone",
    "critChance": "target",
    "critMultiplier": "nuke",
    "unlock_feature_rewind": "orbit", // ✅ Rewind Icon
    "default": "star"
};

function getSkillIconName(kind, value) {
  if (kind === "unlockActiveSkill") return SKILL_ICONS[value] || SKILL_ICONS.default;
  return SKILL_ICONS[kind] || SKILL_ICONS.default;
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
  buyAmount = 1,  // ✅ Default 1
  currentDps,     // ✅ Live DPS from totals
  onShowDetails,  // ✅ New Prop
}) {
  const cost = getBulkCost(miner, level, buyAmount); // ✅ Use bulk cost

  // Decimal-safe compare
  const canBuy = D(minerals).gte(cost);

  const action = level <= 0 ? "UNLOCK" : "UPGRADE";
  
  // Use passed currentDps if available, else usage deprecated fallback
  // If currentDps is supplied, it includes ALL multipliers (Leveling, Tags, Global, Active)
  let displayDps = D(0);
  if (currentDps) {
      displayDps = D(currentDps);
  } else {
      // Fallback (should not happen if parents are updated)
      const dpsPerLvl = minerDpsPerLevel(miner);
      displayDps = D(dpsPerLvl).mul(Math.max(1, level));
      if (tags > 0) {
          const tagMult = 1 + tags * 0.50; 
          displayDps = displayDps.mul(tagMult);
      }
  }

  const dpsLine = D(displayDps).gt(0)
    ? `${fmtD(displayDps)} DPS`
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

      {/* INFO - Press to Show Details */}
      <Pressable style={styles.info} onPress={() => onShowDetails && onShowDetails(miner.id)}>
        <Text numberOfLines={1} style={styles.name}>{miner.name}</Text>
        <Text style={styles.dpsText}>{dpsLine}</Text>
        
        {/* SKILLS STRIP - Visual Only */}
        {!!(sortedSkills.length > 0) && (
          <View style={styles.skillStrip}>
            {sortedSkills.map((sk) => {
              const unlockAt = Number(sk.unlockAt || 9999);
              const locked = level < unlockAt;
              const purchased = !!purchasedSkillsForMiner?.[sk.id];
              const iconName = getSkillIconName(sk.kind, sk.value); 

              return (
                <View
                  key={sk.id}
                  style={[
                    styles.skillBox, 
                    locked && styles.skillBoxLocked,
                    purchased && styles.skillBoxOwned,
                  ]}
                >
                    <MaterialCommunityIcons 
                        name={iconName} // ✅ Always show skill icon, never lock icon
                        size={12} 
                        color={purchased ? "#4ade80" : locked ? "#64748b" : "#fbbf24"} 
                    />
                </View>
              );
            })}
          </View>
        )}
      </Pressable>

      {/* ACTION BUTTON */}
      <Pressable
        onPress={() => onBuyOrUpgrade(miner.id, buyAmount)}
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
  onBuyAllSkills, // 🌟 New Prop
  totals, // ✅ Live DPS Breakdown
  dpsMultiplier = 1, // ✅ Active Skill Multiplier
  eco, // ✅ Passed from Index
  dispatchEco, // ✅ Passed from Index
}) {
  const listRef = useRef(null);
  const [buyMultiplier, setBuyMultiplier] = useState(1);
  const [selectedMinerId, setSelectedMinerId] = useState(null); // ✅ Details Modal State
  const [showRealignment, setShowRealignment] = useState(false); // ✅ Realignment Modal State

  const toggleMult = () => {
      setBuyMultiplier(prev => {
          const opts = [1, 10, 25, 100, 1000, 10000];
          const idx = opts.indexOf(prev);
          return opts[(idx + 1) % opts.length];
      });
  };

  const visibleMiners = useMemo(() => {
    const count = Math.max(2, Number(unlockedCount || 2));
    return miners.slice(0, Math.min(count, miners.length));
  }, [miners, unlockedCount]);

  const renderItem = ({ item }) => {
    const level = Math.floor(Number(owned[item.id] || 0));
    const tags = tagsByMinerId?.[item.id] || 0;
    
    // Calculate Live DPS
    let dpsStart = D(0);
    if (totals && totals.breakdown && totals.breakdown.miners[item.id]) {
        // breakdown.dps already includes: Base * Level * LevelingMult * LocalPassives * Tags
        dpsStart = D(totals.breakdown.miners[item.id].dps);
        
        // Apply Global Factors that aren't in breakdown (handled in totals.dps usually)
        // totals.globalDpsMult includes: Protocols, Artifacts, Global Passives, Fragments
        dpsStart = dpsStart.mul(totals.globalDpsMult || 1);
        
        // Apply Active Skills
        dpsStart = dpsStart.mul(dpsMultiplier);
    } 

    return (
      <MinerRow
        miner={item}
        level={level}
        minerals={minerals}
        getNextCost={getNextCost}
        onBuyOrUpgrade={onBuyOrUpgrade}
        onBuySkill={onBuySkill}
        purchasedSkillsForMiner={ownedSkills?.[item.id]}
        tags={tags}
        buyAmount={buyMultiplier}
        currentDps={dpsStart} // ✅ Pass calculated DPS
        onShowDetails={setSelectedMinerId} // ✅ Open Modal
      />
    );
  };

  return (
    <View style={styles.sheet} pointerEvents="auto">
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="pickaxe" size={20} color="#60a5fa" />
          <Text style={styles.title}>MINING OPERATIONS</Text>
        </View>
        
        <View style={styles.headerRight}>
            <Pressable onPress={toggleMult} style={styles.multBtn}>
                <Text style={styles.multBtnTxt}>{buyMultiplier === 10000 ? "MAX" : `x${buyMultiplier}`}</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={visibleMiners}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        renderItem={renderItem}
        ListFooterComponent={
            <View style={{paddingBottom: 20}}>
            <Pressable 
                onPress={onBuyAllSkills} 
                style={({pressed}) => [
                    styles.buyAllBtn,
                    pressed && { opacity: 0.8, transform: [{scale: 0.98}] }
                ]}
            >
                <MaterialCommunityIcons name="lightning-bolt" size={16} color="#000" />
                <Text style={styles.buyAllTxt}>BUY AVAILABLE SKILLS</Text>
            </Pressable>
            
            {/* STELLAR REALIGNMENT BUTTON */}
            <Pressable 
                onPress={() => setShowRealignment(true)}
                style={({pressed}) => [
                    styles.realignBtn,
                    pressed && { opacity: 0.8, transform: [{scale: 0.98}] }
                ]}
            >
                <MaterialCommunityIcons name="star-four-points" size={16} color="#fbbf24" />
                <View>
                    <Text style={styles.realignBtnTxt}>STELLAR REALIGNMENT</Text>
                    <Text style={styles.realignSubTxt}>Transfer Tags • Optimize DPS</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={16} color="#fbbf24" />
            </Pressable>
         </View>
        }
      />
      
      {/* MINER DETAILS MODAL */}
      <MinerDetailsModal
        visible={!!selectedMinerId}
        miner={miners.find(m => m.id === selectedMinerId)}
        onClose={() => setSelectedMinerId(null)}
        level={Math.floor(Number(owned[selectedMinerId] || 0))}
        onBuySkill={onBuySkill}
        purchasedSkills={ownedSkills?.[selectedMinerId]}
        tags={tagsByMinerId?.[selectedMinerId] || 0}
        minerals={minerals}
        ownedMiners={owned}
        ownedSkills={ownedSkills}
        tagsByMinerId={tagsByMinerId} // ✅
        eco={eco} // ✅
        currentDps={
            selectedMinerId && totals?.breakdown?.miners?.[selectedMinerId]
            ? D(totals.breakdown.miners[selectedMinerId].dps).mul(totals.globalDpsMult || 1).mul(dpsMultiplier)
            : 0
        }
      />

      {/* STELLAR REALIGNMENT MODAL */}
      <StellarRealignmentModal
        visible={showRealignment}
        onClose={() => setShowRealignment(false)}
        eco={eco || {}}
        dispatchEco={dispatchEco}
        ownedMiners={owned}
        totals={totals}
      />
    </View>
  );
}

export default memo(MinersSheetImpl);

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 74,
    height: 280, // Reduced to Reveal HP Bar
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "rgba(12, 16, 28, 0.98)",
    borderTopWidth: 1,
    borderBottomWidth: 0, // No bottom border
    borderColor: "rgba(59, 130, 246, 0.3)", // Blue border
    paddingTop: 12,
    paddingHorizontal: 16, // More internal padding since full width
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 }, // Shadow upwards
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
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
    fontSize: 12,
    fontWeight: "800",
    color: "#60a5fa", // Blue
    letterSpacing: 0.5,
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
    marginTop: 6,
    gap: 4,
  },
  skillBox: {
    width: 20, // ✅ Reduced from 24
    height: 20,
    borderRadius: 5, // Slightly less rounded
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  skillBoxLocked: {
     opacity: 0.8,
    backgroundColor: "#0f172a", 
    borderColor: "#1e293b", 
  },
  skillBoxOwned: {
    backgroundColor: "rgba(74, 222, 128, 0.15)",
    borderColor: "#4ade80",
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
  buyAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#fbbf24', // Gold
      paddingVertical: 12,
      marginHorizontal: 8,
      marginTop: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#f59e0b',
  },
  buyAllTxt: {
      color: '#000',
      fontWeight: 'bold',
      fontSize: 12,
      letterSpacing: 0.5
  },
  realignBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(55, 65, 81, 0.5)', // Dark Grey
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginHorizontal: 8,
      marginTop: 12, // ✅ Added gap
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#4b5563',
  },
  realignBtnTxt: {
      color: '#fbbf24', // Gold
      fontWeight: 'bold',
      fontSize: 12,
  },
  realignSubTxt: {
      color: '#9ca3af',
      fontSize: 10,
  }
});
