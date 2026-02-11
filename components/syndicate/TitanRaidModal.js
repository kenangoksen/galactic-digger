// components/syndicate/TitanRaidModal.js
// 30-second Void Titan raid battle — tap as fast as possible!

import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    Vibration,
    View,
} from "react-native";
import {
    RAID_DURATION_MS,
    calculateRaidTapDamage,
    getDailyWeakness,
} from "../../game/syndicate/raidService";

const BOSS_IMG = require("../../assets/images/sprites/planets/boss_planet.png");
const COUNTDOWN_SECS = 3;

export default function TitanRaidModal({ visible, onClose, syndicateHook }) {
  const syn = syndicateHook;

  // ─── State ───
  const [phase, setPhase] = useState("ready"); // ready | countdown | fighting | done
  const [countdown, setCountdown] = useState(COUNTDOWN_SECS);
  const [timeLeft, setTimeLeft] = useState(RAID_DURATION_MS / 1000);
  const [tapCount, setTapCount] = useState(0);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);
  const tapCountRef = useRef(0);

  // Reset on open
  useEffect(() => {
    if (visible) {
      setPhase("ready");
      setCountdown(COUNTDOWN_SECS);
      setTimeLeft(RAID_DURATION_MS / 1000);
      setTapCount(0);
      setResult(null);
      setSubmitting(false);
      tapCountRef.current = 0;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [visible]);

  // ─── Start Countdown ───
  const startCountdown = useCallback(() => {
    setPhase("countdown");
    let count = COUNTDOWN_SECS;
    setCountdown(count);

    const interval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(interval);
        startFight();
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, []);

  // ─── Start Fight ───
  const startFight = useCallback(() => {
    setPhase("fighting");
    let seconds = RAID_DURATION_MS / 1000;
    setTimeLeft(seconds);

    timerRef.current = setInterval(() => {
      seconds--;
      setTimeLeft(seconds);
      if (seconds <= 0) {
        clearInterval(timerRef.current);
        endFight();
      }
    }, 1000);
  }, []);

  // ─── End Fight ───
  const endFight = useCallback(async () => {
    setPhase("done");
    setSubmitting(true);

    try {
      const res = await syn.submitRaid(tapCountRef.current);
      setResult(res);
    } catch (e) {
      Alert.alert("Raid Error", e.message);
    }
    setSubmitting(false);
  }, [syn]);

  // ─── Handle Tap ───
  const handleTap = useCallback(() => {
    if (phase !== "fighting") return;

    tapCountRef.current++;
    setTapCount(tapCountRef.current);

    // Vibration feedback
    try { Vibration.vibrate(10); } catch {}

    // Tap animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();

    // Shake effect
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 5, duration: 25, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 25, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 25, useNativeDriver: true }),
    ]).start();
  }, [phase, scaleAnim, shakeAnim]);

  if (!visible) return null;

  // Calculate damage per tap for display
  const weakness = getDailyWeakness();
  const damagePerTap = syn.userProfile
    ? calculateRaidTapDamage(syn.userProfile, weakness)
    : 0;

  return (
    <Modal visible animationType="fade" transparent>
      <View style={s.overlay}>
        <View style={s.container}>
          {/* ═══ READY PHASE ═══ */}
          {phase === "ready" && (
            <>
              <Image source={BOSS_IMG} style={s.bossImage} />
              <Text style={s.titanTitle}>⚔️ Void Titan</Text>
              <Text style={s.titanLevel}>
                Level {syn.todaysRaid?.titanLevel || 1}
              </Text>
              <Text style={s.titanHp}>
                HP: {formatDmg(syn.todaysRaid?.titanHp || 0)}
              </Text>
              <Text style={s.damageInfo}>
                Your damage/tap: {formatDmg(damagePerTap)}
              </Text>

              <Pressable style={s.startBtn} onPress={startCountdown}>
                <Text style={s.startBtnText}>BEGIN RAID</Text>
              </Pressable>

              <Pressable style={s.cancelBtn} onPress={onClose}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </Pressable>
            </>
          )}

          {/* ═══ COUNTDOWN PHASE ═══ */}
          {phase === "countdown" && (
            <View style={s.countdownBox}>
              <Text style={s.countdownText}>{countdown}</Text>
              <Text style={s.countdownSub}>GET READY!</Text>
            </View>
          )}

          {/* ═══ FIGHTING PHASE ═══ */}
          {phase === "fighting" && (
            <>
              {/* Timer */}
              <View style={s.timerRow}>
                <Ionicons name="time" size={20} color={timeLeft <= 5 ? "#ef4444" : "#fbbf24"} />
                <Text style={[s.timerText, timeLeft <= 5 && { color: "#ef4444" }]}>
                  {timeLeft}s
                </Text>
              </View>

              {/* Tap Target */}
              <Pressable onPress={handleTap} style={s.tapZone}>
                <Animated.View
                  style={[
                    s.titanOrbBox,
                    {
                      transform: [
                        { translateX: shakeAnim },
                        { scale: scaleAnim },
                      ],
                    },
                  ]}
                >
                  <View style={s.titanOrb}>
                    <Image source={BOSS_IMG} style={s.bossImageFight} />
                  </View>
                </Animated.View>
              </Pressable>

              {/* Tap counter */}
              <View style={s.statsRow}>
                <View style={s.statBox}>
                  <Text style={s.statLabel}>TAPS</Text>
                  <Text style={s.statValue}>{tapCount}</Text>
                </View>
                <View style={s.statBox}>
                  <Text style={s.statLabel}>DAMAGE</Text>
                  <Text style={s.statValueDmg}>
                    {formatDmg(tapCount * damagePerTap)}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* ═══ DONE PHASE ═══ */}
          {phase === "done" && (
            <>
              {submitting ? (
                <Text style={s.submittingText}>Submitting damage…</Text>
              ) : result ? (
                <>
                  <Ionicons
                    name={result.titanDefeated ? "trophy" : "checkmark-circle"}
                    size={64}
                    color={result.titanDefeated ? "#fbbf24" : "#22c55e"}
                  />
                  <Text style={s.resultTitle}>
                    {result.titanDefeated ? "🎉 TITAN DEFEATED!" : "Raid Complete"}
                  </Text>
                  <View style={s.resultRow}>
                    <Text style={s.resultLabel}>Your Damage:</Text>
                    <Text style={s.resultValue}>{formatDmg(result.personalDamage)}</Text>
                  </View>
                  <View style={s.resultRow}>
                    <Text style={s.resultLabel}>Total Damage:</Text>
                    <Text style={s.resultValue}>
                      {formatDmg(result.totalDamage)} / {formatDmg(result.titanHp)}
                    </Text>
                  </View>
                  <View style={s.resultRow}>
                    <Text style={s.resultLabel}>Taps:</Text>
                    <Text style={s.resultValue}>{tapCount}</Text>
                  </View>
                  <View style={s.resultRow}>
                    <Text style={s.resultLabel}>Attempts Left:</Text>
                    <Text style={s.resultValue}>{result.attemptsRemaining}</Text>
                  </View>

                  <Pressable style={s.doneBtn} onPress={onClose}>
                    <Text style={s.doneBtnText}>Done</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable style={s.doneBtn} onPress={onClose}>
                  <Text style={s.doneBtnText}>Close</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function formatDmg(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.floor(n).toString();
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "90%",
    maxWidth: 360,
    backgroundColor: "#0f0f1a",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
  },

  // Ready
  titanTitle: { color: "#fff", fontSize: 24, fontWeight: "900", marginTop: 16 },
  titanLevel: { color: "#ef4444", fontSize: 16, fontWeight: "bold", marginTop: 4 },
  titanHp: { color: "#888", fontSize: 13, marginTop: 8 },
  damageInfo: { color: "#a855f7", fontSize: 12, marginTop: 4 },
  startBtn: {
    backgroundColor: "#dc2626",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
    marginTop: 28,
  },
  startBtnText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 2,
  },
  cancelBtn: { marginTop: 12, padding: 8 },
  cancelBtnText: { color: "#888", fontSize: 13 },

  // Countdown
  countdownBox: { alignItems: "center", paddingVertical: 40 },
  countdownText: {
    color: "#fbbf24",
    fontSize: 96,
    fontWeight: "900",
  },
  countdownSub: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 8,
    letterSpacing: 3,
  },

  // Fighting
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  timerText: {
    color: "#fbbf24",
    fontSize: 32,
    fontWeight: "900",
  },
  tapZone: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 20,
  },
  titanOrbBox: {
    width: 160,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
  },
  titanOrb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 3,
    borderColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 16,
  },
  statBox: { alignItems: "center" },
  statLabel: {
    color: "#888",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  statValue: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
  },
  statValueDmg: {
    color: "#ef4444",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
  },

  // Done
  submittingText: { color: "#888", fontSize: 16, marginTop: 20 },
  resultTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 16,
    marginBottom: 20,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  resultLabel: { color: "#888", fontSize: 13 },
  resultValue: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  doneBtn: {
    backgroundColor: "#7e22ce",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
    marginTop: 24,
  },
  doneBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  
  // Boss Images
  bossImage: {
    width: 120,
    height: 120,
    resizeMode: "contain",
    marginTop: 10,
  },
  bossImageFight: {
    width: 130,
    height: 130,
    resizeMode: "contain",
  },
});
