
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { calculateUpgradeCost } from "../../game/artifacts/artifactService";
import { ARTIFACT_AFFIX } from "../../game/artifacts/artifactTypes";
import { D, fmtD } from "../../game/bn";

const AFFIX_LABELS = {
  [ARTIFACT_AFFIX.ANCIENT_POWER_ALL]: "Ancient Power (Global DMG)",
  [ARTIFACT_AFFIX.IDLE_DPS]: "Idle DPS",
  [ARTIFACT_AFFIX.CLICK_DAMAGE]: "Click Damage",
  [ARTIFACT_AFFIX.OFFLINE_EARNINGS]: "Offline Earnings",
  [ARTIFACT_AFFIX.CRIT_CHANCE]: "Crit Chance",
  [ARTIFACT_AFFIX.SHARD_FIND]: "Shard Find Chance",
};

export default function ArtifactUpgradeModal({ 
  visible, 
  onClose, 
  artifact, 
  onConfirm,
  forgeCores 
}) {
  if (!visible || !artifact) return null;

  const upgradeCost = calculateUpgradeCost(artifact);
  const canAfford = D(forgeCores).gte(upgradeCost);

  const currentLevel = artifact.level || 1;
  const nextLevel = currentLevel + 1;
  const scale = nextLevel / currentLevel;

  // Calculate next values
  const nextAffixes = artifact.affixes.map(a => ({
      type: a.type,
      currentValue: parseFloat(a.value),
      nextValue: parseFloat(a.value) * scale
  }));

  const formatValue = (type, value) => {
      if (type === ARTIFACT_AFFIX.CRIT_CHANCE || type === ARTIFACT_AFFIX.SHARD_FIND) {
          return `${(value * 100).toFixed(1)}%`;
      }
      return `${(value * 100).toFixed(0)}%`;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
             <View style={styles.container}>
                 <LinearGradient colors={["#1e293b", "#0f172a"]} style={styles.bg}>
                     {/* HEADER */}
                     <View style={styles.header}>
                         <MaterialCommunityIcons name="arrow-up-bold-circle" size={24} color="#fbbf24" />
                         <Text style={styles.title}>UPGRADE ARTIFACT</Text>
                         <Pressable onPress={onClose} style={styles.closeBtn}>
                             <MaterialCommunityIcons name="close" size={24} color="#aaa" />
                         </Pressable>
                     </View>

                     <ScrollView contentContainerStyle={styles.content}>
                         {/* LEVEL INFO */}
                         <View style={styles.levelRow}>
                             <View style={styles.levelBox}>
                                 <Text style={styles.levelLabel}>Current</Text>
                                 <Text style={styles.levelValue}>Lv.{currentLevel}</Text>
                             </View>
                             <MaterialCommunityIcons name="arrow-right" size={32} color="#64748b" />
                             <View style={[styles.levelBox, styles.levelBoxNext]}>
                                 <Text style={styles.levelLabel}>Next</Text>
                                 <Text style={[styles.levelValue, {color: '#fbbf24'}]}>Lv.{nextLevel}</Text>
                             </View>
                         </View>

                         {/* STATS COMPARISON */}
                         <View style={styles.statsSection}>
                             <Text style={styles.sectionTitle}>STAT CHANGES</Text>
                             {nextAffixes.map((affix, idx) => {
                                 const label = AFFIX_LABELS[affix.type] || affix.type;
                                 const currentStr = formatValue(affix.type, affix.currentValue);
                                 const nextStr = formatValue(affix.type, affix.nextValue);
                                 const increase = ((affix.nextValue - affix.currentValue) / affix.currentValue * 100).toFixed(1);

                                 return (
                                     <View key={idx} style={styles.statRow}>
                                         <Text style={styles.statLabel}>{label}</Text>
                                         <View style={styles.statValues}>
                                             <Text style={styles.statCurrent}>{currentStr}</Text>
                                             <MaterialCommunityIcons name="arrow-right" size={16} color="#64748b" style={{marginHorizontal: 8}} />
                                             <Text style={styles.statNext}>{nextStr}</Text>
                                             <Text style={styles.statIncrease}>(+{increase}%)</Text>
                                         </View>
                                     </View>
                                 );
                             })}
                         </View>

                         {/* COST */}
                         <View style={styles.costSection}>
                             <View style={styles.costRow}>
                                 <MaterialCommunityIcons name="cube-outline" size={20} color="#a78bfa" />
                                 <Text style={styles.costLabel}>Upgrade Cost:</Text>
                                 <Text style={[styles.costValue, !canAfford && styles.costInsufficient]}>
                                     {fmtD(upgradeCost)} Cores
                                 </Text>
                             </View>
                             {!canAfford && (
                                 <Text style={styles.warningText}>Insufficient Forge Cores</Text>
                             )}
                         </View>

                         {/* ACTIONS */}
                         <View style={styles.actions}>
                             <Pressable style={[styles.btn, styles.cancelBtn]} onPress={onClose}>
                                 <Text style={styles.btnText}>Cancel</Text>
                             </Pressable>
                             <Pressable 
                                 style={[styles.btn, styles.confirmBtn, !canAfford && styles.disabledBtn]} 
                                 onPress={() => {
                                     if (canAfford) {
                                         onConfirm();
                                         onClose();
                                     }
                                 }}
                             >
                                 <MaterialCommunityIcons name="check-bold" size={18} color="#fff" style={{marginRight: 6}} />
                                 <Text style={styles.btnText}>Confirm Upgrade</Text>
                             </Pressable>
                         </View>
                     </ScrollView>
                 </LinearGradient>
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
      padding: 20,
  },
  container: {
      borderRadius: 16,
      overflow: 'hidden',
      maxHeight: '80%',
      width: '100%',
  },
  bg: {
      padding: 0,
  },
  header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: 'rgba(251, 191, 36, 0.1)',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(251, 191, 36, 0.3)',
  },
  title: {
      color: '#fbbf24',
      fontWeight: 'bold',
      fontSize: 16,
      letterSpacing: 1,
      flex: 1,
      textAlign: 'center',
  },
  closeBtn: {
      padding: 4,
  },
  content: {
      padding: 20,
  },
  levelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
      gap: 16,
  },
  levelBox: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      minWidth: 100,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
  },
  levelBoxNext: {
      borderColor: 'rgba(251, 191, 36, 0.3)',
      backgroundColor: 'rgba(251, 191, 36, 0.05)',
  },
  levelLabel: {
      color: '#94a3b8',
      fontSize: 12,
      fontWeight: 'bold',
      marginBottom: 4,
  },
  levelValue: {
      color: '#fff',
      fontSize: 24,
      fontWeight: 'bold',
  },
  statsSection: {
      marginBottom: 24,
  },
  sectionTitle: {
      color: '#94a3b8',
      fontSize: 12,
      fontWeight: 'bold',
      marginBottom: 12,
      letterSpacing: 0.5,
  },
  statRow: {
      marginBottom: 12,
      backgroundColor: 'rgba(255,255,255,0.03)',
      padding: 12,
      borderRadius: 8,
  },
  statLabel: {
      color: '#cbd5e1',
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 6,
  },
  statValues: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  statCurrent: {
      color: '#94a3b8',
      fontSize: 14,
      fontWeight: 'bold',
  },
  statNext: {
      color: '#4ade80',
      fontSize: 14,
      fontWeight: 'bold',
  },
  statIncrease: {
      color: '#4ade80',
      fontSize: 11,
      marginLeft: 8,
      fontWeight: '600',
  },
  costSection: {
      backgroundColor: 'rgba(167, 139, 250, 0.1)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: 'rgba(167, 139, 250, 0.2)',
  },
  costRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
  },
  costLabel: {
      color: '#cbd5e1',
      fontSize: 14,
      fontWeight: '600',
      flex: 1,
  },
  costValue: {
      color: '#a78bfa',
      fontSize: 16,
      fontWeight: 'bold',
  },
  costInsufficient: {
      color: '#ef4444',
  },
  warningText: {
      color: '#ef4444',
      fontSize: 12,
      marginTop: 8,
      fontWeight: '600',
  },
  actions: {
      flexDirection: 'row',
      gap: 12,
  },
  btn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
  },
  cancelBtn: {
      backgroundColor: '#475569',
  },
  confirmBtn: {
      backgroundColor: '#fbbf24',
  },
  disabledBtn: {
      opacity: 0.4,
      backgroundColor: '#555',
  },
  btnText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 14,
  },
});
