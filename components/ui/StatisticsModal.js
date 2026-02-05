import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fmt } from "../../game/damage";

export default function StatisticsModal({ visible, onClose, stats, eco }) {
    if (!visible) return null;

    // Helper to format large numbers using existing valid formatter
    const f = (n) => fmt(n);

    // Milestones Logic
    const milestones = eco?.dpsToTapMilestonesUnlocked || {};
    const unlockedCount = Object.keys(milestones).length;
    const maxMilestones = 7;
    const ratio = Math.min(0.035, unlockedCount * 0.005);
    const protocolBonus = eco?.cosmicProtocols?.["manual_override"] ? (eco.cosmicProtocols["manual_override"] * 0.10) : 0;
    const effectiveRatio = ratio * (1 + protocolBonus);
    
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <LinearGradient colors={["#1a1d2e", "#10121b"]} style={styles.bg}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.title}>STATISTICS</Text>
                            <Pressable onPress={onClose} style={styles.closeBtn}>
                                <MaterialCommunityIcons name="close" size={24} color="#aaa" />
                            </Pressable>
                        </View>

                        <ScrollView contentContainerStyle={styles.content}>
                            
                            {/* Milestone Section */}
                            <View style={styles.section}>
                                <Text style={styles.sectionHeader}>DPS → TAP MASTERY</Text>
                                <View style={styles.statRow}>
                                    <View>
                                        <Text style={styles.statLabel}>Conversion Ratio</Text>
                                        <Text style={styles.statSub}>Base: {(ratio * 100).toFixed(1)}% | Bonus: +{(protocolBonus * 100).toFixed(0)}%</Text>
                                    </View>
                                    <Text style={styles.statValue}>{(effectiveRatio * 100).toFixed(2)}%</Text>
                                </View>
                                
                                <View style={styles.progressBarBg}>
                                    <View style={[styles.progressBarFill, { width: `${(unlockedCount / maxMilestones) * 100}%` }]} />
                                </View>
                                <Text style={styles.progressText}>{unlockedCount} / {maxMilestones} Milestones Unlocked</Text>
                            </View>

                            <View style={styles.divider} />

                            {/* General Stats */}
                            <View style={styles.section}>
                                <Text style={styles.sectionHeader}>LIFETIME</Text>
                                {stats?.lifetime && (
                                    <>
                                        <StatRow label="Trips" value={stats.lifetime.ascensions || 0} />
                                        <StatRow label="Total Taps" value={f(stats.lifetime.totalTaps || 0)} />
                                        <StatRow label="Crit Taps" value={f(stats.lifetime.totalCriticalTaps || 0)} />
                                        <StatRow label="Total Damage" value={f(stats.lifetime.totalDamage || 0)} />
                                        <StatRow label="Highest Tap" value={f(stats.lifetime.highestTapHit || 0)} />
                                        <StatRow label="Gold Spent" value={f(stats.lifetime.totalGoldSpent || 0)} />
                                    </>
                                )}
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.section}>
                                <Text style={styles.sectionHeader}>SESSION</Text>
                                {stats?.thisSession && (
                                    <>
                                        <StatRow label="Damage Dealt" value={f(stats.thisSession.damageAll || 0)} />
                                        <StatRow label="Taps" value={f(stats.thisSession.totalTaps || 0)} />
                                    </>
                                )}
                            </View>

                        </ScrollView>
                    </LinearGradient>
                </View>
            </View>
        </Modal>
    );
}

function StatRow({ label, value }) {
    return (
        <View style={styles.statRow}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", padding: 20 },
    modalContainer: { borderRadius: 16, overflow: "hidden", maxHeight: "80%", width: "100%" },
    bg: { flex: 1 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "rgba(255,255,255,0.05)" },
    title: { color: "gold", fontSize: 18, fontWeight: "bold", letterSpacing: 1 },
    closeBtn: { padding: 4 },
    content: { padding: 20 },
    section: { marginBottom: 20 },
    sectionHeader: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: "bold", marginBottom: 10, letterSpacing: 1 },
    statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    statLabel: { color: "#ccc", fontSize: 14 },
    statSub: { color: "#666", fontSize: 10 },
    statValue: { color: "#fff", fontWeight: "bold", fontSize: 14 },
    divider: { height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginBottom: 20 },
    progressBarBg: { height: 8, backgroundColor: "#333", borderRadius: 4, marginTop: 8, overflow: "hidden" },
    progressBarFill: { height: "100%", backgroundColor: "gold" },
    progressText: { color: "#888", fontSize: 10, marginTop: 4, textAlign: "right" }
});
