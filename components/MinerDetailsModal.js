import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { D, fmtD } from '../game/bn';
import { getLevelingMultiplier } from '../game/damage';

// Hardcoded Flavor Texts (placeholder until config is updated)
const FLAVO_TEXTS = {
    "miner_01": "It ain't much, but it's honest work.",
    "miner_02": "Drilling through the fabric of reality, one bit at a time.",
    "miner_03": "Why poke it? TO SEE WHAT HAPPENS!",
    "miner_04": "The moon is just a big rock waiting to be mined.",
    "miner_05": "Faster than light, heavier than lead.",
    "miner_06": "Size doesn't matter when you have precision.",
    "miner_07": "Precision engineering meets brute force.",
    "miner_08": "Gotta go fast! The ore won't mine itself.",
    "miner_09": "Every tap echoes through eternity.",
    "miner_10": "Leading the charge into the unknown.",
    "miner_11": "Grinding stars into dust since 2042.",
    "miner_12": "Piercing the core of the galaxy.",
    "miner_13": "Serving up fresh minerals, hot and ready.",
    "miner_14": "Some like it hot. We like it molten.",
    "default": "A dedicated worker for the cosmic cause."
};

const SKILL_ICONS = {
    "s_clickstorm": "flash",
    "s_powersurge": "flame",
    "s_lucky": "eye",
    "s_metal": "magnet",
    "s_goldclicks": "cash",
    "s_darkritual": "skull",
    "s_superclicks": "hammer",
    "s_energize": "battery-charging",
    "s_reload": "refresh-circle",
    "dpsMultiplier": "sword-cross",
    "globalDpsMultiplier": "earth",
    "tapMultiplier": "finger-print",
    "mineralMultiplier": "diamond-stone",
    "critChance": "target",
    "critMultiplier": "nuke",
    "unlock_feature_rewind": "orbit", // ✅ Rewind Icon
    "default": "star"
};

function getSkillIconName(kind, value) {
  if (kind === "unlockActiveSkill") return SKILL_ICONS[value] || SKILL_ICONS.default;
  return SKILL_ICONS[kind] || SKILL_ICONS.default;
}

function getSkillDescription(kind, value) {
    switch(kind) {
        case 'dpsMultiplier': return `DPS +${value * 100}%`;
        case 'globalDpsMultiplier': return `Global DPS +${value * 100}%`;
        case 'tapMultiplier': return `Tap Damage +${value * 100}%`;
        case 'mineralMultiplier': return `Minerals +${value * 100}%`;
        case 'critChance': return `Crit Chance +${value * 100}%`;
        case 'critMultiplier': return `Crit Damage +${value * 100}%`;
        case 'unlockActiveSkill': return `Unlocks Active Skill`;
        default: return `Bonus Effect`;
    }
}

export default function MinerDetailsModal({
    visible,
    onClose,
    miner,
    level,
    minerals, // Current Minerals
    onBuySkill,
    purchasedSkills = {},
    tags = 0,
    currentDps, // Calculated live DPS passed from parent
}) {
    if (!miner) return null;

    const flavor = FLAVO_TEXTS[miner.id] || FLAVO_TEXTS.default;

    // Sort skills: 
    // 1. Level Requirement Ascending
    const sortedSkills = useMemo(() => {
        if (!miner.skills) return [];
        return [...miner.skills].sort((a, b) => (a.unlockAt || 0) - (b.unlockAt || 0));
    }, [miner.skills]);

    // Leveling Multiplier Info
    const lvlMult = getLevelingMultiplier(level);
    // Calculate Next 4x or 10x
    // Logic: 
    // < 200: Next at 200 (4x)
    // >= 200: 
    //   If level < 1000: Next 25 step.
    //   If level >= 1000: Next 1000 step is 10x, else next 25 step is 4x.
    // Simplifying display: "Current Bonus: X"
    
    // Tag Bonus
    const tagBonus = tags * 50; // 50% per tag hardcoded? Or use passed config? 
    // We should ideally pass `tagPower` prop or assume standard 50%.
    
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
        >
            <View style={styles.overlay}>
                {/* Dim Background */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
                
                <View style={styles.modalContainer}>
                    {/* Header: Icon + Info + Close */}
                    <LinearGradient
                        colors={['#1e293b', '#0f172a']}
                        style={styles.header}
                    >
                        <View style={styles.headerContent}>
                            <View style={styles.iconContainer}>
                                <Image 
                                    source={require('../assets/images/sprites/miners/miner_01.png')} 
                                    style={styles.icon} 
                                />
                                <View style={styles.lvlBadge}>
                                    <Text style={styles.lvlText}>{level}</Text>
                                </View>
                            </View>
                            
                            <View style={styles.headerInfo}>
                                <Text style={styles.name}>{miner.name}</Text>
                                <Text style={styles.dps}>
                                    {D(currentDps).gt(0) ? fmtD(currentDps) : "0"} DPS
                                </Text>
                            </View>
                            
                            <Pressable onPress={onClose} style={styles.closeBtn}>
                                <Ionicons name="close-circle" size={28} color="#94a3b8" />
                            </Pressable>
                        </View>

                        {/* Flavor Text Quote */}
                        <Text style={styles.flavorText}>
                            "{flavor}"
                        </Text>
                    </LinearGradient>

                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                        {tags > 0 && (
                            <View style={styles.statChip}>
                                <MaterialCommunityIcons name="star-four-points" size={14} color="#ffd700" />
                                <Text style={styles.statText}>+{tagBonus}% Gilded</Text>
                            </View>
                        )}
                        
                        {lvlMult.gt(1) && (
                            <View style={[styles.statChip, styles.statChipBlue]}>
                                <MaterialCommunityIcons name="arrow-up-bold-box" size={14} color="#60a5fa" />
                                <Text style={[styles.statText, {color: '#60a5fa'}]}>
                                    {fmtD(lvlMult)}x Level Bonus
                                </Text>
                            </View>
                        )}
                        
                         {/* Next 4x Hint */}
                         <View style={[styles.statChip, styles.statChipGray]}>
                            <Text style={[styles.statText, {color: '#94a3b8'}]}>
                                Next 4x at Lv {Math.max(200, Math.ceil((level + 1) / 25) * 25)}
                            </Text>
                        </View>
                    </View>

                    {/* Skills List Title */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>UPGRADES</Text>
                        <View style={styles.line} />
                    </View>

                    {/* Skills Scroll */}
                    <ScrollView 
                        style={styles.scroll} 
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {sortedSkills.map(skill => {
                            const isPurchased = purchasedSkills[skill.id];
                            const isLocked = level < skill.unlockAt;
                            const cost = D(skill.cost);
                            const canBuy = D(minerals).gte(cost);
                            const iconName = getSkillIconName(skill.kind, skill.value);

                            return (
                                <View key={skill.id} style={[styles.skillRow, isLocked && styles.skillRowLocked]}>
                                    {/* Left: Icon */}
                                    <View style={[styles.skillIconBox, isPurchased && styles.skillIconOwned]}>
                                        <MaterialCommunityIcons 
                                            name={iconName} 
                                            size={20} 
                                            color={isPurchased ? "#4ade80" : isLocked ? "#475569" : "#fbbf24"} 
                                        />
                                    </View>

                                    {/* Center: Info */}
                                    <View style={styles.skillInfo}>
                                        <Text style={[styles.skillName, isPurchased && styles.textOwned]}>
                                            {skill.name}
                                        </Text>
                                        <Text style={styles.skillDesc}>
                                            {isLocked 
                                                ? `Unlocks at Lv ${skill.unlockAt}` 
                                                : getSkillDescription(skill.kind, skill.value)
                                            }
                                        </Text>
                                    </View>

                                    {/* Right: Action */}
                                    <View style={styles.skillAction}>
                                        {isPurchased ? (
                                            <MaterialCommunityIcons name="check-circle" size={24} color="#4ade80" />
                                        ) : isLocked ? (
                                            <MaterialCommunityIcons name="lock" size={20} color="#475569" />
                                        ) : (
                                            <Pressable 
                                                style={[styles.buyBtn, !canBuy && styles.buyBtnDisabled]}
                                                onPress={() => {
                                                    onBuySkill(miner.id, skill.id);
                                                    // Special Case: Close modal if opening Rewind
                                                    if (skill.kind === "unlock_feature_rewind") {
                                                        onClose();
                                                    }
                                                }}
                                                disabled={!canBuy}
                                            >
                                                <Text style={styles.costTxt}>{fmtD(cost)}</Text>
                                                <MaterialCommunityIcons name="diamond-stone" size={10} color={canBuy ? "#000" : "rgba(255,255,255,0.5)"} />
                                            </Pressable>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                        
                        {sortedSkills.length === 0 && (
                            <Text style={styles.emptyText}>No upgrades available for this unit.</Text>
                        )}
                    </ScrollView>

                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16
    },
    modalContainer: {
        width: '90%',
        height: '75%', // Fixed height to ensure ScrollView has space
        backgroundColor: '#111827',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        elevation: 20
    },
    header: {
        padding: 16,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        position: 'relative',
        marginRight: 12
    },
    icon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    lvlBadge: {
        position: 'absolute',
        bottom: -6,
        right: -6,
        backgroundColor: '#2563eb',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#0f172a'
    },
    lvlText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold'
    },
    headerInfo: {
        flex: 1,
    },
    name: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 2
    },
    dps: {
        color: '#fbbf24',
        fontSize: 14,
        fontWeight: '600'
    },
    closeBtn: {
        padding: 4
    },
    flavorText: {
        color: '#94a3b8',
        fontSize: 12,
        fontStyle: 'italic',
        marginTop: 12,
        lineHeight: 16
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        padding: 16,
        backgroundColor: 'rgba(0,0,0,0.2)'
    },
    statChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.2)'
    },
    statChipBlue: {
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderColor: 'rgba(37, 99, 235, 0.2)'
    },
    statChipGray: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.1)'
    },
    statText: {
        color: '#ffd700',
        fontSize: 11,
        fontWeight: '600'
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 8
    },
    sectionTitle: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginRight: 8
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)'
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingTop: 0
    },
    skillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    skillRowLocked: {
        opacity: 0.5,
        backgroundColor: 'transparent',
    },
    skillIconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.2)'
    },
    skillIconOwned: {
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        borderColor: 'rgba(74, 222, 128, 0.2)'
    },
    skillInfo: {
        flex: 1
    },
    skillName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 2
    },
    textOwned: {
        color: '#4ade80'
    },
    skillDesc: {
        color: '#94a3b8',
        fontSize: 11
    },
    skillAction: {
        marginLeft: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    buyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#fbbf24',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8
    },
    buyBtnDisabled: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    costTxt: {
        color: '#000',
        fontSize: 11,
        fontWeight: 'bold'
    },
    emptyText: {
        color: '#64748b',
        textAlign: 'center',
        marginTop: 20,
        fontStyle: 'italic'
    }
});
