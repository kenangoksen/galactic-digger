
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { fmt } from "../../game/damage";

export default function TimeWarpResultModal({ visible, result, onClose }) {
  if (!visible || !result) return null;

  const { gainedGold, gainedZones, gainedFragments } = result;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={["#1e1b4b", "#312e81"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bg}
          >
            <View style={styles.header}>
              <MaterialCommunityIcons name="clock-fast" size={48} color="#60a5fa" />
              <Text style={styles.title}>TIME WARP COMPLETE</Text>
            </View>

            <View style={styles.content}>
              
              {/* ZONES */}
              {gainedZones > 0 && (
                <View style={styles.row}>
                  <Text style={styles.label}>Zones Advanced</Text>
                  <Text style={[styles.value, { color: "#4ade80" }]}>+{gainedZones}</Text>
                </View>
              )}

              {/* GOLD */}
              <View style={styles.row}>
                <Text style={styles.label}>Minerals Gained</Text>
                <Text style={[styles.value, { color: "#facc15" }]}>+{fmt(gainedGold)}</Text>
              </View>

              {/* FRAGMENTS (Conditional) */}
              {gainedFragments > 0 && (
                <View style={styles.row}>
                  <Text style={styles.label}>Fragments Found</Text>
                  <Text style={[styles.value, { color: "#e879f9" }]}>+{fmt(gainedFragments)}</Text>
                </View>
              )}

            </View>

            <Pressable onPress={onClose} style={styles.btn}>
                <LinearGradient
                    colors={["#3b82f6", "#2563eb"]}
                    style={styles.btnGradient}
                >
                    <Text style={styles.btnText}>AWESOME</Text>
                </LinearGradient>
            </Pressable>

          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.5)",
    elevation: 20,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  bg: {
    padding: 24,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    gap: 12,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
    textShadowColor: "rgba(59, 130, 246, 0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  content: {
    width: "100%",
    gap: 16,
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  label: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "600",
  },
  value: {
    fontSize: 18,
    fontWeight: "800",
  },
  btn: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    elevation: 4,
  },
  btnGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
