import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { fmt } from "../../game/damage";

export default function BigBangModal({
  visible,
  onClose,
  onConfirm,
  gainedEssence,
  highestZone,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <LinearGradient
          colors={["#450a0a", "#1a0505"]} // Deep Red
          style={styles.modalContent}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <Ionicons name="planet" size={32} color="#f87171" />
            <Text style={styles.title}>BIG BANG</Text>
          </View>

          <Text style={styles.desc}>
            The current universe is collapsing. Initiate a Big Bang to condense your knowledge into <Text style={styles.highlight}>Cosmic Essence</Text>.
          </Text>

          {/* STATS */}
          <View style={styles.statsContainer}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Max Zone Reached:</Text>
              <Text style={styles.statValue}>{highestZone}</Text>
            </View>
            
            <View style={styles.divider} />

            <View style={styles.rewardContainer}>
              <Text style={styles.rewardLabel}>COSMIC ESSENCE GAIN</Text>
              <Text style={styles.rewardValue}>+{fmt(gainedEssence)}</Text>
            </View>
          </View>

          {/* WARNING GRID */}
          <View style={styles.warningGrid}>
             <View style={styles.warnCol}>
                 <Text style={[styles.warnHeader, {color: '#ef4444'}]}>YOU LOSE</Text>
                 <Text style={styles.warnItem}>• Minerals & Miners</Text>
                 <Text style={styles.warnItem}>• Zone Progress</Text>
             </View>
             <View style={styles.warnCol}>
                 <Text style={[styles.warnHeader, {color: '#22c55e'}]}>YOU KEEP</Text>
                 <Text style={styles.warnItem}>• Stellar Fragments</Text>
                 <Text style={styles.warnItem}>• Cosmic Protocols</Text>
                 <Text style={styles.warnItem}>• Starlink Tags</Text>
             </View>
          </View>

          {/* ACTIONS */}
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </Pressable>

            <Pressable style={styles.confirmBtn} onPress={onConfirm}>
              <LinearGradient
                 colors={["#dc2626", "#991b1b"]}
                 style={styles.confirmGradient}
              >
                <Text style={styles.confirmText}>PERFORM BIG BANG</Text>
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
    borderColor: "rgba(239, 68, 68, 0.3)",
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
    color: "#f87171",
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
    color: "#f87171",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 4,
  },
  rewardValue: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
    textShadowColor: "rgba(248, 113, 113, 0.5)",
    textShadowRadius: 8,
  },
  warningGrid: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
      marginBottom: 24,
  },
  warnCol: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.03)',
      padding: 10,
      borderRadius: 8,
  },
  warnHeader: {
      fontWeight: 'bold',
      fontSize: 11,
      marginBottom: 6,
      textAlign: 'center',
  },
  warnItem: {
      color: '#ffffff80',
      fontSize: 10,
      marginBottom: 3,
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
