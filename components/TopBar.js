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
        
        {/* LEFT COLUMN: Resources */}
        <View style={styles.columnLeft}>
            <Stat 
              icon={icons.mineral} 
              value={fmtD(minerals)} 
              onPress={() => handlePress("mineral")}
              align="left"
            />
            <Stat 
              icon={icons.fragment} 
              value={fragText} 
              onPress={() => handlePress("fragment")}
              isFragment={true}
              align="left"
            />
        </View>

        {/* RIGHT COLUMN: Damage */}
        <View style={styles.columnRight}>
            <Stat 
              icon={icons.sword} 
              value={fmtD(clickDamage)} 
              onPress={() => handlePress("sword")}
              align="right"
            />
            <Stat 
              icon={icons.dps} 
              value={fmtD(dps)} 
              onPress={() => handlePress("dps")}
              align="right"
            />
        </View>

        {/* ✅ CENTER BADGE: Active/Idle */}
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

      </View>


      {/* Streak Badge */}
      {showStreak && (
        <View style={styles.streakBadge}>
            <Text style={styles.streakText}>
                {streak} Combo (x{streakMult.toFixed(2)})
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

function Stat({ icon, value, onPress, align = "left", isFragment }) {
  return (
    <Pressable onPress={onPress} style={[styles.stat, align === 'right' && styles.statRight]}>
      {align === 'left' && <Image source={icon} style={styles.icon} />}
      
      <Text style={[
          styles.value, 
          isFragment && styles.fragmentValue 
      ]}>{value}</Text>
      
      {align === 'right' && <Image source={icon} style={styles.icon} />}
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
    borderRadius: 16, 
    paddingHorizontal: 16, 
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between", 
  },

  columnLeft: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 2,
      zIndex: 2, // Ensure clicks work
  },

  columnRight: {
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 2,
      zIndex: 2,
  },

  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  
  statRight: {
      justifyContent: 'flex-end',
  },

  icon: {
    width: 16,
    height: 16,
    resizeMode: "contain",
  },

  value: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 11,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    letterSpacing: 0.5,
  },
  
  fragmentValue: {
      color: "#fbbf24", 
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
    borderBottomColor: "rgba(0,0,0,0.85)", 
    marginBottom: -1, 
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
    bottom: -32, 
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

  // Game Mode Badge (Centered in Bar)
  modeBadge: {
    position: 'absolute', // Keep absolute to center without affecting flow
    left: '50%',
    top: '50%',
    transform: [{translateX: -20}, {translateY: -9}], // Center exact
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4, 
    width: 60,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    zIndex: 1,
  },
  modeBadgeActive: {
    backgroundColor: 'rgba(0, 50, 0, 0.4)', // More transparent
    borderColor: 'rgba(0, 255, 0, 0.2)',
  },
  modeBadgeIdle: {
    backgroundColor: 'rgba(30, 30, 30, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modeDot: {
    width: 4, 
    height: 4,
    borderRadius: 2,
  },
  modeText: {
    color: '#fff',
    fontSize: 8, 
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
