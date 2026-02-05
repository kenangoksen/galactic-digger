import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import configCache from "../game/ConfigCache";
import { fmt } from "../game/damage";

// ICONS
const ICONS = {
  prime_continuum: "infinite",
  graviton_law: "magnet",
  eternal_drift: "time",
  singular_genesis: "flash",
  cosmic_inversion: "swap-vertical",
  last_equation: "calculator",
  chronal_margin: "timer",
  treasure_manifest: "gift",
  kairic_dampener: "skull",
};

export default function BigBangSheet({
  visible,
  onClose,
  cosmicEssence,
  universalConstantsLevels,
  buyUniversalConstant,
  performBigBang,
  stats,
  maxUnlockedZone,
  stellarFragmentsSpentLifetime = 0, // Passed from engine totals or eco
  onOpenModal // ✅ Trigger modal
}) {
  const [tab, setTab] = useState("UPGRADES"); // "UPGRADES" | "BIGBANG"

  // ---------------- Calculation Logic (Preview) ----------------
  const highestZone = stats?.thisRewind?.highestZoneReached || maxUnlockedZone || 1;
  const spentSF = stellarFragmentsSpentLifetime || 0;
  
  const sectorTerm = Math.max(0, Math.floor((highestZone - 100) / 50));
  const spentTerm = Math.floor(Math.log10(Math.max(1, spentSF)) / 2);
  let gain = Math.max(0, sectorTerm + spentTerm);
  
  // Guarantee
  if (highestZone >= 150 && gain < 1) gain = 1;

  const CONSTANTS_CONFIG = configCache.getUniversalConstants();

  return (
    <View style={styles.sheet}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Image 
            source={require("../assets/images/ui/bottom/bigbang.png")} 
            style={styles.headerIcon}
          />
          <Text style={styles.title}>BIG BANG</Text>
        </View>
        
        <Pressable onPress={onClose} style={styles.closeBtn}>
           <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
      </View>

      {/* CURRENCY */}
      <View style={styles.balanceContainer}>
        <Text style={styles.balanceLabel}>COSMIC ESSENCE</Text>
        <Text style={styles.balanceValue}>{fmt(cosmicEssence)}</Text>
      </View>

      {/* TABS */}
      <View style={styles.tabs}>
          <Pressable 
            style={[styles.tab, tab === "UPGRADES" && styles.activeTab]}
            onPress={() => setTab("UPGRADES")}
          >
              <Text style={[styles.tabText, tab === "UPGRADES" && styles.activeTabText]}>CONSTANTS</Text>
          </Pressable>
          <Pressable 
            style={[styles.tab, tab === "BIGBANG" && styles.activeTab]}
            onPress={() => setTab("BIGBANG")}
          >
              <Text style={[styles.tabText, tab === "BIGBANG" && styles.activeTabText]}>UNIVERSE RESET</Text>
          </Pressable>
      </View>

      {/* CONTENT */}
      {tab === "UPGRADES" ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {(CONSTANTS_CONFIG?.items || []).map((item) => {
            const level = universalConstantsLevels[item.id] || 0;
            
            // Cost Calc
            let cost = 1;
            const model = item.leveling?.costModel;
            if (model === "levelPlus1") cost = level + 1;
            else if (model === "flat1") cost = 1;

            const canAfford = cosmicEssence >= cost;
            const maxed = item.leveling?.maxLevel && level >= item.leveling.maxLevel;

            return (
              <View key={item.id} style={styles.item}>
                <View style={styles.iconBox}>
                  <Ionicons name={ICONS[item.id] || "cube"} size={22} color="#60a5fa" />
                </View>

                <View style={styles.info}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.desc}>{item.description}</Text>
                  <Text style={styles.stat}>{item.effectDisplay.replace("{}", level * (item.baseValue*100 || 1))}</Text>
                </View>

                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={styles.lvl}>Lvl {level}</Text>
                    {!maxed ? (
                        <Pressable 
                            style={[styles.buyBtn, !canAfford && styles.buyBtnDisabled]}
                            onPress={() => canAfford && buyUniversalConstant(item.id)}
                        >
                            <Text style={styles.costText}>{cost} CE</Text>
                        </Pressable>
                    ) : (
                        <Text style={[styles.costText, {color: '#4ade80'}]}>MAX</Text>
                    )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.resetContainer}>
            <Text style={styles.resetTitle}>BIG BANG RESET</Text>
            <Text style={styles.resetDesc}>
                Current Cycle: Zone {highestZone}
            </Text>
            
            <View style={styles.formulaBox}>
                  <Text style={[styles.fLabel, {color: '#fff', textAlign: 'center'}]}>
                      POTENTIAL ESSENCE GAIN
                  </Text>
                  <Text style={[styles.fVal, {color: '#ef4444', fontSize: 24, textAlign: 'center', marginTop: 4}]}>
                      +{gain}
                  </Text>
            </View>

            <Pressable 
                style={styles.bigBangBtn}
                onPress={onOpenModal}
            >
                <Text style={styles.bigBangBtnText}>INITIATE BIG BANG...</Text>
            </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 74,
    height: 300, // Standard-ish (slightly taller for content)
    borderRadius: 20,
    backgroundColor: "rgba(12, 16, 28, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.3)",
    paddingTop: 12,
    paddingHorizontal: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
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
    fontSize: 12,
    fontWeight: "800",
    color: "#60a5fa",
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  balanceContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  balanceLabel: {
    color: "#60a5fa",
    fontSize: 10,
    fontWeight: "bold",
  },
  balanceValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  tabs: {
      flexDirection: 'row',
      marginBottom: 10,
      gap: 10,
  },
  tab: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
  },
  activeTab: {
      borderBottomColor: '#60a5fa',
  },
  tabText: {
      color: '#ffffff60',
      fontSize: 12,
      fontWeight: 'bold',
  },
  activeTabText: {
      color: '#fff',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
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
    backgroundColor: "rgba(96, 165, 250, 0.15)",
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
    color: "#60a5fa",
    fontSize: 10,
    fontWeight: "600",
  },
  lvl: {
      color: '#ffffff80',
      fontSize: 10,
      fontWeight: 'bold',
  },
  buyBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 50,
    justifyContent: 'center',
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
  resetContainer: {
      padding: 10,
      alignItems: 'center',
  },
  resetTitle: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 4,
  },
  resetDesc: {
      color: '#ffffff80',
      textAlign: 'center',
      fontSize: 12,
      marginBottom: 16,
  },
  formulaBox: {
      width: '100%',
      backgroundColor: 'rgba(0,0,0,0.3)',
      padding: 12,
      borderRadius: 12,
      marginBottom: 20,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  fLabel: {
      color: '#ffffff80',
      fontSize: 12,
  },
  fVal: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 14,
  },
  bigBangBtn: {
      backgroundColor: '#7f1d1d', // Dark Red
      paddingVertical: 12,
      paddingHorizontal: 32,
      borderRadius: 12,
      width: '100%',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#ef4444',
  },
  bigBangBtnText: {
      color: '#f87171',
      fontSize: 14,
      fontWeight: 'bold',
      letterSpacing: 1,
  }
});
