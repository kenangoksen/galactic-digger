// components/SideBarRight.js
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

// SENİN KOYACAĞIN DOSYA YOLLARI:
const ICON_MODE_PROGRESS = require("../assets/images/ui/icons/right_progress.png"); // progress icon
const ICON_MODE_FARM = require("../assets/images/ui/icons/right_farm.png"); // farm icon
const ICON_AD = require("../assets/images/ui/icons/right_ad.png"); // gem ad icon

export default function SideBarRight({
  mode = "progress", // "progress" | "farm"
  onToggleMode,
  onAdPress,
  adReady = true, // reklam hazır mı? true iken parıltı
}) {
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
  const modeIcon = isProgress ? ICON_MODE_PROGRESS : ICON_MODE_FARM;

  // Mode glow renkleri (tasarımına göre sonra ince ayar yaparız)
  const modeGlow = useMemo(() => {
    return isProgress
      ? { border: "rgba(255,235,195,0.55)", glow: "rgba(255,235,195,0.35)" }
      : { border: "rgba(140,255,180,0.55)", glow: "rgba(140,255,180,0.30)" };
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

            <Image source={ICON_AD} style={styles.icon} />
          </View>
        </Pressable>

        {/* ---- MODE TOGGLE (altta) ---- */}
        <Pressable onPress={onToggleMode} style={styles.btnWrap} hitSlop={12}>
          <View style={[styles.btnBase, { borderColor: modeGlow.border }]}>
            <View
              pointerEvents="none"
              style={[styles.modeGlow, { backgroundColor: modeGlow.glow }]}
            />
            <Image source={modeIcon} style={styles.icon} />
          </View>
        </Pressable>
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
    overflow: "hidden",
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

  icon: { width: 100, height: 100, resizeMode: "contain" },

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
    left: -8,
    right: -8,
    top: -8,
    bottom: -8,
    borderRadius: 999,
    opacity: 0.35,
  },
});
