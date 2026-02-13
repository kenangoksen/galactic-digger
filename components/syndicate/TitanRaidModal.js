// components/syndicate/TitanRaidModal.js
// Immersive 30-second Void Titan raid battle

import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    Easing,
    Image,
    ImageBackground,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    Vibration,
    View
} from "react-native";
import {
    RAID_DURATION_MS,
    calculateRaidTapDamage,
    getDailyWeakness,
} from "../../game/syndicate/raidService";

// Assets
const BOSS_BG = require("../../assets/images/sprites/boss_bg/backgrounds.png");
const BOSS_IMAGES = [
    require("../../assets/images/sprites/boss_planet/boss_01.png"),
    require("../../assets/images/sprites/boss_planet/boss_02.png"),
    require("../../assets/images/sprites/boss_planet/boss_03.png"),
    require("../../assets/images/sprites/boss_planet/boss_04.png"),
];

const { width, height } = Dimensions.get("window");
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
  
  // Floating Damage Text
  const [damageTexts, setDamageTexts] = useState([]); // { id, x, y, val }
  const nextId = useRef(0);

  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const timerRef = useRef(null);
  const tapCountRef = useRef(0);
  const endTimeRef = useRef(0);

  // Determine current boss sprite based on level (deterministic)
  const level = syn.todaysRaid?.titanLevel || 1;
  const bossSprite = BOSS_IMAGES[(level - 1) % BOSS_IMAGES.length];
  
  // Calculate specific values
  // FIX: Use the raid's stored weakness if available, otherwise fallback to daily calc.
  // This prevents mismatch if client time crossed midnight but raid key (UTC) didn't.
  const weakness = syn.todaysRaid?.titanWeakness || getDailyWeakness();
  const damagePerTap = syn.userProfile
    ? calculateRaidTapDamage(syn.userProfile, weakness)
    : 0;
    
  // HP Calculation
  const maxHp = syn.todaysRaid?.titanHp || 1000;
  // We don't have real-time HP updates from server during fight, 
  // so we simulate local damage.
  const [currentHp, setCurrentHp] = useState(maxHp);

  // Reset on open
  useEffect(() => {
    if (visible) {
      setPhase("ready");
      setCountdown(COUNTDOWN_SECS);
      setTimeLeft(RAID_DURATION_MS / 1000);
      setTapCount(0);
      setResult(null);
      setSubmitting(false);
      setDamageTexts([]);
      tapCountRef.current = 0;
      setCurrentHp(maxHp);
    }
    return () => { 
        if (timerRef.current) clearInterval(timerRef.current); 
    };
  }, [visible, maxHp]);

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
    // Background-safe Timer Logic
    const now = Date.now();
    endTimeRef.current = now + RAID_DURATION_MS;
    
    setTimeLeft(RAID_DURATION_MS / 1000);

    timerRef.current = setInterval(() => {
      const remainingMs = endTimeRef.current - Date.now();
      const seconds = Math.ceil(remainingMs / 1000);
      
      if (seconds <= 0) {
        setTimeLeft(0);
        clearInterval(timerRef.current);
        endFight();
      } else {
        setTimeLeft(seconds);
      }
    }, 200); // Check more frequently to prevent skips
  }, []);

  // ─── End Fight ───
  const endFight = useCallback(async () => {
    setPhase("done");
    if (timerRef.current) clearInterval(timerRef.current); // Ensure timer stops if called early
    
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
  const handleTap = useCallback((evt) => {
    if (phase !== "fighting") return;

    // Get tap coordinates
    const { locationX, locationY } = evt.nativeEvent;

    tapCountRef.current++;
    setTapCount(tapCountRef.current);
    
    // Floating Text
    const id = nextId.current++;
    // Add randomness to position
    const randomX = (Math.random() - 0.5) * 40;
    const randomY = (Math.random() - 0.5) * 40;
    
    const newText = { 
        id, 
        val: damagePerTap, 
        x: locationX + randomX, 
        y: locationY + randomY 
    };
    
    setDamageTexts(prev => {
        // Keep max 15 items to prevent lag
        const next = [...prev, newText];
        if (next.length > 15) return next.slice(next.length - 15);
        return next;
    });

    // Local HP update
    setCurrentHp(prev => {
        const next = Math.max(0, prev - damagePerTap);
        if (next <= 0) {
            // EARLY VICTORY!
            endFight();
        }
        return next;
    });

    // Vibration/Haptics
    try { Vibration.vibrate(5); } catch {}

    // Tap animation
    scaleAnim.setValue(0.95);
    Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1))
    }).start();

    // Shake effect
    shakeAnim.setValue(5);
    Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start();
    
  }, [phase, scaleAnim, shakeAnim, damagePerTap, endFight]);

  // Cleanup damage text
  const removeDamageText = useCallback((id) => {
      setDamageTexts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (!visible) return null;

  // HP Percent for Bar
  const hpPercent = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;

  return (
    <Modal visible animationType="slide" transparent={false}>
      <ImageBackground source={BOSS_BG} style={s.bg} resizeMode="cover">
        {/* Dark Overlay */}
        <View style={s.overlay} />

        <View style={[s.container, { paddingTop: 60 }]}>
            
          {/* ═══ HEADS UP DISPLAY ═══ */}
          <View style={s.hud}>
            {/* HP BAR */}
            <View style={s.hpBarContainer}>
                <View style={s.hpInfo}>
                    <Text style={s.bossName}>VOID TITAN (Lvl {level})</Text>
                    <Text style={s.hpText}>{formatDmg(currentHp)} / {formatDmg(maxHp)}</Text>
                </View>
                <View style={s.hpTrack}>
                    <Animated.View style={[s.hpFill, { width: `${hpPercent}%` }]} />
                </View>
            </View>
            
            {/* TIMER & TAPS */}
            <View style={s.statsRow}>
                <View style={s.statBadge}>
                    <Ionicons name="time" size={16} color="#fbbf24" />
                    <Text style={[s.statText, timeLeft <= 5 && { color: "#ef4444" }]}>
                        {timeLeft}s
                    </Text>
                </View>
                
                <View style={s.statBadge}>
                    <Ionicons name="flash" size={16} color="#ef4444" />
                    <Text style={s.statText}>{formatDmg(damagePerTap)} / tap</Text>
                </View>
            </View>
          </View>

          {/* ═══ BOSS AREA ═══ */}
          <View style={s.bossArea}>
             <Pressable onPressIn={handleTap} disabled={phase !== 'fighting'} style={s.touchLayer}>
                <Animated.Image 
                    source={bossSprite} 
                    style={[
                        s.bossSprite,
                        {
                            transform: [
                                { translateX: shakeAnim },
                                { scale: scaleAnim }
                            ]
                        }
                    ]} 
                />
                
                {/* FLOATING TEXTS */}
                {damageTexts.map(t => (
                    <FloatingText 
                        key={t.id} 
                        item={t} 
                        onUnmount={() => removeDamageText(t.id)} 
                    />
                ))}
             </Pressable>
          </View>

          {/* ═══ PHASE OVERLAYS ═══ */}
          {/* READY */}
          {phase === "ready" && (
            <View style={s.phaseOverlay}>
                <Text style={s.readyTitle}>RAID READY</Text>
                <Text style={s.readySub}>Tap to start the assault!</Text>
                <Pressable style={s.bigBtn} onPress={startCountdown}>
                    <Text style={s.bigBtnText}>BEGIN BATTLE</Text>
                </Pressable>
                <Pressable style={s.textBtn} onPress={onClose}>
                    <Text style={s.textBtnText}>Stratejik Çekilme (Vazgeç)</Text>
                </Pressable>
            </View>
          )}

          {/* COUNTDOWN */}
          {phase === "countdown" && (
            <View style={s.phaseOverlay}>
                 <Text style={s.countdownText}>{countdown}</Text>
            </View>
          )}

          {/* DONE / RESULTS */}
          {phase === "done" && (
             <View style={s.phaseOverlay}>
                <View style={s.resultCard}>
                    {submitting ? (
                        <>
                            <Image source={bossSprite} style={{width: 80, height: 80, opacity: 0.5}} />
                            <Text style={s.loadingText}>Submitting Damage...</Text>
                        </>
                    ) : result ? (
                        <>
                             <View style={s.resultHeader}>
                                <Ionicons 
                                    name={result.titanDefeated ? "trophy" : "skull"} 
                                    size={40} 
                                    color={result.titanDefeated ? "#fbbf24" : "#ccc"} 
                                />
                                <Text style={s.resultTitle}>
                                    {result.titanDefeated ? "TITAN FELL!" : "TIME'S UP!"}
                                </Text>
                             </View>

                             <View style={s.resultStats}>
                                <ResultRow label="You Dealt" value={formatDmg(result.personalDamage)} color="#ef4444" />
                                <ResultRow label="Total Raid Dmg" value={`${formatDmg(result.totalDamage)} / ${formatDmg(result.titanHp)}`} />
                                <ResultRow label="Attempts Left" value={result.attemptsRemaining} />
                             </View>

                             <Pressable style={s.bigBtn} onPress={onClose}>
                                <Text style={s.bigBtnText}>VICTORY RETURN</Text>
                             </Pressable>
                        </>
                    ) : (
                        <Pressable style={s.bigBtn} onPress={onClose}>
                            <Text style={s.bigBtnText}>CLOSE</Text>
                        </Pressable>
                    )}
                </View>
             </View>
          )}

        </View>
      </ImageBackground>
    </Modal>
  );
}

// Sub-Component for individual floating text animation
function FloatingText({ item, onUnmount }) {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(anim, {
            toValue: 1,
            duration: 800, // 800ms fade out/up
            useNativeDriver: true,
            easing: Easing.out(Easing.ease)
        }).start(() => {
            onUnmount();
        });
    }, []);

    const translateY = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -100] // Move up 100px
    });

    const opacity = anim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 1, 0] // Fade out at end
    });

    const scale = anim.interpolate({
        inputRange: [0, 0.2],
        outputRange: [0.5, 1.2] // Pop in
    });

    return (
        <Animated.View 
            style={[
                s.floatingTextContainer,
                { 
                    left: "50%",
                    top: "40%",
                    marginLeft: item.x - (width * 0.4), // Adjust relative to center
                    marginTop: item.y - (width * 0.4), 
                    transform: [{ translateY }, { scale }],
                    opacity
                }
            ]}
            pointerEvents="none"
        >
            <Text style={s.floatingText}>{formatDmg(item.val)}</Text>
        </Animated.View>
    );
}

function ResultRow({ label, value, color="#fff" }) {
    return (
        <View style={s.resultRow}>
            <Text style={s.resultLabel}>{label}</Text>
            <Text style={[s.resultValue, { color }]}>{value}</Text>
        </View>
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
  bg: { flex: 1, width: "100%", height: "100%" },
  overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.6)", // Darkens the BG
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  
  // HUD
  hud: {
      width: '100%',
      gap: 16,
  },
  hpBarContainer: {
      width: '100%',
  },
  hpInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
  },
  bossName: { color: '#ef4444', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  hpText: { color: '#ccc', fontWeight: 'bold', fontSize: 14 },
  hpTrack: {
      height: 16,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
  },
  hpFill: {
      height: '100%',
      backgroundColor: '#dc2626',
  },
  statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
  },
  statBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(0,0,0,0.4)',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
  },
  statText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // Boss Area
  bossArea: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
  },
  touchLayer: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
  },
  bossSprite: {
      width: width * 0.8,
      height: width * 0.8,
      resizeMode: 'contain',
  },
  
  // Floating Text
  floatingTextContainer: {
      position: 'absolute',
      zIndex: 100,
  },
  floatingText: {
      color: '#fff',
      fontSize: 24, // Bigger
      fontWeight: '900',
      textShadowColor: 'rgba(0,0,0,0.8)',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
  },

  // Overlays
  phaseOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.4)',
      zIndex: 20,
  },
  readyTitle: {
      color: '#fff',
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: 2,
      textShadowColor: 'rgba(220, 38, 38, 0.8)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 20,
  },
  readySub: {
      color: '#ddd',
      fontSize: 16,
      marginTop: 8,
      marginBottom: 40,
  },
  countdownText: {
      color: '#fbbf24',
      fontSize: 120,
      fontWeight: '900',
      textShadowColor: 'rgba(251, 191, 36, 0.5)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 30,
  },
  
  // Results
  resultCard: {
      width: '85%',
      backgroundColor: '#111827',
      borderRadius: 24,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#374151',
      elevation: 10,
  },
  resultHeader: {
      alignItems: 'center',
      marginBottom: 20,
  },
  resultTitle: {
      color: '#fff',
      fontSize: 24,
      fontWeight: '900',
      marginTop: 8,
  },
  resultStats: {
      width: '100%',
      gap: 12,
      marginBottom: 24,
  },
  resultRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  resultLabel: { color: '#9ca3af', fontSize: 14 },
  resultValue: { fontSize: 14, fontWeight: 'bold' },
  loadingText: { color: '#aaa', marginTop: 16 },

  // Buttons
  bigBtn: {
      backgroundColor: '#dc2626',
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 12,
      width: '100%',
      alignItems: 'center',
      elevation: 4,
  },
  bigBtnText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  textBtn: {
      padding: 16,
      marginTop: 8,
  },
  textBtnText: { color: '#9ca3af', fontSize: 14 },
});
