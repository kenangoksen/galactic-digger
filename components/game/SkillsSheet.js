import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

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
      SKILLS_CONFIG,
      mineralBonusEndTime,
      watchAdForMinerals
  } = engine;

  const [now, setNow] = useState(Date.now());
  const [isLoadingAd, setIsLoadingAd] = useState(false);

  // Timer loop
  useEffect(() => {
     const timer = setInterval(() => setNow(Date.now()), 1000);
     return () => clearInterval(timer);
  }, []);

  // Prepare Data: Prepend Ad Bonus
  const data = [
      { id: "AD_BONUS", isAd: true },
      ...SKILLS_CONFIG
  ];

  const handleAdPress = () => {
      if (isLoadingAd) return;

      Alert.alert(
          "WATCH AD?",
          "Watch a short video to get +100% Mineral Gain for 4 hours?\n\n(Duration stacks!)",
          [
              { text: "Cancel", style: "cancel" },
              { 
                  text: "WATCH AD", 
                  onPress: () => {
                      // Simulate Ad
                      setIsLoadingAd(true);
                      setTimeout(() => {
                          watchAdForMinerals();
                          setIsLoadingAd(false);
                      }, 2000); // 2 seconds loader
                  } 
              }
          ]
      );
  };

  const renderItem = ({ item }) => {
    // === AD BONUS CARD ===
    if (item.isAd) {
        const isActive = (mineralBonusEndTime || 0) > now;
        const timeLeftMs = (mineralBonusEndTime || 0) - now;
        
        let timeStr = "READY";
        if (isActive) {
            const totalSeconds = Math.floor(timeLeftMs / 1000);
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
            // Pad with leading zeros
            const pad = (n) => n.toString().padStart(2, '0');
            timeStr = `${pad(h)}:${pad(m)}:${pad(s)}`;
        }

        return (
            <TouchableOpacity
                style={[styles.card, styles.adCard]}
                onPress={handleAdPress}
                activeOpacity={0.8}
                disabled={isLoadingAd}
            >
                <LinearGradient
                    colors={isActive ? ["#ca8a04", "#854d0e"] : ["#1e293b", "#0f172a"]} 
                    style={styles.cardGradient}
                >
                    <View style={styles.cardHeader}>
                        <MaterialCommunityIcons name="play-box-outline" size={16} color="#fff" style={{marginRight: 6}} />
                        <Text style={[styles.name, { color: "#fff" }]}>MINERAL BOOST</Text>
                    </View>
                    
                    <Text style={[styles.descText, { color: "#e2e8f0" }]}>
                        +100% Minerals (4h)
                    </Text>

                    <View style={[styles.statusBar, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                        {isLoadingAd ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : isActive ? (
                            <>
                                <Ionicons name="time" size={10} color="#fff" style={{ marginRight: 4 }} />
                                <Text style={[styles.statusText, { color: "#fff" }]}>{timeStr}</Text>
                            </>
                        ) : (
                            <>
                                <Ionicons name="play" size={10} color="#4ade80" style={{ marginRight: 4 }} />
                                <Text style={[styles.statusText, { color: "#4ade80" }]}>WATCH AD</Text>
                            </>
                        )}
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    // === SKILL CARD ===
    const skill = item;
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
        data={data}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={2}
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
    left: 0,
    right: 0,
    bottom: 74, // Above Navbar
    height: 280, // Reduced to Reveal HP Bar
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "rgba(10, 12, 20, 0.98)", // Deep dark
    borderTopWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)", // Subtle Gold
    paddingTop: 10,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 20,
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
    height: 80, // slightly taller
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 8,
    maxWidth: '48%', // Ensure 2 cols fit with gap
  },
  adCard: {
      borderColor: "#ca8a04",
      elevation: 4,
  },
  cardLocked: {
      borderColor: "transparent",
      opacity: 0.6,
  },
  cardGradient: {
      flex: 1,
      padding: 8, 
      justifyContent: 'space-between',
  },
  
  cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
  },
  
  name: {
      flex: 1,
      color: "#94a3b8",
      fontSize: 10, // Larger
      fontWeight: "700",
  },
  nameActive: {
      color: "#fff",
  },
  
  descText: {
      color: "#64748b",
      fontSize: 9,
      lineHeight: 11,
      marginBottom: 4,
  },
  
  statusBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 3,
      borderRadius: 4,
      backgroundColor: 'rgba(0,0,0,0.2)', 
      alignSelf: 'stretch',
  },
  statusText: {
      fontSize: 9,
      fontWeight: 'bold',
  },
});
