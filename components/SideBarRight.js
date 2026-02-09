// components/SideBarRight.js
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Easing,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

const ICON_AD = require("../assets/images/ui/icons/right_ad.png"); // gem ad icon

export default function SideBarRight({
  mode = "progress", // "progress" | "farm"
  onToggleMode,
  onAdPress,
  onDevTools, // ✅ Prop added
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
  const modeIconName = isProgress ? "infinite" : "repeat";
  const modeColor = isProgress ? "#fbbf24" : "#4ade80"; // Gold vs Green

  // Mode glow
  const modeGlow = useMemo(() => {
    return isProgress
      ? { border: "rgba(251, 191, 36, 0.6)", glow: "rgba(251, 191, 36, 0.2)" }
      : { border: "rgba(74, 222, 128, 0.6)", glow: "rgba(74, 222, 128, 0.2)" };
  }, [isProgress]);

  return (
    <View style={styles.container}>
        
        {/* VISUAL LAYER: Gradients and Buttons */}
        <LinearGradient
          colors={["rgba(0,0,0,0.00)", "rgba(10,10,14,0.55)"]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 0 }}
          style={styles.gradientRoot}
          pointerEvents="box-none"
        >
          <LinearGradient
            colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 0 }}
            style={styles.inner}
            pointerEvents="box-none"
          >
            {/* ---- AD BUTTON (Top) ---- */}
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

                <Image source={ICON_AD} style={styles.icon} />
              </View>
            </Pressable>

            {/* ---- MODE TOGGLE (Bottom) ---- */}
            <Pressable onPress={handleToggle} style={styles.btnWrap} hitSlop={12}>
                <View style={[styles.btnBase, { borderColor: modeGlow.border, borderWidth: 1.5 }]}>
                <View
                    pointerEvents="none"
                    style={[styles.modeGlow, { backgroundColor: modeGlow.glow }]}
                />
                <Ionicons name={modeIconName} size={22} color={modeColor} />
                </View>
            </Pressable>

            {/* ---- DEV TOOLS ---- */}
            <View style={{ marginTop: 8 }}>
                 <Pressable 
                    onPress={() => {
                        console.log("DevTools Button Pressed!");
                        onDevTools && onDevTools();
                    }} 
                    style={[styles.btnBase, { width: 36, height: 36 }]}
                 >
                     <Ionicons name="construct" size={16} color="#94a3b8" />
                 </Pressable>
            </View>
          </LinearGradient>
        </LinearGradient>

        {/* TOOLTIP LAYER: Sibling to Gradient to avoid clipping */}
        {showTooltip && (
            <View style={[styles.tooltip, { borderColor: modeColor }]}>
                <Text style={[styles.tooltipText, { color: modeColor }]}>
                    {isProgress ? "Progress Active" : "Farm Mode ON"}
                </Text>
                <View style={[styles.tooltipArrow, { borderLeftColor: modeColor }]} />
            </View>
        )}

    </View>
  );
}

const styles = StyleSheet.create({
  // Root Container - Transparent, allows Tooltip to float
  container: {
    position: "absolute",
    right: 0,
    top: 184,
    // width is implicitly determined by children? No, we should set it.
    width: 56, 
    // No height, so it hugs content
    zIndex: 40, // ✅ Lowered from 9999 so ArtifactsModal (50+) stays on top
    elevation: 20,
    // OVERFLOW VISIBLE IS DEFAULT HERE
  },

  // The actual background gradient
  gradientRoot: {
    width: "100%",
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    // overflow: "hidden", // We can keep this if valid for radius, but Tooltip is OUTSIDE now.
  },
  inner: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "flex-end", // Buttons at bottom? if there's height. 
    // If no height, they stack.
    gap: 12,
    borderLeftWidth: 5,
    borderLeftColor: "rgba(255,255,255,0.18)",
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },

  btnWrap: {
      // Normal wrapper
  },
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

  icon: { width: 44, height: 44, resizeMode: "contain" }, 
  
  glow: {
    position: "absolute",
    left: -10,
    right: -10,
    top: -10,
    bottom: -10,
    borderRadius: 999,
  },

  modeGlow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    opacity: 0.45,
  },

  // Tooltip positioned relative to CONTAINER
  tooltip: {
      position: 'absolute',
      right: 50, // Sticks out to left
      bottom: 20, // Align with bottom button (approx 12px padding + ~8px offset)
      // Note: Mode Toggle is the LAST element.
      // PaddingVertical 12. Button 42.
      // Center of button is 12 + 21 = 33px from bottom.
      // Tooltip is ~26px high?
      // Center tooltip at 33px from bottom.
      // margin-bottom: 20 might be close roughly.
      
      backgroundColor: '#000',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      zIndex: 10000, 
      minWidth: 100,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
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
      top: 8, // Center vertically roughly
      width: 0,
      height: 0,
      borderTopWidth: 6,
      borderTopColor: 'transparent',
      borderBottomWidth: 6,
      borderBottomColor: 'transparent',
      borderLeftWidth: 6,
  }
});
