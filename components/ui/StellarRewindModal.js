// components/ui/StellarRewindModal.js
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { fmt } from "../../game/damage";

export default function StellarRewindModal({
  visible,
  onClose,
  onConfirm,
  rewardAmount,
  currentZone,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <LinearGradient
          colors={["#2e1065", "#0f172a"]}
          style={styles.modalContent}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <Ionicons name="infinite" size={32} color="#a855f7" />
            <Text style={styles.title}>STELLAR REWIND</Text>
          </View>

          <Text style={styles.desc}>
            The universe has reached its limit. Only by collapsing the current timeline can we extract the precious <Text style={styles.highlight}>Stellar Fragments</Text> hidden within.
          </Text>

          {/* STATS */}
          <View style={styles.statsContainer}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Max Sector Reached:</Text>
              <Text style={styles.statValue}>{currentZone}</Text>
            </View>
            
            <View style={styles.divider} />

            <View style={styles.rewardContainer}>
              <Text style={styles.rewardLabel}>STELLAR FRAGMENTS REWARD</Text>
              <Text style={styles.rewardValue}>+{fmt(rewardAmount)}</Text>
            </View>
          </View>

          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={16} color="#fbbf24" />
            <Text style={styles.warningText}>
              Sector, Minerals, and Miners will be reset. {"\n"}
              You keep Stellar Fragments, Protocols, and Premium Items.
            </Text>
          </View>

          {/* ACTIONS */}
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </Pressable>

            <Pressable style={styles.confirmBtn} onPress={onConfirm}>
              <LinearGradient
                 colors={["#a855f7", "#7e22ce"]}
                 style={styles.confirmGradient}
              >
                <Text style={styles.confirmText}>INITIATE REWIND</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </LinearGradient>
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
  modalContent: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 1,
  },
  desc: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  highlight: {
    color: "#d8b4fe",
    fontWeight: "bold",
  },
  statsContainer: {
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
  },
  statValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 12,
  },
  rewardContainer: {
    alignItems: "center",
  },
  rewardLabel: {
    color: "#a855f7",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  rewardValue: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
    textShadowColor: "rgba(168, 85, 247, 0.5)",
    textShadowRadius: 8,
  },
  warningBox: {
    flexDirection: "row",
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  warningText: {
    flex: 1,
    color: "#fbbf24",
    fontSize: 11,
    lineHeight: 15,
  },
  actions: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  cancelText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
  },
  confirmBtn: {
    flex: 2,
    borderRadius: 14,
    overflow: "hidden",
  },
  confirmGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});
