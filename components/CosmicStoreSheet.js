import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import protocolsDef from "../assets/config/cosmic_protocols.json";
import { D } from "../game/bn";
import { fmt } from "../game/damage";

// Helper for cost calculation
export function getProtocolCost(level) {
  // Simple formula: Cost = Level + 1
  // Level 0 -> Cost 1
  // Level 10 -> Cost 11
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
  onBuy,
}) {
  if (!visible) return null;

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
          
          <Pressable onPress={onClose} style={styles.closeBtn}>
             <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* CURRENCY */}
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>AVAILABLE FRAGMENTS</Text>
          <Text style={styles.balanceValue}>{fmt(stellarFragments)}</Text>
        </View>

        {/* LIST */}
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {protocolsDef.map((proto) => {
            const level = cosmicProtocols[proto.id] || 0;
            const cost = getProtocolCost(level);
            const canAfford = D(stellarFragments).gte(cost);
            const iconName = ICONS[proto.id] || "cube";

            return (
              <View key={proto.id} style={styles.item}>
                <View style={styles.iconBox}>
                  <Ionicons name={iconName} size={20} color="#d8b4fe" />
                </View>

                <View style={styles.info}>
                  <Text style={styles.name}>{proto.name}</Text>
                  <Text style={styles.desc}>{proto.description}</Text>
                  <Text style={styles.stat}>
                    Lvl <Text style={styles.val}>{level}</Text> • +{Math.floor(level * proto.baseValue * 100)}%
                  </Text>
                </View>

                <Pressable
                  style={[styles.buyBtn, !canAfford && styles.buyBtnDisabled]}
                  onPress={() => onBuy(proto.id, cost)}
                  disabled={!canAfford}
                >
                  <Text style={styles.costText}>{cost}</Text>
                  <Ionicons name="diamond-outline" size={10} color={canAfford ? "#fff" : "#ffffff50"} />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 74,
    height: 260, // Match MinersSheet (Minimal)
    borderRadius: 20,
    backgroundColor: "rgba(12, 16, 28, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
    paddingTop: 12,
    paddingHorizontal: 12,
    overflow: "hidden",
    zIndex: 100,
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
  headerIcon: {
    width: 24,
    height: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#a855f7",
    letterSpacing: 1,
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 10,
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
    fontSize: 10,
    marginBottom: 2,
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
  },
  buyBtnDisabled: {
    backgroundColor: "rgba(255,255,255,0.05)",
    opacity: 0.5,
  },
  costText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
});
