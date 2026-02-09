
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import achievementsDef from "../../assets/config/achievements.json";
import { D, fmtD } from "../../game/bn";

// ─── Helper: Read a nested stat value like "lifetime.totalTaps" ───
function readStat(stats, statKey) {
    const keys = statKey.split(".");
    let val = stats;
    for (const k of keys) {
        val = val?.[k];
    }
    if (val === undefined || val === null) return 0;
    if (typeof val === 'string') return D(val).toNumber();
    return Number(val);
}

// ─── Helper: Build the active achievement list (NO useMemo) ───
function buildActiveList(stats, claimedIds) {
    // 1. Map all achievements to their current state
    const allMapped = achievementsDef.map(ach => {
        const currentVal = readStat(stats, ach.statKey);
        const isCompleted = currentVal >= ach.threshold;
        const isClaimed = claimedIds.includes(ach.id);
        const progress = Math.min(currentVal / ach.threshold, 1);

        return {
            ...ach,
            currentVal,
            isCompleted,
            isClaimed,
            progress
        };
    });

    // 2. Group by Series and find the "Active" one
    const groups = {};
    allMapped.forEach(item => {
        if (!item.series) return;
        if (!groups[item.series]) groups[item.series] = [];
        groups[item.series].push(item);
    });

    const activeList = [];
    
    Object.values(groups).forEach(group => {
        group.sort((a, b) => a.order - b.order);
        
        const firstUnclaimed = group.find(x => !x.isClaimed);
        if (firstUnclaimed) {
            activeList.push(firstUnclaimed);
        } else {
            if (group.length > 0) {
                activeList.push(group[group.length - 1]);
            }
        }
    });

    return activeList;
}

export default function AchievementsModal({ visible, onClose, engine }) {
    const [filter, setFilter] = useState("ALL");

    // ─── 🔄 Force re-render every 500ms when visible ───
    const [tick, setTick] = useState(0);
    useEffect(() => {
        if (!visible) return;
        const interval = setInterval(() => setTick(t => t + 1), 500);
        return () => clearInterval(interval);
    }, [visible]);

    // ─── FRESH data on every render (NO useMemo — intentional) ───
    // getStats() returns statsRef.current which is mutated in place.
    // We MUST read it fresh every render, not cache it.
    const freshStats = engine.getStats ? engine.getStats() : (engine.stats || {});
    const claimedIds = engine.claimedAchievements || [];

    // Force tick to be "used" so React doesn't optimize away the re-render
    void tick;

    // Build list on every render (cheap: ~30 items, simple math)
    const list = buildActiveList(freshStats, claimedIds);

    // Filter
    let filteredList;
    switch (filter) {
        case "COMPLETED": filteredList = list.filter(a => a.isCompleted && a.isClaimed); break;
        case "PENDING": filteredList = list.filter(a => !a.isClaimed); break;
        default: filteredList = list; break;
    }

    // Handler
    const handleClaim = useCallback((item) => {
        Alert.alert("Claiming...", `Reward: ${item.reward} Shards`);
        
        if (!engine.dispatchEco) {
            Alert.alert("Error", "Game Engine connection failed.");
            return;
        }

        if (item.isCompleted && !item.isClaimed) {
            engine.dispatchEco({ type: "CLAIM_ACHIEVEMENT", id: item.id, reward: item.reward });
        } 
    }, [engine]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* HEADER */}
                    <View style={styles.header}>
                        <View style={{flexDirection:'row', alignItems:'center', gap: 8}}>
                            <MaterialCommunityIcons name="trophy-award" size={24} color="#fbbf24" />
                            <Text style={styles.title}>ACHIEVEMENTS</Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </Pressable>
                    </View>

                    {/* TABS */}
                    <View style={styles.tabs}>
                        {["ALL", "PENDING", "COMPLETED"].map(f => (
                            <Pressable 
                                key={f} 
                                style={[styles.tab, filter === f && styles.activeTab]}
                                onPress={() => setFilter(f)}
                            >
                                <Text style={[styles.tabText, filter === f && styles.activeTabText]}>
                                    {f}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* LIST */}
                    <FlatList
                        data={filteredList}
                        keyExtractor={item => item.id}
                        extraData={tick}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => (
                            <View style={[styles.card, item.isClaimed && styles.cardClaimed]}>
                                <View style={styles.cardHeader}>
                                    <View>
                                        <Text style={[styles.cardTitle, item.isClaimed && {color: '#64748b'}]}>
                                            {item.title}
                                        </Text>
                                        <Text style={{color:'#64748b', fontSize:10, fontWeight:'bold'}}>
                                            STAGE {item.order}
                                        </Text>
                                    </View>
                                    <View style={styles.rewardBadge}>
                                        <MaterialCommunityIcons name="diamond-stone" size={12} color="#a78bfa" />
                                        <Text style={styles.rewardText}>{item.reward}</Text>
                                    </View>
                                </View>
                                
                                <Text style={styles.cardDesc}>{item.description}</Text>

                                {/* Progress Bar */}
                                <View style={styles.progressContainer}>
                                    <View style={[styles.progressFill, { width: `${item.progress * 100}%` }, item.isCompleted && {backgroundColor: '#4ade80'}]} />
                                    <Text style={styles.progressText}>
                                        {fmtD(item.currentVal)} / {fmtD(item.threshold)}
                                    </Text>
                                </View>

                                {/* Action */}
                                <View style={{alignItems: 'flex-end', marginTop: 8}}>
                                    {item.isClaimed ? (
                                        <View style={{flexDirection:'row', alignItems:'center', gap:4}}>
                                            <MaterialCommunityIcons name="check" size={16} color="#64748b" />
                                            <Text style={{color:'#64748b', fontSize:12, fontWeight:'bold'}}>CLAIMED</Text>
                                        </View>
                                    ) : item.isCompleted ? (
                                        <TouchableOpacity 
                                            style={styles.claimBtn}
                                            onPress={() => handleClaim(item)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.claimBtnText}>CLAIM REWARD</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <Text style={{color:'#475569', fontSize:11, fontStyle:'italic'}}>In Progress</Text>
                                    )}
                                </View>
                            </View>
                        )}
                    />
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
        padding: 16,
    },
    container: {
        width: "100%",
        height: "80%",
        backgroundColor: "#0f172a",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#fbbf24",
        padding: 16,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    title: {
        color: "#fbbf24",
        fontSize: 20,
        fontWeight: "bold",
        letterSpacing: 1,
    },
    closeBtn: {
        padding: 4,
    },
    tabs: {
        flexDirection: 'row',
        marginBottom: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        padding: 4,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: 6,
    },
    activeTab: {
        backgroundColor: '#334155',
    },
    tabText: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: 'bold',
    },
    activeTabText: {
        color: '#fff',
    },
    listContent: {
        gap: 12,
        paddingBottom: 20,
    },
    card: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    cardClaimed: {
        opacity: 0.6,
        borderColor: 'transparent',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    cardTitle: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    rewardBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(167, 139, 250, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.3)',
    },
    rewardText: {
        color: '#a78bfa',
        fontSize: 11,
        fontWeight: 'bold',
    },
    cardDesc: {
        color: '#cbd5e1',
        fontSize: 12,
        marginBottom: 12,
    },
    progressContainer: {
        height: 16,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#fbbf24',
        borderRadius: 8,
    },
    progressText: {
        position: 'absolute',
        width: '100%',
        textAlign: 'center',
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        lineHeight: 16,
        textShadowColor: 'rgba(0,0,0,1)',
        textShadowRadius: 2,
    },
    claimBtn: {
        backgroundColor: '#22c55e',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    claimBtnText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
    },
});
