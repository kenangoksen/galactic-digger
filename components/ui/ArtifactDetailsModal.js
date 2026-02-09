
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { calculateSalvageValue, calculateUpgradeCost } from "../../game/artifacts/artifactService";
import { D, fmtD } from "../../game/bn";
import ArtifactCard from "./ArtifactCard";
import ArtifactUpgradeModal from "./ArtifactUpgradeModal";

export default function ArtifactDetailsModal({ 
  visible, 
  onClose, 
  artifact, 
  isEquipped, 
  onEquip, 
  onUnequip, 
  onUpgrade, 
  onSalvage,
  forgeCores 
}) {
  if (!visible || !artifact) return null;

  const upgradeCost = calculateUpgradeCost(artifact);
  const salvageValue = calculateSalvageValue(artifact);
  const canAffordUpgrade = D(forgeCores).gte(upgradeCost);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleUpgrade = () => {
    if (!canAffordUpgrade) {
        Alert.alert("Insufficient Forge Cores", "Not enough Forge Cores to upgrade.");
        return;
    }
    setShowUpgradeModal(true);
  };

  const confirmUpgrade = () => {
    onUpgrade(artifact.id);
  };

  const handleDestroy = () => {
      Alert.alert(
          "Destroy Artifact", 
          `Are you sure you want to destroy this artifact for ${salvageValue} Forge Cores?`,
          [
              { text: "Cancel", style: "cancel" },
              { text: "Destroy", style: "destructive", onPress: () => onSalvage(artifact.id) }
          ]
      );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
             <View style={styles.container}>
                 <LinearGradient colors={["#1e293b", "#0f172a"]} style={styles.bg}>
                     {/* HEADER */}
                     <View style={styles.header}>
                         <Text style={styles.title}>ARTIFACT DETAILS</Text>
                         <Pressable onPress={onClose} style={styles.closeBtn}>
                             <MaterialCommunityIcons name="close" size={24} color="#aaa" />
                         </Pressable>
                     </View>

                     <ScrollView contentContainerStyle={styles.content}>
                         {/* PREVIEW */}
                         <View style={styles.preview}>
                             <ArtifactCard artifact={artifact} disabled />
                         </View>

                         {/* ACTIONS */}
                         <View style={styles.actions}>
                             {/* EQUIP / UNEQUIP */}
                             {isEquipped ? (
                                 <Pressable style={[styles.btn, styles.unequipBtn]} onPress={() => onUnequip(artifact.id)}>
                                     <Text style={styles.btnText}>Unequip</Text>
                                 </Pressable>
                             ) : (
                                  <Pressable style={[styles.btn, styles.equipBtn]} onPress={() => onEquip(artifact.id)}>
                                      <Text style={styles.btnText}>Equip</Text>
                                  </Pressable>
                             )}

                             {/* UPGRADE */}
                            <Pressable 
                                style={[styles.btn, styles.upgradeBtn, !canAffordUpgrade && styles.disabledBtn]} 
                                onPress={handleUpgrade}
                            >
                                <View>
                                    <Text style={styles.btnText}>Upgrade</Text>
                                    <Text style={styles.subText}>{fmtD(upgradeCost)} Core</Text>
                                </View>
                                <MaterialCommunityIcons name="arrow-up-bold-circle" size={20} color={canAffordUpgrade ? "#fff" : "#aaa"} />
                            </Pressable>
                         </View>

                         {/* SALVAGE */}
                         <View style={styles.salvageContainer}>
                             <Pressable style={[styles.btn, styles.salvageBtn]} onPress={handleDestroy}>
                                  <MaterialCommunityIcons name="delete-forever" size={20} color="#fca5a5" style={{marginRight: 8}}/>
                                  <Text style={styles.salvageText}>Destroy (+{salvageValue} Cores)</Text>
                             </Pressable>
                         </View>
                     </ScrollView>
                 </LinearGradient>
             </View>
        </View>
        
        {/* UPGRADE CONFIRMATION MODAL */}
        <ArtifactUpgradeModal
            visible={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            artifact={artifact}
            onConfirm={confirmUpgrade}
            forgeCores={forgeCores}
        />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.8)",
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
      backgroundColor: 'rgba(255,255,255,0.05)',
  },
  title: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
      letterSpacing: 1,
  },
  closeBtn: {
      padding: 4,
  },
  content: {
      padding: 20,
      alignItems: 'center',
  },
  preview: {
      width: '100%',
      marginBottom: 24,
  },
  actions: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
      marginBottom: 24,
  },
  btn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
  },
  equipBtn: {
      backgroundColor: '#2563eb', // Blue
  },
  unequipBtn: {
      backgroundColor: '#475569', // Slate
  },
  upgradeBtn: {
      backgroundColor: '#fbbf24', // Amber
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
  },
  disabledBtn: {
      opacity: 0.5,
      backgroundColor: '#555',
  },
  btnText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 14,
  },
  subText: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 10,
  },
  salvageContainer: {
      width: '100%',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.1)',
      paddingTop: 16,
  },
  salvageBtn: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)', // Red tint
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  salvageText: {
      color: '#fca5a5',
      fontWeight: 'bold',
  },
});
