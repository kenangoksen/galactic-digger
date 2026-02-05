import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fmtD as fmt } from '../../game/bn'; // ✅ Fixed import name
import configCache from '../../game/ConfigCache'; // ✅ Fixed default import
// import { useGameEngine } from '../../game/useGameEngine'; // Removed hook usage

export default function SummonProtocolModal({ 
    visible, 
    onClose,
    summonPool, 
    rerollCount, 
    stellarFragments,
    unlockProtocol,
    rerollSlot,
    generateSummonPool,
    getNextUnlockCost
}) {
  // Props are now passed from parent (Single Source of Truth)

  // Ensure pool exists on mount
  useEffect(() => {
    if (visible && (!summonPool || summonPool.length === 0)) {
      generateSummonPool();
    }
  }, [visible, summonPool]);

  // If still empty after generate attempt (maybe all unlocked?), show message
  if (!summonPool || summonPool.length === 0) {
     return null; // Or handle empty state
  }

  const allProtocols = configCache.getCosmicProtocols()?.protocols || [];
  const unlockCost = getNextUnlockCost();
  
  // Reroll Cost Logic: 1.5 ^ rerollCount
  const rerollCost = Math.floor(Math.max(1, Math.pow(1.5, rerollCount || 0)));

  const handleUnlock = (id) => {
      unlockProtocol(id);
      onClose(); // Close modal after success
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Fallback overlay (no blur) */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
        
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Summon Ancient Protocol</Text>
                    <Text style={styles.subtitle}>
                        Choose 1 to Unlock. Cost: <Text style={styles.costText}>{fmt(unlockCost)} SF</Text>
                    </Text>
                </View>
                <Pressable onPress={onClose} style={styles.closeBtn}>
                    <Ionicons name="close" size={24} color="#fff" />
                </Pressable>
            </View>

            {/* Cards Grid */}
            <ScrollView contentContainerStyle={styles.grid}>
                {summonPool.map((id, index) => {
                    const proto = allProtocols.find(p => p.id === id);
                    if (!proto) return null;

                    return (
                        <View key={`${id}-${index}`} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardName} numberOfLines={1}>{proto.name}</Text>
                                {/* Icon Placeholder */}
                                <View style={styles.iconCircle}>
                                   <Ionicons name="planet" size={18} color="#4cdbe8" />
                                </View>
                            </View>
                            
                            <Text style={styles.cardDesc}>{proto.description}</Text>
                            
                            <View style={styles.actions}>
                                {/* Unlock Button */}
                                <Pressable 
                                    style={[styles.unlockBtn, stellarFragments < unlockCost && styles.btnDisabled]}
                                    onPress={() => handleUnlock(id)}
                                    disabled={stellarFragments < unlockCost}
                                >
                                    <Text style={styles.btnText}>Unlock ({fmt(unlockCost)} SF)</Text>
                                </Pressable>

                                {/* Individual Reroll */}
                                <Pressable 
                                    style={[styles.rerollBtn, stellarFragments < rerollCost && styles.btnDisabled]}
                                    onPress={() => rerollSlot(index)}
                                    disabled={stellarFragments < rerollCost}
                                >
                                    <Ionicons name="refresh" size={12} color="#fff" style={{marginRight:4}} />
                                    <Text style={styles.smallBtnText}>{fmt(rerollCost)}</Text>
                                </Pressable>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
            
             <View style={styles.footer}>
                <Text style={styles.footerNote}>
                    Fragments Available: <Text style={{color:'#00ffaa', fontWeight:'bold'}}>{fmt(stellarFragments)}</Text>
                </Text>
            </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 219, 232, 0.3)',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 2,
  },
  costText: {
    color: '#ffd700',
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 8,
  },
  grid: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  card: {
    width: '48%', // 2 columns
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardName: {
    color: '#4cdbe8',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginRight: 4,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(76, 219, 232, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDesc: {
    color: '#ccc',
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 12,
    minHeight: 42, // Consistent height
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  unlockBtn: {
    flex: 2,
    backgroundColor: '#00aa00',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  rerollBtn: {
    flex: 1,
    backgroundColor: '#444',
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  smallBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  footer: {
      padding: 12,
      backgroundColor: 'rgba(0,0,0,0.2)',
      alignItems: 'center',
  },
  footerNote: {
      color: '#888',
      fontSize: 12,
  }
});
