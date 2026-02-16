import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import questsDef from "../../assets/config/quests.json";
import WEEKLY_REWARDS from "../../assets/config/weeklyRewards.json";
import { fmt } from "../../game/damage";

export default function DailyQuestsModal({ visible, onClose, dailyQuest, onClaim, onReroll, onClaimWeekly, mineralsDps }) {
    const [currentTime, setCurrentTime] = useState(Date.now());

    // Update Timer
    useEffect(() => {
        if (!visible) return;
        const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [visible]);

    // Calculate Time Left until next Reset (Midnight Local)
    const getResetTime = () => {
        const now = new Date(currentTime);
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const diff = tomorrow.getTime() - now.getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        return `${h}h ${m}m ${s}s`;
    };

    // Use currentTime to trigger re-render, but calculate fresh diff
    const timeDisplay = getResetTime(); // Called every render (triggered by currentTime state change)

    if (!dailyQuest) return null;

    const { activeQuests, weeklyProgress, weeklyClaimed } = dailyQuest;
    const weeklyTarget = 15;
    const weeklyPct = Math.min(1, weeklyProgress / weeklyTarget);
    const weekReward = WEEKLY_REWARDS[(dailyQuest.weekNumber || 0) % WEEKLY_REWARDS.length];

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>DAILY MISSIONS</Text>
                            <Text style={styles.subtitle}>Resets in: <Text style={{color:'#fbbf24'}}>{timeDisplay}</Text></Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <MaterialCommunityIcons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Weekly Progress */}
                    <View style={styles.weeklyBox}>
                        <View style={styles.weeklyHeader}>
                             <Text style={styles.weeklyTitle}>{weekReward.title}</Text>
                             <Text style={styles.weeklyCount}>{weeklyProgress} / {weeklyTarget}</Text>
                        </View>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${weeklyPct * 100}%`, backgroundColor: weekReward.color }]} />
                        </View>
                        
                        {weeklyProgress >= weeklyTarget && !weeklyClaimed ? (
                             <TouchableOpacity style={[styles.claimWeeklyBtn, { backgroundColor: weekReward.color }]} onPress={onClaimWeekly}>
                                 <MaterialCommunityIcons name={weekReward.icon} size={24} color="#fff" />
                                 <Text style={styles.claimWeeklyTxt}>OPEN {weekReward.title.toUpperCase()}</Text>
                             </TouchableOpacity>
                        ) : (
                             <View style={styles.chestPreview}>
                                 <MaterialCommunityIcons 
                                    name={weeklyClaimed ? "treasure-chest-open" : weekReward.icon} 
                                    size={40} 
                                    color={weeklyClaimed ? "#6b7280" : weekReward.color} 
                                 />
                                 <View style={{flex: 1}}>
                                     {weeklyClaimed ? (
                                         <Text style={styles.chestLabel}>Claimed ✓</Text>
                                     ) : (
                                         weekReward.rewards.map((r, i) => (
                                             <Text key={i} style={[styles.chestLabel, {color: weekReward.color}]}>• {r.label}</Text>
                                         ))
                                     )}
                                 </View>
                             </View>
                        )}
                    </View>

                    <ScrollView style={{maxHeight: 400}}>
                        {activeQuests.map((quest, index) => (
                            <QuestItem 
                                key={index} 
                                quest={quest} 
                                index={index}
                                onClaim={onClaim}
                                onReroll={onReroll}
                                mineralsDps={mineralsDps}
                            />
                        ))}
                    </ScrollView>

                </View>
            </View>
        </Modal>
    );
}

function QuestItem({ quest, index, onClaim, onReroll, mineralsDps }) {
    const isCompleted = quest.progress >= quest.target;
    // Calculate Reward Value for Display
    let rewardText = "";
    if (quest.rewardType === "shards") rewardText = `${quest.baseReward} Shards`;
    else if (quest.rewardType === "fragments") rewardText = `${quest.baseReward} Fragment`;
    else if (quest.rewardType === "minerals_minute") {
        // Estimate
        rewardText = `${quest.baseReward}m Minerals`;
    } else if (quest.rewardType === "minerals_hour") {
        rewardText = `${quest.baseReward}h Minerals`;
    }

    // Lookup definition if description missing (Backwards Compat)
    let desc = quest.description;
    let icon = quest.icon;
    
    if (!desc) {
        const def = questsDef.find(q => q.id === quest.id);
        if (def) {
            desc = def.description;
            icon = def.icon;
        } else {
            desc = "Unknown Mission";
        }
    }

    return (
        <View style={[styles.questRow, quest.claimed && styles.questRowDone]}>
            {/* Icon */}
            <View style={[styles.iconBox, quest.claimed && {backgroundColor:'#374151'}]}>
                <MaterialCommunityIcons name={icon || "star"} size={24} color={quest.claimed ? "#9ca3af" : "#fbbf24"} />
            </View>

            {/* Content */}
            <View style={{flex: 1}}>
                <Text style={[styles.qDesc, quest.claimed && {color:'#6b7280', textDecorationLine: 'line-through'}]}>
                    {desc.replace("{target}", fmt(quest.target))}
                </Text>
                
                {!quest.claimed && (
                    <View style={styles.qProgressBg}>
                        <View style={[styles.qProgressFill, { width: `${Math.min(1, quest.progress / quest.target) * 100}%` }]} />
                        <Text style={styles.qProgressTxt}>{fmt(quest.progress)} / {fmt(quest.target)}</Text>
                    </View>
                )}
                
                <View style={{flexDirection:'row', alignItems:'center', marginTop: 4}}>
                    <MaterialCommunityIcons name="gift" size={14} color="#10b981" />
                    <Text style={[styles.qReward, quest.claimed && {color:'#6b7280'}]}>{rewardText}</Text>
                </View>
            </View>

            {/* Action */}
            <View>
                {quest.claimed ? (
                    <MaterialCommunityIcons name="check-circle" size={32} color="#10b981" />
                ) : isCompleted ? (
                    <View style={{gap: 6}}>
                         <TouchableOpacity style={styles.claimBtn} onPress={() => onClaim(index, false)}>
                             <Text style={styles.claimTxt}>CLAIM</Text>
                         </TouchableOpacity>
                         
                         {/* 2x Ad Option */}
                         <TouchableOpacity style={styles.adBtn} onPress={() => onClaim(index, true)}>
                             <MaterialCommunityIcons name="video" size={16} color="#000" />
                             <Text style={styles.adTxt}>2x</Text>
                         </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity style={styles.rerollBtn} onPress={() => onReroll(index)}>
                        <MaterialCommunityIcons name="refresh" size={20} color="#9ca3af" />
                        <Text style={styles.rerollTxt}>Ad</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.8)",
        justifyContent: "center",
        alignItems: "center",
        padding: 16
    },
    card: {
        width: "100%",
        maxWidth: 400,
        backgroundColor: "#1f2937",
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: "#374151"
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 20
    },
    title: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "900",
        letterSpacing: 1
    },
    subtitle: {
        color: "#9ca3af",
        fontSize: 13,
        marginTop: 4
    },
    closeBtn: {
        padding: 8,
        backgroundColor: "#374151",
        borderRadius: 20
    },
    weeklyBox: {
        backgroundColor: "#111827",
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#374151"
    },
    weeklyHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8
    },
    weeklyTitle: { color: "#fbbf24", fontWeight: "bold", fontSize: 13 },
    weeklyCount: { color: "#fff", fontSize: 13, fontWeight: 'bold' },
    progressBarBg: {
        height: 8,
        backgroundColor: "#374151",
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: 12
    },
    progressBarFill: {
        height: "100%",
        backgroundColor: "#fbbf24",
    },
    chestPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        opacity: 0.9
    },
    chestLabel: { color: "#d1d5db", fontSize: 12 },
    claimWeeklyBtn: {
        backgroundColor: "#fbbf24",
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 10,
        borderRadius: 8
    },
    claimWeeklyTxt: { color: "#000", fontWeight: "bold", fontSize: 13 },
    
    // Quest Row
    questRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#27303f", // slightly lighter
        padding: 12,
        borderRadius: 12,
        marginBottom: 10,
        gap: 12
    },
    questRowDone: {
        opacity: 0.6,
        backgroundColor: "#1f2937"
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: "#374151",
        alignItems: "center",
        justifyContent: "center"
    },
    qDesc: { color: "#fff", fontSize: 14, fontWeight: "600", marginBottom: 6 },
    qProgressBg: {
        height: 14,
        backgroundColor: "#111827",
        borderRadius: 7,
        overflow: "hidden",
        justifyContent: 'center'
    },
    qProgressFill: {
        position: 'absolute',
        left: 0, 
        top: 0, 
        bottom: 0,
        backgroundColor: "#3b82f6"
    },
    qProgressTxt: {
        color: "#fff",
        fontSize: 9,
        fontWeight: "bold",
        textAlign: 'center',
        zIndex: 1
    },
    qReward: { color: "#34d399", fontSize: 12, fontWeight: "bold", marginLeft: 4 },
    
    claimBtn: {
        backgroundColor: "#3b82f6",
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        minWidth: 70
    },
    claimTxt: { color: "#fff", fontWeight: "bold", fontSize: 12 },
    adBtn: {
        backgroundColor: "#f59e0b",
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8
    },
    adTxt: { color: "#000", fontWeight: "bold", fontSize: 12 },
    rerollBtn: {
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center'
    },
    rerollTxt: { color: "#9ca3af", fontSize: 10, marginTop: 2 }
});
