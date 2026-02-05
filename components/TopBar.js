import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { D, fmtD } from "../game/bn";
import { DAMAGE_CONFIG } from "../game/config";

const icons = {
  mineral: require("../assets/images/ui/topbar/mineral.png"),
  fragment: require("../assets/images/ui/topbar/fragment.png"),
  sword: require("../assets/images/ui/topbar/sword.png"),
  dps: require("../assets/images/ui/topbar/dps.png"),
};

const TOOLTIPS = {
  mineral: "Used to buy and upgrade miners.",
  fragment: "Rare currency for cosmic upgrades.\n(Earned by resetting the universe)",
  sword: "Damage dealt to the monster per tap.",
  dps: "Total DPS dealt by miners.",
};

export default function TopBar(props) {
  const {
    minerals = 0,
    fragments = 0,
    clickDamage = 0,
    dps = 0,
    prestigeReward = 0,
    isIdle = false,
    hasIdleBonus = false, // ✅ Fixed: Defined
  } = props;
  const gain = D(prestigeReward);
  const showGain = gain.gt(0);
  const fragText = showGain 
      ? `${fmtD(fragments)} (+${fmtD(gain)})` 
      : fmtD(fragments);

  const [activeTooltip, setActiveTooltip] = useState(null);

  const handlePress = (key) => {
    setActiveTooltip(activeTooltip === key ? null : key);
  };

  // Streak Display Logic
  const streak = props.streak || 0; // Receive from props
  const showStreak = streak > 5; // Don't show for 1-5 taps
  const streakMult = 1 + Math.min(streak, DAMAGE_CONFIG.STREAK_CAP) * DAMAGE_CONFIG.STREAK_BONUS_PER_TAP;

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        <Stat 
          icon={icons.mineral} 
          value={fmtD(minerals)} 
          onPress={() => handlePress("mineral")}
        />
        <Stat 
          icon={icons.fragment} 
          value={fragText} 
          onPress={() => handlePress("fragment")}
        />
        <Stat 
          icon={icons.sword} 
          value={fmtD(clickDamage)} 
          onPress={() => handlePress("sword")}
        />
        <Stat 
          icon={icons.dps} 
          value={fmtD(dps)} 
          onPress={() => handlePress("dps")}
        />
      </View>


      {/* Streak Badge */}
      {showStreak && (
        <View style={styles.streakBadge}>
            <Text style={styles.streakText}>
                {streak} Combo (x{streakMult.toFixed(2)})
            </Text>
        </View>
      )}

      {/* ✅ Game Mode Badge - Active/Idle */}
      {hasIdleBonus && (
          <View style={[
              styles.modeBadge, 
              isIdle ? styles.modeBadgeIdle : styles.modeBadgeActive
          ]}>
              <View style={[styles.modeDot, { backgroundColor: isIdle ? '#888' : '#00ff00' }]} />
              <Text style={styles.modeText}>
                  {isIdle ? "IDLE" : "ACTIVE"}
              </Text>
          </View>
      )}

      {/* Tooltip Bubble */}
      {activeTooltip && (
        <View style={styles.tooltipParams}>
          <View style={styles.tooltipArrow} />
          <View style={styles.tooltipBody}>
             <Text style={styles.tooltipText}>{TOOLTIPS[activeTooltip]}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function Stat({ icon, value, onPress }) {
// ... existing Stat component ...

  return (
    <Pressable onPress={onPress} style={styles.stat}>
      <Image source={icon} style={styles.icon} />
      <Text style={styles.value}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 52,
    left: 8,
    right: 8,
    zIndex: 100,
    alignItems: "center", // Center tooltip
  },

  bar: {
    width: "100%",
    height: 54, 
    borderRadius: 27,
    paddingHorizontal: 16, 
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between", 
  },

  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5, // Hit slop area
  },

  icon: {
    width: 28,
    height: 28,
    resizeMode: "contain",
  },

  value: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13, 
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  // Tooltip Styles
  tooltipParams: {
    marginTop: 8,
    alignItems: "center",
  },
  tooltipArrow: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "rgba(0,0,0,0.85)", // Arrow color
    marginBottom: -1, // Overlap slightly
  },
  tooltipBody: {
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    maxWidth: 250,
  },
  tooltipText: {
    color: "#eee",
    fontSize: 12,
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 16,
  },
  
  // Streak
  streakBadge: {
    position: 'absolute',
    bottom: -32, // Push lower into the specific gap between TopBar and ZoneSwitcher
    backgroundColor: '#ffaa00',
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderRadius: 12,
    zIndex: 90,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },

  streakText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 11,
  },

  // Game Mode Badge
  modeBadge: {
    position: 'absolute',
    bottom: -18, // Tucked closer
    right: 12, 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // Tighter gap
    paddingVertical: 2, // Smaller padding
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 95,
  },
  modeBadgeActive: {
    backgroundColor: 'rgba(0, 50, 0, 0.8)',
    borderColor: 'rgba(0, 255, 0, 0.3)',
  },
  modeBadgeIdle: {
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modeDot: {
    width: 5, // Smaller dot
    height: 5,
    borderRadius: 2.5,
  },
  modeText: {
    color: '#fff',
    fontSize: 9, // Smaller font
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
