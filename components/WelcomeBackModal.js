import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { fmtD } from "../game/bn";

export default function WelcomeBackModal({
  visible,
  earnings, // BigNumber
  seconds, // number
  onCollect, // (multiplier) => void
  onClose,
}) {
  const [adLoading, setAdLoading] = useState(false);

  if (!visible) return null;

  // Format time (HH:MM:SS)
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const timeStr =
    hours > 0 ? `${hours}h ${mins}m` : `${mins}m ${seconds % 60}s`;

  const handleAdWatch = () => {
    setAdLoading(true);
    // MOCK AD: 1.5s delay
    setTimeout(() => {
      setAdLoading(false);
      onCollect(2);
    }, 1500);
  };

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LinearGradient
            colors={["#1e293b", "#0f172a"]}
            style={styles.cardGradient}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>WELCOME BACK</Text>
              <Text style={styles.subtitle}>OFFLINE REPORT</Text>
            </View>

            <View style={styles.body}>
              <Text style={styles.desc}>
                Your miners worked hard while you were away!
              </Text>

              <View style={styles.statBox}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Time Away</Text>
                  <Text style={styles.statValue}>{timeStr}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Minerals Mined</Text>
                  <View style={styles.mineralRow}>
                    <MaterialCommunityIcons
                      name="diamond-stone"
                      size={16}
                      color="#4dc0ff"
                    />
                    <Text style={styles.mineralValue}>{fmtD(earnings)}</Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                {/* 1. Normal Collect */}
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnNormal,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={() => onCollect(1)}
                >
                  <Text style={styles.btnTitle}>COLLECT</Text>
                  <Text style={styles.btnSub}>Free</Text>
                </Pressable>

                {/* 2. AD 2x (MOCK) */}
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnAd,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={handleAdWatch}
                  disabled={adLoading}
                >
                  <LinearGradient
                    colors={["#2563eb", "#1d4ed8"]}
                    style={StyleSheet.absoluteFill}
                  />
                  {adLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.btnTitle}>2X BOOST</Text>
                      <View style={styles.row}>
                        <MaterialCommunityIcons
                          name="play-circle"
                          size={14}
                          color="#fff"
                        />
                        <Text style={styles.btnSubWhite}> Watch Ad</Text>
                      </View>
                    </>
                  )}
                </Pressable>

                {/* 3. GEM 3x (MOCK) */}
                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnGem,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={() => onCollect(3)}
                >
                  <LinearGradient
                    colors={["#db2777", "#be185d"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={styles.btnTitle}>3X BOOST</Text>
                  <View style={styles.row}>
                    <MaterialCommunityIcons
                      name="diamond"
                      size={14}
                      color="#fff"
                    />
                    <Text style={styles.btnSubWhite}> 50 Gems</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(77, 192, 255, 0.3)",
    elevation: 20,
    shadowColor: "#4dc0ff",
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  cardGradient: {
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1,
  },
  subtitle: {
    color: "#4dc0ff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    marginTop: 4,
    opacity: 0.8,
  },
  body: {
    gap: 16,
  },
  desc: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    fontSize: 14,
    marginBottom: 8,
  },
  statBox: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 8,
  },
  statLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "600",
  },
  statValue: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  mineralRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  mineralValue: {
    color: "#4dc0ff",
    fontSize: 18,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    height: 64,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden", // for gradient absolute fill
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  btnNormal: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  btnAd: {
    // Gradient managed inside
  },
  btnGem: {
    // Gradient managed inside
  },
  btnTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 2,
  },
  btnSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "600",
  },
  btnSubWhite: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
});
