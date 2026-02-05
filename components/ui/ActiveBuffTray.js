import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import protocolsDef from '../../assets/config/cosmic_protocols.json';

// Icon mapper (Reusable or imported)
const ICONS = {
  core_singularity: "planet",
  quantum_overdrive: "flash",
  entropy_engine: "skull",
  dark_matter_flow: "cloud",
  stellar_compression: "contract",
  photon_strike_matrix: "hand-left",
  manual_override: "finger-print",
  precision_lattice: "locate",
  astro_extraction_grid: "hammer",
  void_harvest_protocol: "cube",
  temporal_acceleration: "time",
  reality_stabilizer: "shield",
  silent_observer: "eye", // Special for idle
};

export default function ActiveBuffTray({ cosmicProtocols }) {
  const [selectedId, setSelectedId] = React.useState(null);
  const activeIds = Object.keys(cosmicProtocols || {}).filter(id => cosmicProtocols[id] > 0);

  if (activeIds.length === 0) return null;

  // Calculate Selected Info
  const selectedProto = selectedId ? (protocolsDef.protocols || protocolsDef).find(p => p.id === selectedId) : null;
  let selectedInfo = null;
  if (selectedProto) {
      const level = cosmicProtocols[selectedId];
      const baseVal = selectedProto.baseValue || 0;
      let txt = "";
      if (selectedProto.type.includes("Multiplier")) {
          const percent = Math.floor(baseVal * level * 100);
          txt = `+${percent}% Effect`;
      } else if (selectedProto.type === "zoneMonsterReducer") {
          txt = `-${level} Monsters/Zone`;
      } else if (selectedProto.type.includes("Duration")) {
          txt = `+${level}s Duration`;
      } else {
          txt = `Lvl ${level} Active`;
      }
      selectedInfo = { title: selectedProto.name, desc: txt };
  }

  return (
    <View style={styles.container}>
      {/* FIXED INFO PANEL (Outside ScrollView) */}
      {selectedInfo && (
          <View style={styles.infoPanel}>
              <Text style={styles.tooltipTitle}>{selectedInfo.title}</Text>
              <Text style={styles.tooltipDesc}>{selectedInfo.desc}</Text>
          </View>
      )}

      <ScrollView 
        showsVerticalScrollIndicator={true} 
        style={{ maxHeight: 300 }} 
        contentContainerStyle={{ gap: 8, paddingRight: 4, paddingBottom: 20 }}
      >
        {activeIds.map((id) => {
          const proto = (protocolsDef.protocols || protocolsDef).find(p => p.id === id);
          if (!proto) return null;
          
          const iconName = ICONS[id] || "cube";
          const level = cosmicProtocols[id];
          const isMaxed = level >= 10; 
          const isSelected = selectedId === id;

          return (
            <View key={id} style={{ alignItems: 'flex-end', marginRight: 2 }}>
              <Pressable 
                  onPress={() => setSelectedId(isSelected ? null : id)}
                  style={[styles.buff, isMaxed && styles.buffMaxed, isSelected && styles.buffSelected]}
              >
                  <Ionicons name={iconName} size={14} color={isMaxed ? "#ffd700" : "#4cdbe8"} />
                  <Text style={styles.lvlText}>{level}</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 420, 
    right: 14, 
    flexDirection: 'column',
    gap: 0, 
    zIndex: 5, // ✅ Lowered zIndex (was 99)
    alignItems: 'flex-end', 
  },
  buff: {
    width: 32, 
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 219, 232, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buffSelected: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  buffMaxed: {
    borderColor: '#ffd700',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  lvlText: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    fontSize: 9,
    color: '#fff',
    fontWeight: 'bold',
    backgroundColor: '#000',
    paddingHorizontal: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  infoPanel: { // ✅ New Fixed Panel style
      position: 'absolute',
      right: 48, // To left of icons
      top: 0, // Fixed at top of list
      backgroundColor: 'rgba(10, 15, 30, 0.95)',
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#4cdbe8',
      minWidth: 140,
      maxWidth: 200,
      zIndex: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.5,
      shadowRadius: 4,
  },
  tooltipTitle: {
      color: '#4cdbe8',
      fontSize: 11,
      fontWeight: 'bold',
      marginBottom: 3,
  },
  tooltipDesc: {
      color: '#ccc',
      fontSize: 10,
  }
});
