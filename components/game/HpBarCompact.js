import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { fmt } from "../../game/damage";

export default function HpBarCompact({
  zoneText = "Zone 1 • 1/10",
  hp = 0,
  maxHp = 1,
  bossMsLeft = 0,
}) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(1, Number(hp) / Number(maxHp))) : 0;
  
  // Anim ref
  const widthAnim = useRef(new Animated.Value(pct)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 300, // Smooth transition
      useNativeDriver: false, // Width animasyonunda false şart
      easing: Easing.out(Easing.quad),
    }).start();
  }, [pct]);

  const widthInterp = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const bossTxt =
    bossMsLeft > 0 ? `${(bossMsLeft / 1000).toFixed(2)}s` : "";

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Text style={styles.zone}>{zoneText}</Text>

      <View style={styles.barOuter}>
        {/* Animated Bar Fill */}
        <Animated.View style={[styles.barFill, { width: widthInterp }]} />
        <Text style={styles.hpText}>{fmt(hp)}</Text>
      </View>

      {bossMsLeft > 0 && <Text style={styles.timer}>{bossTxt}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  zone: {
    color: "rgba(255,255,255,0.78)",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.3,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },

  barOuter: {
    width: 240, // <<< GENISLIK BURADAN (çok geniş olmasın)
    height: 18,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  barFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,235,195,0.85)", // master’a yakın sıcak bar
  },

  hpText: {
    color: "rgba(255,255,255,0.95)",
    fontWeight: "900",
    fontSize: 12,
    textShadowColor: "rgba(0,0,0,0.60)",
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },

  timer: {
    marginTop: -2,
    color: "rgba(255,255,255,0.78)",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.2,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 2 },
  },
});
