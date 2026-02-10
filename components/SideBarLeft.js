import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";

const ICONS = {
  settings: require("../assets/images/ui/side/settings.png"),
  achievements: require("../assets/images/ui/side/achievements.png"),
  artifacts: require("../assets/images/ui/side/relics.png"),
  clan: require("../assets/images/ui/side/clan.png"),
};

export default function SideBarLeft({
  onSettings,
  onAchievements,
  onArtifacts,
  onClan,
  notificationCount = 0, // 🔔
}) {
  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={[
          "rgba(255,255,255,0.02)",
          "rgba(20,16,32,0.65)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.container}
      >
        <SideBtn icon={ICONS.settings} onPress={onSettings} />
        <SideBtn 
            icon={ICONS.achievements} 
            onPress={onAchievements} 
            badge={notificationCount} // 🔔 Pass count
        />
        <SideBtn icon={ICONS.artifacts} onPress={onArtifacts} />
        <SideBtn icon={ICONS.clan} onPress={onClan} />
      </LinearGradient>
    </View>
  );
}

function SideBtn({ icon, onPress, badge }) {
  // Animation for Badge
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
      if (badge > 0) {
          const anim = Animated.loop(
              Animated.sequence([
                  Animated.timing(translateY, {
                      toValue: -4,
                      duration: 500,
                      useNativeDriver: true,
                  }),
                  Animated.timing(translateY, {
                      toValue: 0,
                      duration: 500,
                      useNativeDriver: true,
                  })
              ])
          );
          anim.start();
          return () => anim.stop();
      } else {
          translateY.setValue(0);
      }
  }, [badge]);

  return (
    <Pressable onPress={onPress} style={styles.btn}>
      <Image source={icon} style={styles.icon} />
      
      {/* 🔔 Notification Badge */}
      {badge > 0 && (
          <Animated.View 
            style={[
                styles.badge, 
                { transform: [{ translateY }] }
            ]}
          >
              <Text style={styles.badgeText}>!</Text>
          </Animated.View>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    top: 184,
    width: 56,
    paddingVertical: 12,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    overflow: "hidden",
  },

  container: {
    paddingVertical: 1,
    paddingRight: 0,
    paddingLeft: 8,

    gap: 12,

    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,

    borderRightWidth: 5,
    borderColor: "rgba(255,255,255,0.18)",
  },

  btn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  icon: {
    width: 100,
    height: 100,
    resizeMode: "contain",
  },
  
  // 🔔 Badge Styles
  badge: {
      position: 'absolute',
      right: -2,
      top: -2,
      backgroundColor: '#ef4444',
      width: 18,
      height: 18,
      borderRadius: 9,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: '#fff',
      zIndex: 10,
      shadowColor: "#ef4444",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 4,
  },
  badgeText: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 12,
  }
});
