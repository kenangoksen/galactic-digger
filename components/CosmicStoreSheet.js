import { Ionicons } from "@expo/vector-icons"; // Added MaterialCommunityIcons for consistence if needed, or just Text
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import protocolsDef from "../assets/config/cosmic_protocols.json";
import { D } from "../game/bn";
import { fmt, getProtocolBulkCost } from "../game/damage"; // ✅ Added helper
import SummonProtocolModal from "./game/SummonProtocolModal";

// Helper for cost calculation (Upgrade cost, distinct from unlock)
export function getUpgradeCost(level) {
  // Simple formula: Cost = Level + 1
  return level + 1;
}

// Icon mapper
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
};

export default function CosmicStoreSheet({
  visible,
  onClose,
  stellarFragments,
  cosmicProtocols, // { "core_singularity": 5, ... }
  onBuy, // This is actually onUpgrade now
  // Summoning Props
  summonPool,
  rerollCount,
  unlockProtocol,
  rerollSlot,
  generateSummonPool,
  getNextUnlockCost
}) {
  const [showSummon, setShowSummon] = useState(false);
  const [buyMultiplier, setBuyMultiplier] = useState(1); // ✅

  const toggleMult = () => {
      setBuyMultiplier(prev => {
          const opts = [1, 10, 25, 100, 1000, 10000];
          const idx = opts.indexOf(prev);
          return opts[(idx + 1) % opts.length];
      });
  };
  
  if (!visible) return null;

  const nextUnlockCost = getNextUnlockCost ? getNextUnlockCost() : 0;
  const canSummon = D(stellarFragments).gte(nextUnlockCost);

  // Filter owned protocols
  const ownedList = (protocolsDef.protocols || protocolsDef).filter(p => (cosmicProtocols[p.id] || 0) > 0);

  return (
    <View style={styles.sheet}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Image 
              source={require("../assets/images/ui/bottom/cosmic_protocol.png")} 
              style={styles.headerIcon}
            />
            <Text style={styles.title}>COSMIC PROTOCOLS</Text>
          </View>
          
          <View style={styles.headerRight}>
              <Pressable onPress={toggleMult} style={styles.multBtn}>
                  <Text style={styles.multBtnTxt}>{buyMultiplier}x</Text>
              </Pressable>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                 <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
          </View>
        </View>

        {/* CURRENCY */}
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>AVAILABLE FRAGMENTS</Text>
          <Text style={styles.balanceValue}>{fmt(stellarFragments)}</Text>
        </View>
        
        {/* SUMMON BANNER */}
        <Pressable 
            style={[styles.summonBanner]}
            onPress={() => setShowSummon(true)}
        >
             <Ionicons name="sparkles" size={14} color="#00ffaa" style={{marginRight: 6}} />
             <Text style={styles.summonTitle}>
                 SUMMON NEW PROTOCOL
             </Text>
        </Pressable>

        {/* LIST */}
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {ownedList.length === 0 ? (
              <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No Active Protocols</Text>
                  <Text style={styles.emptySub}>Summon an ancient protocol to begin.</Text>
              </View>
          ) : (
              ownedList.map((proto) => {
                const level = cosmicProtocols[proto.id] || 0;
                // ✅ Use Bulk Cost Helper
                const cost = getProtocolBulkCost(level, buyMultiplier);
                
                const canAfford = D(stellarFragments).gte(cost);
                const iconName = ICONS[proto.id] || "cube";
    
                return (
                  <View key={proto.id} style={styles.item}>
                    <View style={styles.iconBox}>
                      <Ionicons name={iconName} size={20} color="#d8b4fe" />
                    </View>
    
                    <View style={styles.info}>
                      <Text style={styles.name}>{proto.name}</Text>
                      <Text style={styles.desc} numberOfLines={2}>{proto.description}</Text>
                      <Text style={styles.stat}>
                        Lvl <Text style={styles.val}>{level}</Text> • +{Math.floor(level * proto.baseValue * 100)}%
                      </Text>
                    </View>
    
                    <Pressable
                      style={[styles.buyBtn, !canAfford && styles.buyBtnDisabled]}
                      onPress={() => onBuy(proto.id, buyMultiplier)} 
                      disabled={!canAfford}
                    >
                      <Text style={styles.costText}>{fmt(cost)}</Text>
                      <Ionicons name="arrow-up-circle" size={12} color={canAfford ? "#fff" : "#ffffff50"} />
                    </Pressable>
                  </View>
                );
              })
          )}
        </ScrollView>
        
        {/* SUMMON MODAL */}
        <SummonProtocolModal 
            visible={showSummon} 
            onClose={() => setShowSummon(false)} 
            summonPool={summonPool}
            rerollCount={rerollCount}
            stellarFragments={stellarFragments}
            unlockProtocol={unlockProtocol}
            rerollSlot={rerollSlot}
            generateSummonPool={generateSummonPool}
            getNextUnlockCost={getNextUnlockCost}
        />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 74,
    height: 280, // Standardized height
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "rgba(12, 16, 28, 0.98)",
    borderTopWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
    paddingTop: 12,
    paddingHorizontal: 16,
    overflow: "hidden",
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
  },
  multBtn: {
      backgroundColor: "rgba(168, 85, 247, 0.2)", // Purple tint
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(168, 85, 247, 0.5)",
  },
  multBtnTxt: {
      color: "#d8b4fe",
      fontSize: 10,
      fontWeight: "bold",
  },
  headerIcon: {
    width: 24,
    height: 24,
  },
  title: {
    fontSize: 12,
    fontWeight: "800",
    color: "#a855f7",
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  balanceContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  balanceLabel: {
    color: "#a855f7",
    fontSize: 10,
    fontWeight: "bold",
  },
  balanceValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  
  // Summon Banner
  summonBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center', // Center content
      backgroundColor: 'rgba(0, 255, 170, 0.08)', // Slightly more transparent
      borderWidth: 1,
      borderColor: 'rgba(0, 255, 170, 0.2)',
      borderRadius: 8,
      paddingVertical: 8, // Minimal padding
      marginBottom: 10,
  },
  summonDisabled: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderColor: 'rgba(255,255,255,0.1)',
  },
  summonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
  },
  summonTitle: {
      color: '#00ffaa',
      fontWeight: '800',
      fontSize: 12,
      letterSpacing: 0.5,
  },
  summonCostBadge: {
      backgroundColor: 'rgba(0,0,0,0.4)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
  },
  summonCostText: {
      color: '#ffd700',
      fontWeight: 'bold',
      fontSize: 12,
  },

  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 10,
  },
  emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 40,
      opacity: 0.6,
  },
  emptyText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
  },
  emptySub: {
      color: '#aaa',
      fontSize: 12,
      marginTop: 4,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  iconBox: {
    width: 32,
    height: 32,
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  info: {
    flex: 1,
  },
  name: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  desc: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 9, // Smaller font for description
    marginBottom: 2,
    marginRight: 8,
  },
  stat: {
    color: "#a855f7",
    fontSize: 10,
    fontWeight: "600",
  },
  val: {
    color: "#fff",
  },
  buyBtn: {
    backgroundColor: "#7e22ce",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 60,
    justifyContent: 'center',
  },
  buyBtnDisabled: {
    backgroundColor: "rgba(255,255,255,0.05)",
    opacity: 0.5,
  },
  costText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
