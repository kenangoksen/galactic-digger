import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

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

export default function SkillsSheet({ engine, onClose }) {
  const { 
      activeSkills, 
      skillCooldowns, 
      isSkillUnlockable, 
      activateSkill, 
      SKILLS_CONFIG
  } = engine;

  const [now, setNow] = useState(Date.now());

  // Timer loop
  useEffect(() => {
     const timer = setInterval(() => setNow(Date.now()), 1000);
     return () => clearInterval(timer);
  }, []);

  const renderItem = ({ item: skill }) => {
    const isUnlocked = isSkillUnlockable(skill.id);
    const isActive = (activeSkills[skill.id] || 0) > now;
    const cooldownEnds = skillCooldowns[skill.id] || 0;
    const isCoolingDown = cooldownEnds > now;

    // Status Logic
    let statusColor = "#555";
    let statusText = "LOCKED";
    let statusIcon = "lock-closed";

    if (isUnlocked) {
        if (isActive) {
            statusColor = "#4ade80"; // Green
            statusText = `${Math.ceil((activeSkills[skill.id] - now)/1000)}s`;
            statusIcon = "time";
        } else if (isCoolingDown) {
            statusColor = "#fbbf24"; // Yellow/Orange
            statusText = `${Math.ceil((cooldownEnds - now)/60000)}m`;
            statusIcon = "hourglass";
        } else {
            statusColor = "#3b82f6"; // Blue
            statusText = "READY";
            statusIcon = "play";
        }
    }

    return (
        <TouchableOpacity
            style={[styles.card, !isUnlocked && styles.cardLocked]}
            disabled={!isUnlocked || (isCoolingDown && !isActive)}
            onPress={() => !isActive && activateSkill(skill.id)}
            activeOpacity={0.7}
        >
             <LinearGradient
                colors={isUnlocked ? ["rgba(30, 41, 59, 0.8)", "rgba(15, 23, 42, 0.9)"] : ["rgba(0,0,0,0.5)", "rgba(0,0,0,0.8)"]}
                style={styles.cardGradient}
              >
                {/* Header: Icon + Name */}
                <View style={styles.cardHeader}>
                    <Ionicons 
                        name={SKILL_ICONS[skill.id] || "cube"} 
                        size={14} 
                        color={isActive ? "#fbbf24" : isUnlocked ? "#e2e8f0" : "#444"} 
                        style={{marginRight: 4}}
                    />
                    <Text style={[styles.name, isActive && styles.nameActive]} numberOfLines={1}>
                        {skill.name}
                    </Text>
                </View>

                {/* Description */}
                <Text style={styles.descText} numberOfLines={2}>
                    {skill.description}
                </Text>
                
                {/* Status Bar */}
                <View style={[styles.statusBar, { backgroundColor: isUnlocked ? 'rgba(0,0,0,0.3)' : 'transparent' }]}>
                    {isUnlocked ? (
                         <>
                            <Ionicons name={statusIcon} size={8} color={statusColor} style={{ marginRight: 3 }} />
                            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                         </>
                    ) : (
                        <Ionicons name="lock-closed" size={10} color="#444" />
                    )}
                </View>

              </LinearGradient>
        </TouchableOpacity>
    );
  };

  return (
    <View style={styles.sheet} pointerEvents="auto">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
           <MaterialCommunityIcons name="flash-circle" size={16} color="#fbbf24" />
           <Text style={styles.headerTitle}>ACTIVE PROTOCOLS</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color="#aaa" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={SKILLS_CONFIG}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={3}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 74, // Above Navbar
    height: 260, // Minimal height matching Miners
    borderRadius: 16,
    backgroundColor: "rgba(10, 12, 20, 0.98)", // Deep dark
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)", // Subtle Gold
    paddingTop: 10,
    paddingHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
  },
  headerTitle: {
    color: "#fbbf24",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  closeBtn: {
      padding: 4,
  },
  listContent: {
    paddingBottom: 10,
  },
  columnWrapper: {
      gap: 8,
  },
  
  // Card
  card: {
    flex: 1,
    height: 76, // slightly taller for desc
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 8,
    maxWidth: '32%', 
  },
  cardLocked: {
      borderColor: "transparent",
      opacity: 0.6,
  },
  cardGradient: {
      flex: 1,
      padding: 6, // more padding
      justifyContent: 'space-between',
  },
  
  cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
  },
  
  // Icon style inline
  
  name: {
      flex: 1,
      color: "#94a3b8",
      fontSize: 9,
      fontWeight: "700",
  },
  nameActive: {
      color: "#fff",
  },
  
  descText: {
      color: "#64748b",
      fontSize: 8,
      lineHeight: 9,
      marginBottom: 4,
  },
  
  statusBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: 'rgba(0,0,0,0.2)', 
      alignSelf: 'stretch',
  },
  statusText: {
      fontSize: 8,
      fontWeight: 'bold',
  },
});
