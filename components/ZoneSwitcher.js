// components/ZoneSwitcher.js
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { Image, LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// PNG yollarını sen koyacaksın:
const ICON_PLANET = require("../assets/images/ui/zone/zone_planet.png");

export default function ZoneSwitcher({
  zone = 1,                 // aktif zone
  maxUnlockedZone = 1,      // oyuncunun açtığı en ileri zone
  onPrev,
  onNext,
}) {
  const hasPrev = zone > 1;
  const hasNext = zone < maxUnlockedZone;

  // Trigger animation on zone change
  useEffect(() => {
    // Spring animation for bouncy effect
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
  }, [zone]);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <LinearGradient
        colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.55)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.frame}
      >
        {/* LEFT ARROW */}
        <Pressable
          onPress={hasPrev ? onPrev : undefined}
          disabled={!hasPrev}
          style={[styles.arrowBtn, !hasPrev && styles.disabled]}
          hitSlop={12}
        >
          <Ionicons name="caret-back" size={24} color={hasPrev ? "#fff" : "rgba(255,255,255,0.2)"} />
        </Pressable>

        {/* ZONES */}
        <View style={styles.zones}>
          {/* Always render 3 slots key structure for slide effect */}
          {zone > 1 && (
             <ZoneSlot key={zone - 1} kind="side" enabled={true} labelZone={zone - 1} />
          )}
          
          <ZoneSlot key={zone} kind="active" enabled={true} labelZone={zone} />
          
          {zone < maxUnlockedZone && (
             <ZoneSlot key={zone + 1} kind="side" enabled={true} labelZone={zone + 1} />
          )}
        </View>

        {/* RIGHT ARROW */}
        <Pressable
          onPress={hasNext ? onNext : undefined}
          disabled={!hasNext}
          style={[styles.arrowBtn, !hasNext && styles.disabled]}
          hitSlop={12}
        >
          <Ionicons name="caret-forward" size={24} color={hasNext ? "#fff" : "rgba(255,255,255,0.2)"} />
        </Pressable>
      </LinearGradient>
    </View>
  );
}

function ZoneSlot({ kind = "side", enabled = false, labelZone }) {
  const isActive = kind === "active";

  return (
    <View style={[styles.slotContainer, isActive && styles.slotContainerActive]}>
        <View style={[styles.slot, isActive && styles.slotActive]}>
            <Image
                source={ICON_PLANET}
                fadeDuration={0} // Force instant appearance on iOS
                style={[
                styles.planet,
                isActive ? styles.planetActive : styles.planetBW,
                !enabled && styles.planetHidden, 
                ]}
            />
        </View>
        
        {/* Zone Number Label - BELOW */}
        <Text style={[styles.zoneNum, isActive && styles.zoneNumActive]}>
            {enabled ? `Zone ${labelZone}` : ""}
        </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 116, 
    left: 0,
    right: 0,
    zIndex: 30,
    alignItems: "center",
  },

  frame: {
    width: "100%",
    height: 64, // Increased height to fit text
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  arrowBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  
  disabled: { opacity: 0.35 },

  zones: {
    flex: 1,
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14, // Increase gap for separation
    overflow: 'hidden',
  },
  
  // Wrapper for Slot + Text
  slotContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 40, // Base width
      gap: 4,
  },
  slotContainerActive: {
      width: 60, // Wider for active
  },

  slot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  slotActive: {
    width: 46, // Much bigger
    height: 46,
    borderRadius: 23,
    borderColor: "rgba(255,235,195,0.55)",
    backgroundColor: "rgba(255,235,195,0.08)",
  },

  planet: {
    width: "100%",
    height: "100%",
    position: "absolute",
    resizeMode: "contain",
  },
  
  planetActive: { opacity: 1 },
  planetBW: { tintColor: "rgba(255,255,255,0.6)", opacity: 0.40 }, // Dimmer
  planetHidden: { opacity: 0 },

  zoneNum: {
    fontSize: 9,
    fontWeight: "600",
    color: "rgba(255,255,255,0.4)",
  },
  zoneNumActive: {
    fontSize: 11,
    marginBottom: -4, // Pull up slightly ?
    color: "#fbbf24", // Gold color for active
    fontWeight: "bold",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 2,
  },
});
