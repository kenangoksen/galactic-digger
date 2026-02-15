
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import minersDef from '../assets/config/miners.json';
import { D } from '../game/bn';
import { fmt } from '../game/damage';

export default function StellarRealignmentModal({ 
    visible, 
    onClose, 
    eco, 
    dispatchEco, 
    totals, // To show live DPS?
    ownedMiners
}) {
    const [selectedMinerId, setSelectedMinerId] = useState(null);

    // Filter unlocked miners only
    const unlockedMiners = useMemo(() => {
        return minersDef.filter(m => (ownedMiners[m.id] || 0) > 0);
    }, [ownedMiners]);

    const sfBalance = eco.stellarFragments || 0;
    const tagsMap = eco.tagsByMinerId || {};

    // Actions
    const handleScatter = () => {
        if (!selectedMinerId) return;
        if (D(sfBalance).lt(2)) return; // Check Cost
        dispatchEco({ type: "REALIGN_TAG_SCATTER", minerId: selectedMinerId });
    };

    const handleGather = () => {
         if (!selectedMinerId) return;
         if (D(sfBalance).lt(80)) return; // Check Cost
         dispatchEco({ type: "REALIGN_TAG_GATHER", minerId: selectedMinerId });
    };

    const renderMinerRow = (miner) => {
        const tagCount = tagsMap[miner.id] || 0;
        const tagPower = (eco.cosmicProtocols?.starlink_tag_amplifier || 0) * 0.05 + 0.50; // Base 50% + Amp
        const bonus = tagCount * tagPower * 100;
        
        const isSelected = selectedMinerId === miner.id;

        return (
            <Pressable 
                key={miner.id}
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => setSelectedMinerId(miner.id)}
            >
                {/* Icon */}
                <View style={styles.iconContainer}>
                     <Image 
                        source={require("../assets/images/sprites/miners/miner_01.png")} // Placeholder/Generic
                        style={styles.icon}
                     />
                </View>

                {/* Info */}
                <View style={styles.infoContainer}>
                    <Text style={styles.name}>{miner.name}</Text>
                    <Text style={styles.dps}>
                        Tag Bonus: <Text style={styles.bonusText}>+{bonus.toFixed(0)}%</Text>
                    </Text>
                </View>

                {/* Tag Count Badge */}
                <View style={styles.tagBadge}>
                    <MaterialCommunityIcons name="star-four-points" size={14} color="#fbbf24" />
                    <Text style={styles.tagCount}>{tagCount}</Text>
                </View>
            </Pressable>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            hardwareAccelerated
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Stellar Realignment</Text>
                            <Text style={styles.subtitle}>
                                Optimization Chamber • <Text style={{color:'#a78bfa'}}>{fmt(sfBalance)} SF</Text>
                            </Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                             <MaterialCommunityIcons name="close" size={24} color="#fff" />
                        </Pressable>
                    </View>

                    {/* List */}
                    <ScrollView style={styles.list} contentContainerStyle={{padding: 16, gap: 8}}>
                        {unlockedMiners.map(renderMinerRow)}
                    </ScrollView>

                    {/* Footer / Actions */}
                    <View style={styles.footer}>
                        {selectedMinerId ? (
                            <View style={styles.actionPanel}>
                                <Text style={styles.selectedLabel}>
                                    Target: <Text style={{fontWeight:'bold', color:'#fff'}}>
                                        {minersDef.find(m=>m.id===selectedMinerId)?.name}
                                    </Text>
                                </Text>
                                
                                <View style={styles.buttonsRow}>
                                    {/* Scatter */}
                                    <Pressable 
                                        style={[
                                            styles.actionBtn, 
                                            styles.scatterBtn,
                                            D(sfBalance).lt(2) && styles.disabledBtn
                                        ]}
                                        onPress={handleScatter}
                                    >
                                        <Text style={styles.btnLabel}>DISTRIBUTE</Text>
                                        <Text style={styles.btnCost}>2 SF</Text>
                                        <Text style={styles.btnDesc}>Randomly move 1 tag AWAY</Text>
                                    </Pressable>

                                    {/* Gather */}
                                    <Pressable 
                                        style={[
                                            styles.actionBtn, 
                                            styles.gatherBtn,
                                            D(sfBalance).lt(80) && styles.disabledBtn
                                        ]}
                                        onPress={handleGather}
                                    >
                                        <Text style={styles.btnLabel}>GATHER</Text>
                                        <Text style={styles.btnCost}>80 SF</Text>
                                        <Text style={styles.btnDesc}>Steal 1 tag from others</Text>
                                    </Pressable>
                                </View>
                            </View>
                        ) : (
                            <Text style={styles.hint}>Select a Miner to Realign</Text>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'flex-end',
    },
    container: {
        height: '80%',
        backgroundColor: '#111827',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#374151',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1f2937',
        backgroundColor: '#0f172a',
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    subtitle: {
        color: '#9ca3af',
        fontSize: 14,
        marginTop: 2,
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    list: {
        flex: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1f2937',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    rowSelected: {
        borderColor: '#8b5cf6',
        backgroundColor: '#2e2e4a',
    },
    iconContainer: {
        width: 48,
        height: 48,
        backgroundColor: '#374151',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    icon: {
        width: 32,
        height: 32,
        resizeMode: 'contain',
    },
    infoContainer: {
        flex: 1,
    },
    name: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    dps: {
        color: '#9ca3af',
        fontSize: 12,
    },
    bonusText: {
        color: '#fbbf24',
        fontWeight: 'bold',
    },
    tagBadge: {
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    tagCount: {
        color: '#fbbf24',
        fontWeight: 'bold',
        fontSize: 14,
    },
    footer: {
        padding: 20,
        backgroundColor: '#0f172a',
        borderTopWidth: 1,
        borderTopColor: '#1f2937',
        minHeight: 120, // ensure space
        justifyContent: 'center',
    },
    hint: {
        color: '#6b7280',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    selectedLabel: {
        color: '#9ca3af',
        textAlign: 'center',
        marginBottom: 12,
    },
    buttonsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    actionBtn: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 4,
    },
    scatterBtn: {
        backgroundColor: '#ef4444',
        borderBottomColor: '#b91c1c',
    },
    gatherBtn: {
        backgroundColor: '#10b981',
        borderBottomColor: '#059669',
    },
    disabledBtn: {
        opacity: 0.5,
        backgroundColor: '#374151',
        borderBottomColor: '#1f2937',
    },
    btnLabel: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 14,
    },
    btnCost: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
        marginTop: 2,
        fontWeight: 'bold',
    },
    btnDesc: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
        marginTop: 2,
    }
});
