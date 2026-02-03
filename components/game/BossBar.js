import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { fmt } from "../../game/damage";

export default function BossBar({ hp, maxHp, timeMs, isPrimal }) {
  const pct = useMemo(() => {
    const m = Number(maxHp || 0);
    if (m <= 0) return 0;
    return Math.max(0, Math.min(1, Number(hp || 0) / m));
  }, [hp, maxHp]);

  const secondsLeft = useMemo(() => {
    return Math.max(0, Number(timeMs || 0) / 1000);
  }, [timeMs]);

  const isLowHp = pct <= 0.25;
  const isLast10s = secondsLeft > 0 && secondsLeft <= 10;
  const isLast5s = secondsLeft > 0 && secondsLeft <= 5;

  // Colors
  const themeColor = isPrimal ? "#a359ff" : "#ff3b3b";
  const glowColor = isPrimal ? "#b300ff" : "#ff2a2a";
  const labelText = isPrimal ? "☠ PRIMAL BOSS ☠" : "⚠ BOSS ⚠";

  // anim values
  const pulse = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const widthAnim = useRef(new Animated.Value(pct)).current;

  // Smooth HP Bar
  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.out(Easing.quad),
    }).start();
  }, [pct]);

  const widthInterp = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  // ---------------- PULSE (low HP)
  useEffect(() => {
    if (!isLowHp) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true, // Scale ve Opacity native driver destekler
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 520,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLowHp]);

  // ---------------- BLINK (last 10s)
  useEffect(() => {
    if (!isLast10s) {
      blink.stopAnimation();
      blink.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, {
          toValue: 0.2,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLast10s]);

  // ---------------- SHAKE (last 5s)
  useEffect(() => {
    if (!isLast5s) {
      shake.stopAnimation();
      shake.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, {
          toValue: 1,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: -1,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLast5s]);

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1],
  });

  return (
    <View style={styles.wrap}>
      {/* TIMER TEXT (ORTADA) */}
      <Animated.Text
        style={[
          styles.timerText,
          isLast10s && styles.timerDanger,
          {
            opacity: blink,
            transform: [
              {
                translateX: shake.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: [-2, 0, 2],
                }),
              },
            ],
          },
        ]}
      >
        {secondsLeft.toFixed(1)}s
      </Animated.Text>

      {/* HP BAR */}
      <Animated.View
        style={[
          styles.hpOuter,
          {
            borderColor: isPrimal ? "rgba(163, 89, 255, 0.5)" : "rgba(255,60,60,0.35)",
            shadowColor: glowColor,
            transform: [{ scale: pulseScale }],
            opacity: glowOpacity,
          },
        ]}
      >
        <View style={styles.hpBg}>
          <Animated.View
            style={[
              styles.hpFill, 
              { 
                width: widthInterp, 
                backgroundColor: themeColor 
              }
            ]}
          />
          <View style={styles.hpGloss} />
        </View>

        <Text style={[styles.bossLabel, isPrimal && { color: "#e0c4ff" }]}>
           {labelText}
        </Text>
        <Text style={styles.hpText}>{fmt(hp)}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "86%", 
    alignSelf: "center",
    paddingTop: 6,
    gap: 6,
  },

  timerText: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "1000",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.5,
  },
  timerDanger: {
    color: "#ff0000",
    fontSize: 16,
    textShadowColor: "#ff0000",
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
    fontWeight: "900",
  },

  hpOuter: {
    borderRadius: 12,
    padding: 8,
    backgroundColor: "rgba(10,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,60,60,0.35)",

    shadowColor: "#ff2a2a",
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },

  hpBg: {
    height: 14,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  hpFill: {
    height: "100%",
    borderRadius: 10,
    backgroundColor: "#ff3b3b",
  },

  hpGloss: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "45%",
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  bossLabel: {
    marginTop: 6,
    textAlign: "center",
    color: "rgba(255,255,255,0.95)",
    fontWeight: "1000",
    letterSpacing: 1,
    fontSize: 12,
  },

  hpText: {
    marginTop: 2,
    textAlign: "center",
    color: "rgba(255,255,255,0.7)",
    fontWeight: "900",
    fontSize: 12,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 4,
  },
});
