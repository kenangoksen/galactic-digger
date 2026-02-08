import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fmt } from "../../game/damage";

export default function StatisticsModal({ visible, onClose, stats, eco }) {
    if (!visible) return null;

    // Helper to format large numbers
    const f = (n) => fmt(n);

    // Helper for time
    const formatTime = (ms) => {
        if (!ms) return "0s";
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        const d = Math.floor(h / 24);
        if (d > 0) return `${d}d ${h % 24}h`;
        if (h > 0) return `${h}h ${m % 60}m`;
        if (m > 0) return `${m}m ${s % 60}s`;
        return `${s}s`;
    };

    // Calculate Extended Stats
    const totalMinerLevels = stats?.lifetime?.totalMinerLevels || 0;
    const highestMinerLevel = stats?.lifetime?.highestMinerLevel || 0;
    const totalUpgrades = stats?.lifetime?.totalPurchasesCount || 0;
    
    // Session Time
    const sessionTime = stats?.thisSession?.startTime 
        ? Date.now() - stats.thisSession.startTime 
        : 0;

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
                            
                            {/* 1. GENERAL */}
                            <CategorySection title="GENERAL">
                                <StatRow label="Time Played Since First Click" value={stats?.lifetime?.firstPlayDate ? new Date(stats.lifetime.firstPlayDate).toLocaleDateString() : "-"} />
                                <StatRow label="Total Time Played" value={formatTime(stats?.lifetime?.totalTimePlayed)} />
                                <StatRow label="Total Taps" value={f(stats?.lifetime?.totalTaps)} />
                                <StatRow label="Tap Streak Record" value={stats?.lifetime?.longestStreak || 0} />
                            </CategorySection>

                            <View style={styles.divider} />

                            {/* 2. COMBAT */}
                            <CategorySection title="COMBAT">
                                <StatRow label="Monsters Killed" value={f(stats?.lifetime?.totalMonstersKilled)} />
                                <StatRow label="Bosses Killed" value={f(stats?.lifetime?.totalBossesKilled)} />
                                <StatRow label="Critical Taps" value={f(stats?.lifetime?.totalCriticalTaps)} />
                                <StatRow label="Highest Critical Click" value={f(stats?.lifetime?.peakCriticalTapHit || 0)} />
                                <StatRow label="Highest DPS" value={f(stats?.lifetime?.highestDps || 0)} />
                            </CategorySection>

                            <View style={styles.divider} />

                            {/* 3. PROGRESSION */}
                            <CategorySection title="PROGRESSION">
                                <StatRow label="Highest Zone Ever" value={stats?.lifetime?.highestSector || 1} />
                                <StatRow label="Total Stellar Rewinds" value={stats?.lifetime?.totalRewinds || 0} />
                                <StatRow label="Total Big Bangs" value={stats?.lifetime?.totalBigBangs || 0} />
                                <StatRow label="Deepest Run Duration" value={formatTime(stats?.lifetime?.longestRewindDuration)} />
                            </CategorySection>

                             <View style={styles.divider} />

                            {/* 4. ECONOMY */}
                            <CategorySection title="ECONOMY">
                                <StatRow label="Total Gold Earned" value={f(stats?.lifetime?.totalGoldEarned)} />
                                <StatRow label="Total Fragments Found" value={f(stats?.lifetime?.totalStellarFragmentsEarned)} />
                            </CategorySection>
                            
                            <View style={styles.divider} />

                            {/* 5. MINERS & UPGRADES (User Request) */}
                            <CategorySection title="MINERS & UPGRADES">
                                <StatRow label="Total Miner Levels" value={f(totalMinerLevels)} />
                                <StatRow label="Highest Miner Level" value={f(highestMinerLevel)} />
                                <StatRow label="Upgrades Purchased" value={f(totalUpgrades)} />
                                <StatRow label="Miners Unlocked" value={stats?.lifetime?.totalMinersUnlocked || 0} />
                            </CategorySection>

                            <View style={styles.divider} />

                            {/* 6. THIS REWIND */}
                            <CategorySection title="THIS REWIND">
                                <StatRow label="Zone Reached" value={stats?.thisRewind?.highestSector || 1} />
                                <StatRow label="Gold Earned" value={f(stats?.thisRewind?.goldEarned)} />
                                <StatRow label="Time Played" value={formatTime(stats?.thisRewind?.timePlayed)} />
                                <StatRow label="Bosses Killed" value={stats?.thisRewind?.bossesKilled || 0} />
                            </CategorySection>

                        </ScrollView>
                    </LinearGradient>
                </View>
            </View>
        </Modal>
    );
}

function CategorySection({ title, children }) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionHeader}>{title}</Text>
            {children}
        </View>
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
    modalContainer: { borderRadius: 16, overflow: "hidden", height: "85%", width: "100%" }, // Increased height
    bg: { flex: 1 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "rgba(255,255,255,0.05)" },
    title: { color: "gold", fontSize: 18, fontWeight: "bold", letterSpacing: 1 },
    closeBtn: { padding: 4 },
    content: { padding: 20, paddingBottom: 40 },
    section: { marginBottom: 16 },
    sectionHeader: { color: "gold", fontSize: 14, fontWeight: "800", marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.9 },
    statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }, // Tighter spacing
    statLabel: { color: "#ccc", fontSize: 13, fontWeight: "500" },
    statValue: { color: "#fff", fontWeight: "bold", fontSize: 13 },
    divider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 16 },
});
