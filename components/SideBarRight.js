// components/SideBarRight.js
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

export default function SideBarRight({
  mode = "progress", // "progress" | "farm"
  onToggleMode,
  onAdPress,
  adReady = true, // reklam hazır mı? true iken parıltı
}) {
  // ---- Tooltip State ----
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimer = useRef(null);

  const handleToggle = () => {
      onToggleMode();
      
      setShowTooltip(true);
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
      tooltipTimer.current = setTimeout(() => {
          setShowTooltip(false);
      }, 2000);
  };

  // ---- Ad pulse anim ----
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!adReady) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => loop.stop();
  }, [adReady, pulse]);

  const adGlowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.55],
  });
  const adGlowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 1.12],
  });

  const isProgress = mode === "progress";
  
  // Icons
  // Progress: Infinite loop / Forward
  // Farm: Anchor / Repeat
  const modeIconName = isProgress ? "infinite" : "repeat";
  const modeColor = isProgress ? "#fbbf24" : "#4ade80"; // Gold vs Green

  // Mode glow renkleri (tasarımına göre sonra ince ayar yaparız)
  const modeGlow = useMemo(() => {
    return isProgress
      ? { border: "rgba(251, 191, 36, 0.6)", glow: "rgba(251, 191, 36, 0.2)" }
      : { border: "rgba(74, 222, 128, 0.6)", glow: "rgba(74, 222, 128, 0.2)" };
  }, [isProgress]);

  return (
    <LinearGradient
      colors={["rgba(0,0,0,0.00)", "rgba(10,10,14,0.55)"]}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 0 }}
      style={styles.sidebar}
      pointerEvents="box-none"
    >
      <LinearGradient
        colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 0 }}
        style={styles.inner}
        pointerEvents="box-none"
      >
        {/* ---- AD BUTTON (üstte) ---- */}
        <Pressable onPress={onAdPress} style={styles.btnWrap} hitSlop={12}>
          <View style={styles.btnBase}>
            {adReady && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.glow,
                  {
                    opacity: adGlowOpacity,
                    transform: [{ scale: adGlowScale }],
                  },
                ]}
              >
                <LinearGradient
                  colors={[
                    "rgba(130,200,255,0.0)",
                    "rgba(130,200,255,0.55)",
                    "rgba(130,200,255,0.0)",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            )}

            <Ionicons name="videocam" size={20} color="#60a5fa" />
          </View>
        </Pressable>

        {/* ---- MODE TOGGLE (altta) ---- */}
        <View style={styles.btnWrap}>
            {showTooltip && (
                <View style={[styles.tooltip, { borderColor: modeColor }]}>
                    <Text style={[styles.tooltipText, { color: modeColor }]}>
                        {isProgress ? "Progress Active" : "Farm Mode ON"}
                    </Text>
                    <View style={[styles.tooltipArrow, { borderLeftColor: modeColor }]} />
                </View>
            )}
            
            <Pressable onPress={handleToggle} hitSlop={12}>
              <View style={[styles.btnBase, { borderColor: modeGlow.border, borderWidth: 1.5 }]}>
                <View
                  pointerEvents="none"
                  style={[styles.modeGlow, { backgroundColor: modeGlow.glow }]}
                />
                <Ionicons name={modeIconName} size={22} color={modeColor} />
              </View>
            </Pressable>
        </View>
      </LinearGradient>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: "absolute",
    right: 0,
    top: 184, // Left bar ile aynı hizaya getir
    width: 56,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    // overflow: "hidden", // REMOVED: prevents tooltip from showing
    zIndex: 25,
  },
  inner: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    borderLeftWidth: 5,
    borderLeftColor: "rgba(255,255,255,0.18)",
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    overflow: "hidden", // Keep overflow hidden here for inner content, but not parent? 
    // actually sidebar needs to be NOT hidden. inner can be if needed. 
    // But inner wraps buttons. Tooltip is inside btnWrap inside inner.
    // If inner has overflow hidden, tooltip will be cut!
    // So REMOVE overflow: hidden from inner too.
  },

  btnWrap: {},
  btnBase: {
    width: 42,
    height: 42,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },

  // No longer used, handled by Ionicons size
  icon: { },

  // Ad pulse glow
  glow: {
    position: "absolute",
    left: -10,
    right: -10,
    top: -10,
    bottom: -10,
    borderRadius: 999,
  },

  // Mode glow (sabit, pulse yok)
  modeGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    opacity: 0.45,
  },

  tooltip: {
      position: 'absolute',
      right: 50, // Button width (42) + margin
      top: 6, // Vertically center relative to 42px button
      backgroundColor: '#000',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      zIndex: 100,
      minWidth: 100,
      alignItems: 'center',
      justifyContent: 'center',
  },

  tooltipText: {
      fontSize: 10,
      fontWeight: 'bold',
      letterSpacing: 0.5,
      textAlign: 'center',
  },

  tooltipArrow: {
      position: 'absolute',
      right: -6,
      top: 10,
      width: 0,
      height: 0,
      borderTopWidth: 6,
      borderTopColor: 'transparent',
      borderBottomWidth: 6,
      borderBottomColor: 'transparent',
      borderLeftWidth: 6,
      // borderLeftColor set via inline style
  }
});
