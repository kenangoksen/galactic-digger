import { useEffect, useState } from "react";
import {
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { fmt } from "../../game/damage";
import { STAT_CATEGORIES } from "../../game/stats";

// Helper to format duration ms -> "12h 30m 10s"
function fmtTime(ms) {
    if (!ms || ms < 0) return "0s";
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);

    if (d > 0) return `${d}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m ${s % 60}s`;
}

// Helper to format general values
function fmtVal(key, val) {
    if (key.toLowerCase().includes("time")) return fmtTime(val);
    if (typeof val === "string") {
        // Assume BN string if it looks like a number
        if (!isNaN(parseFloat(val))) return fmt(val);
        return val;
    }
    if (typeof val === "number") {
        if (key.includes("total") || key.includes("highest")) return fmt(val);
        return val.toLocaleString();
    }
    return String(val);
}

const SECTION_KEYS = ["lifetime", "thisRewind", "thisSession"];

export default function StatisticsModal({ visible, stats, onClose }) {
  // Force update every 1s to show live stats
  // Force update every 1s to show live stats
  // Use a reducer to force update, as standard state might batch or optimize if value doesn't change?
  // Actually setTick(t => t+1) guarantees change.
  const [_, setTick] = useState(0);
  
  useEffect(() => {
    if (!visible) return;
    const i = setInterval(() => {
        setTick((t) => t + 1);
    }, 1000); // 1 second update
    return () => clearInterval(i);
  }, [visible]);

  // Derived "Best 12" for top grid
  const best12 = [
      { label: "Max Sector Ever", val: stats?.lifetime?.highestSector },
      { label: "Max Sector (Run)", val: stats?.thisRewind?.highestSector },
      { label: "Total Rewinds", val: stats?.lifetime?.totalRewinds },
      { label: "Play Time", val: fmtTime(stats?.lifetime?.totalTimePlayed) },
      { label: "Time (This Run)", val: fmtTime(stats?.thisRewind?.timePlayed) },
      { label: "Gold Earned", val: fmt(stats?.lifetime?.totalGoldEarned) },
      { label: "Total Taps", val: fmt(stats?.lifetime?.totalTaps) },
      { label: "Highest Tap", val: fmt(stats?.lifetime?.highestTapHit) },
      { label: "Highest DPS", val: fmt(stats?.lifetime?.highestDps) },
      { label: "Bosses Killed (Run)", val: fmt(stats?.thisRewind?.bossesKilled) },
      { label: "Fragments Earned", val: fmt(stats?.lifetime?.totalStellarFragmentsEarned) },
      { label: "Best Fragment Run", val: fmt(stats?.lifetime?.biggestSfGainOneRewind) },
  ];

  if (!stats) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>STATISTICS</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeText}>CLOSE</Text>
              </TouchableOpacity>
              {/* Force Render Dependency: {_} */}
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              
              {/* Best 12 Grid */}
              <View style={styles.grid}>
                {best12.map((item, idx) => (
                  <View key={idx} style={styles.gridItem}>
                     <Text style={styles.gridLabel}>{item.label}</Text>
                     <Text style={styles.gridVal}>{item.val}</Text>
                  </View>
                ))}
              </View>

              {/* Sections */}
              {SECTION_KEYS.map((secKey) => (
                <View key={`${secKey}_${_}`} style={styles.section}>
                  <Text style={styles.secTitle}>
                    {STAT_CATEGORIES[secKey === "lifetime" ? "LIFETIME" : secKey === "thisRewind" ? "REWIND" : "SESSION"]}
                  </Text>
                  {Object.entries(stats[secKey] || {}).map(([k, v]) => {
                      // Skip internal keys or nulls, but allow strings/numbers
                      if (v === null || v === undefined) return null;
                      if (typeof v === 'object' && v !== null) return null; // Keep filtering objects for now, as stats should be primitive strings/numbers
                      if (k === 'startTime' || k === 'firstPlayDate' || k === 'lastPlayDate') {
                          return (
                              <View key={k} style={styles.row}>
                                  <Text style={styles.rowLabel}>{k.replace(/([A-Z])/g, ' $1').trim()}</Text>
                                  <Text style={styles.rowVal}>{new Date(v).toLocaleDateString()}</Text>
                              </View>
                          )
                      }
                      
                      return (
                        <View key={k} style={styles.row}>
                            <Text style={styles.rowLabel}>
                                {k.replace(/([A-Z])/g, ' $1').replace(/^total /, '').trim()}
                            </Text>
                            <Text style={styles.rowVal}>{fmtVal(k, v)}</Text>
                        </View>
                      );
                  })}
                </View>
              ))}

            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)" },
  safeArea: { flex: 1 },
  container: { flex: 1, backgroundColor: "#121214", borderRadius: 16, overflow: "hidden", margin: 10, borderWidth: 1, borderColor: "#333" },
  header: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    backgroundColor: "#1a1a1e",
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 1 },
  closeBtn: { padding: 8, backgroundColor: "#333", borderRadius: 8 },
  closeText: { color: "#fff", fontWeight: "bold", fontSize: 12 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  gridItem: {
    width: "31%",
    backgroundColor: "#222",
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  gridLabel: { color: "#888", fontSize: 10, textAlign: "center", marginBottom: 4 },
  gridVal: { color: "#4dffb5", fontSize: 13, fontWeight: "bold", textAlign: "center" },

  section: { marginBottom: 24 },
  secTitle: { color: "#ffa500", fontSize: 16, fontWeight: "900", marginBottom: 12, textTransform: "uppercase" },
  
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6, borderBottomWidth: 1, borderBottomColor: "#1f1f1f", paddingBottom: 4 },
  rowLabel: { color: "#ccc", fontSize: 14, textTransform: "capitalize" },
  rowVal: { color: "#fff", fontSize: 14, fontWeight: "bold" },
});
