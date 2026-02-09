
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { memo, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { fmtD } from "../game/bn";
import ArtifactCard from "./ui/ArtifactCard";
import ArtifactDetailsModal from "./ui/ArtifactDetailsModal";

const ACTIVE_SLOTS = [0, 1, 2, 3]; // 4 Slots

function ArtifactsSheet({
  visible,
  onClose,
  artifacts, // { active: [], junk: [], byId: {}, forgeCores: D }
  onEquip,
  onUnequip,
  onUpgrade,
  onSalvage
}) {
  const [selectedId, setSelectedId] = useState(null);

  // Derived data
  const activeList = useMemo(() => {
      if (!artifacts?.active) return [];
      return artifacts.active.map(id => artifacts.byId[id]).filter(Boolean);
  }, [artifacts]);

  const junkList = useMemo(() => {
      if (!artifacts?.junk) return [];
      return artifacts.junk.map(id => artifacts.byId[id]).filter(Boolean);
  }, [artifacts]);
  
  const forgeCores = artifacts?.forgeCores || 0;

  if (!visible) return null;

  const handleSelect = (id) => setSelectedId(id);
  const handleCloseModal = () => setSelectedId(null);
  
  // Modal Handlers
  const handleEquip = (id) => {
      onEquip(id);
      setSelectedId(null); // Close on action? Or keep open? User preference. 
      // Usually close to see result.
  };
  const handleUnequip = (id) => {
      onUnequip(id);
      setSelectedId(null);
  };
  const handleSalvage = (id) => {
      onSalvage(id);
      setSelectedId(null);
  };
  const handleUpgrade = (id) => {
      onUpgrade(id);
      // Keep open to upgrade more
  };
  
  const selectedArtifact = selectedId ? artifacts.byId[selectedId] : null;
  const isSelectedEquipped = selectedId ? artifacts.active.includes(selectedId) : false;

  return (
    <View style={styles.sheet} pointerEvents="auto">
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="trophy" size={20} color="#fbbf24" />
          <Text style={styles.title}>ARTIFACTS</Text>
        </View>
        <View style={styles.headerRight}>
            <View style={styles.currencyBadge}>
                <MaterialCommunityIcons name="cube-outline" size={14} color="#a78bfa" />
                <Text style={styles.currencyText}>{fmtD(forgeCores)} Cores</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
        </View>
      </View>
      
      {/* CONTENT */}
      <View style={styles.content}>
          {/* ACTIVE SLOTS */}
          <Text style={styles.sectionTitle}>EQUIPPED ({activeList.length}/4)</Text>
          <View style={styles.activeRow}>
              {ACTIVE_SLOTS.map(idx => {
                  const art = activeList[idx];
                  return (
                      <Pressable 
                        key={idx} 
                        style={[styles.slot, !art && styles.emptySlot]}
                        onPress={() => art && handleSelect(art.id)}
                      >
                          {art ? (
                              <View style={styles.slotContent}>
                                   {/* Mini Badge */}
                                   <MaterialCommunityIcons name="star" size={12} color="#fbbf24" style={styles.slotIcon} />
                                   <Text style={styles.slotText} numberOfLines={1}>{art.rarity.charAt(0)}</Text>
                              </View>
                          ) : (
                              <MaterialCommunityIcons name="plus" size={20} color="rgba(255,255,255,0.1)" />
                          )}
                      </Pressable>
                  );
              })}
          </View>
          
          {/* JUNK LIST */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>INVENTORY ({junkList.length})</Text>
          <FlatList
            data={junkList}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
                <ArtifactCard 
                    artifact={item} 
                    onPress={() => handleSelect(item.id)}
                    style={{ marginBottom: 8 }}
                />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
      </View>

      {/* MODAL */}
      {selectedArtifact && (
          <ArtifactDetailsModal
            visible={!!selectedArtifact}
            onClose={handleCloseModal}
            artifact={selectedArtifact}
            isEquipped={isSelectedEquipped}
            forgeCores={forgeCores}
            onEquip={handleEquip}
            onUnequip={handleUnequip}
            onUpgrade={handleUpgrade}
            onSalvage={handleSalvage}
          />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0, 
    top: 110, // ✅ Fixed offset below TopBar
    backgroundColor: "rgba(15, 23, 42, 0.98)", // Almost opaque
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "#fbbf24", 
    zIndex: 50,
    paddingTop: 16,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fbbf24",
    letterSpacing: 1,
  },
  headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
  },
  currencyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(167, 139, 250, 0.15)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
      borderWidth: 1,
      borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  currencyText: {
      color: '#a78bfa',
      fontWeight: 'bold',
      fontSize: 12,
  },
  closeBtn: {
      padding: 4,
  },
  content: {
      flex: 1,
  },
  sectionTitle: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: 12,
      fontWeight: 'bold',
      marginBottom: 8,
      letterSpacing: 0.5,
  },
  activeRow: {
      flexDirection: 'row',
      gap: 12,
  },
  slot: {
      width: 60,
      height: 60,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
  },
  emptySlot: {
      borderStyle: 'dashed',
  },
  slotContent: {
      alignItems: 'center',
  },
  slotIcon: {
      marginBottom: 2,
  },
  slotText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: 'bold',
  },
  listContent: {
      paddingBottom: 20,
  },
});

export default memo(ArtifactsSheet);
