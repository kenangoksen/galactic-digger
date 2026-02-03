// components/ZoneSwitcher.js
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, Image, LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// PNG path
const ICON_PLANET = require("../assets/images/ui/zone/zone_planet.png");

export default function ZoneSwitcher({
  zone = 1,
  maxUnlockedZone = 1,
  onPrev,
  onNext,
  comboActive = false,
}) {
  const hasPrev = zone > 1;
  const hasNext = zone < maxUnlockedZone;
  const isMaxReached = zone === maxUnlockedZone;
  
  // Animated Value for Top Position
  const topAnim = useRef(new Animated.Value(114)).current; // Default 114

  // 1. Zone Change Animation (LayoutAnimation is fine for internal content layout changes like text width)
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [zone]);
  
  // 2. Position Animation (Spring for smooth slide)
  useEffect(() => {
      Animated.spring(topAnim, {
          toValue: comboActive ? 154 : 114,
          useNativeDriver: false, // 'top' is not supported by native driver
          friction: 8, // Bounciness
          tension: 40, // Speed
      }).start();
  }, [comboActive]);

  return (
    <Animated.View 
      style={[styles.wrap, { top: topAnim }]} 
      pointerEvents="box-none"
    >
      <View style={styles.container}>
        
        {/* Shadow / Glow Layer */}
        <LinearGradient
            colors={["rgba(0,0,0,0.6)", "rgba(0,0,0,0.85)"]}
            style={styles.bgGradient}
        />

        {/* Content Row */}
        <View style={styles.content}>
            {/* LEFT ARROW */}
            <Pressable
              onPress={hasPrev ? onPrev : undefined}
              disabled={!hasPrev}
              style={[styles.arrowBtn, !hasPrev && styles.disabled]}
              hitSlop={16}
            >
              <Ionicons name="chevron-back" size={20} color={hasPrev ? "#fff" : "rgba(255,255,255,0.1)"} />
            </Pressable>

            {/* ZONES DISPLAY */}
            <View style={styles.displayArea}>
                {/* Previous Zone Visual */}
                <View style={[styles.planetSlot, { opacity: hasPrev ? 0.4 : 0, transform: [{scale: 0.7}] }]}>
                    {hasPrev && (
                        <>
                        <Image source={ICON_PLANET} style={styles.planetImg} />
                        <Text style={styles.planetNum}>{zone - 1}</Text>
                        </>
                    )}
                </View>

                {/* ACTIVE ZONE */}
                <View style={styles.activeSlot}>
                    <View style={styles.glowContainer}>
                        <Image source={ICON_PLANET} style={styles.activePlanetImg} />
                    </View>
                    <Text style={styles.activeNum}>{zone}</Text>
                    
                    {isMaxReached && (
                        <View style={styles.maxBadgeFloat}>
                            <Text style={styles.maxText}>MAX</Text>
                        </View>
                    )}
                </View>

                {/* Next Zone Visual */}
                <View style={[styles.planetSlot, { opacity: hasNext ? 0.4 : 0, transform: [{scale: 0.7}] }]}>
                    {hasNext && (
                        <>
                        <Image source={ICON_PLANET} style={styles.planetImg} />
                        <Text style={styles.planetNum}>{zone + 1}</Text>
                        </>
                    )}
                </View>
            </View>

            {/* RIGHT ARROW */}
            <Pressable
              onPress={hasNext ? onNext : undefined}
              disabled={!hasNext}
              style={[styles.arrowBtn, !hasNext && styles.disabled]}
              hitSlop={16}
            >
              <Ionicons name="chevron-forward" size={20} color={hasNext ? "#fff" : "rgba(255,255,255,0.1)"} />
            </Pressable>
        </View>
        
        {/* Progress Line - Wrapped to fix overflow */}
        <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${Math.min(100, (zone / maxUnlockedZone) * 100)}%` }]} />
        </View>

      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    // top is dynamic
    left: 0, 
    right: 0,
    alignItems: "center",
    zIndex: 40,
  },

  container: {
    width: 250, 
    height: 52, 
    borderRadius: 26, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },

  bgGradient: { 
     borderRadius: 26, 
     ...StyleSheet.absoluteFillObject,
     overflow: 'hidden', 
  },

  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },

  arrowBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  
  disabled: { backgroundColor: "transparent" },

  displayArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  // Side Planets
  planetSlot: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
  },
  planetImg: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
      opacity: 0.5,
      tintColor: '#888',
  },
  planetNum: {
      position: 'absolute',
      fontSize: 10,
      color: 'rgba(255,255,255,0.7)',
      fontWeight: 'bold',
      textShadowColor: 'black',
      textShadowRadius: 3,
  },

  // Active Planet
  activeSlot: {
      width: 62,
      height: 62,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10, 
      marginTop: -14, 
  },
  activePlanetImg: {
      width: 62,
      height: 62,
      resizeMode: 'contain',
  },
  activeNum: {
    position: 'absolute',
    fontSize: 14, 
    color: "#fff",
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 4,
    elevation: 5,
  },
  
  maxBadgeFloat: {
      position: 'absolute',
      bottom: -2,
      backgroundColor: '#fbbf24',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#fff',
      zIndex: 20,
  },
  maxText: {
      fontSize: 8,
      color: '#000',
      fontWeight: '800',
  },

  // Progress Bar Fix
  progressContainer: {
    height: 3,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.1)",
    position: 'absolute',
    bottom: 0,
    overflow: 'hidden', // Clip the inner bar
    borderBottomLeftRadius: 26, // Match Container
    borderBottomRightRadius: 26,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#3b82f6", 
  },
});
