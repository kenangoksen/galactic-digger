
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// ASSETS
const SHARD_ICON = null; // Placeholder to prevent crash

// IAP PACKS CONFIG
const IAP_PACKS = [
    { id: "iap_tiny", shards: 200, price: "$3", bonus: null },
    { id: "iap_small", shards: 550, price: "$5", bonus: "10% BONUS" },
    { id: "iap_medium", shards: 1150, price: "$15", bonus: "15% BONUS" },
    { id: "iap_large", shards: 2400, price: "$25", bonus: "20% BONUS" },
    { id: "iap_huge", shards: 6250, price: "$75", bonus: "25% BONUS" },
    { id: "iap_giant", shards: 14000, price: "$100", bonus: "40% BONUS" },
];

const SHOP_ITEMS = [
    {
        id: "free_shards_ad",
        type: "FREE",
        name: "FREE SHARDS",
        desc: "Watch a short ad to receive +25 Shards.",
        cost: 0,
        reward: "25 Shards",
        icon: "play-circle",
        color: "#ca8a04",
    },
    {
        id: "auto_tapper",
        type: "AUTO",
        name: "+1 DRONE",
        desc: "Add another Drone (+10 Taps/Sec).",
        cost: 1000, // BASE COST
        reward: "+10 Taps/Sec",
        icon: "hardware-chip",
        color: "#10b981",
        // oneTime removed
    },
    {
        id: "timelapse_menu",
        type: "TIME",
        name: "TIME WARP",
        desc: "Open Time Warp menu.",
        cost: "*",
        reward: "INSTANT GOLD",
        icon: "time",
        color: "#3b82f6",
    },
    {
        id: "pack_tags",
        type: "RESOURCE",
        name: "STARLINK CACHE",
        desc: "Gain +5 Starlink Tags instantly.",
        cost: 500,
        reward: "+5 Tags",
        icon: "star",
        color: "#fbbf24",
    },
    {
        id: "pack_fragments",
        type: "RESOURCE",
        name: "FRAGMENT CACHE",
        desc: "Gain +10 Stellar Fragments instantly.",
        cost: 500,
        reward: "+10 Frags",
        icon: "planet",
        color: "#f472b6",
    },
];

export default function ShardShopSheet({ 
    visible, 
    onClose, 
    shards = 0, 
    buyShopItem, 
    watchAdForShards,
    droneCount = 0,
    totalDps,
    zone = 1,
    step = 1
}) {
    const [isLoadingAd, setIsLoadingAd] = useState(false);
    const [showTimeModal, setShowTimeModal] = useState(false);
    const [showIapModal, setShowIapModal] = useState(false);

    // Helper for IAP
    const handleIapBuy = (pack) => {
        Alert.alert(
            "PURCHASE (MOCK)",
            `Spend ${pack.price} for ${pack.shards} Shards?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "BUY", 
                    onPress: () => {
                        watchAdForShards(pack.shards); 
                        Alert.alert("SUCCESS", `You received ${pack.shards} Shards!`);
                        setShowIapModal(false);
                    } 
                }
            ]
        );
    };

    // Helper for Timelapse Buy
    const buyTimelapse = (hours, cost) => {
        if (__DEV__) console.log("buyTimelapse called with:", { hours, cost, zone, step, totalDps }); // 🔍 Debug Log
        if (shards < cost) {
            Alert.alert("INSUFFICIENT", "Not enough Shards!");
            return;
        }
        if (totalDps <= 0) {
            Alert.alert("ZERO DPS", "You need DPS to warp time!");
            return;
        }
        Alert.alert(
            "CONFIRM TIME WARP",
            `Warp ${hours} Hours for ${cost} Shards?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "WARP",
                    onPress: () => {
                        const payload = { 
                            seconds: hours * 3600, 
                            currentDps: totalDps,
                            currentZone: zone,
                            currentStep: step 
                        };
                        buyShopItem(`timelapse_${hours}h`, cost, payload);
                        setShowTimeModal(false);
                    }
                }
            ]
        );
    };

    const handleBuy = (item) => {
        if (item.id === "timelapse_menu") {
            setShowTimeModal(true);
            return;
        }

        if (item.type === "FREE") {
            // Ad Flow
            Alert.alert(
                "WATCH AD?",
                "Watch a short video to earn +25 Shards?",
                [
                    { text: "Cancel", style: "cancel" },
                    { 
                        text: "WATCH", 
                        onPress: () => {
                            setIsLoadingAd(true);
                            // Mock 2s
                            setTimeout(() => {
                                watchAdForShards(25);
                                setIsLoadingAd(false);
                                Alert.alert("REWARD", "You received +25 Shards!");
                            }, 2000);
                        } 
                    }
                ]
            );
            return;
        }

        // Logic Check
        // if (item.oneTime && autoClickerActive) return; // Removed

        // Dynamic Cost Logic
        let cost = item.cost;
        if (item.id === "auto_tapper") {
            // Formula: 1000 * (1.5 ^ droneCount)
            cost = Math.floor(1000 * Math.pow(1.5, droneCount));
        }

        // Cost Check
        if (shards < cost) {
            Alert.alert("INSUFFICIENT SHARDS", `You need ${cost} Shards.`);
            return;
        }

        // Confirm
        Alert.alert(
            "CONFIRM PURCHASE",
            `Buy ${item.name} for ${cost} Shards?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "BUY", 
                    onPress: () => {
                        // Payload prep
                        let payload = {};
                        if (item.id === "pack_tags") payload = { amount: 5 };
                        if (item.id === "pack_fragments") payload = { amount: 10 };

                        buyShopItem(item.id, cost, payload);
                    } 
                }
            ]
        );
    };

    const renderItem = (item) => {
        let isOwned = false;
        // if (item.id === "auto_tapper" && autoClickerActive) isOwned = true; // Removed

        let cost = item.cost;
        let rewardText = item.reward;
        
        if (item.id === "auto_tapper") {
             // Dynamic Cost
             cost = Math.floor(1000 * Math.pow(1.5, droneCount));
             rewardText = "(+10 Tap/Sec)";
        }

        let canAfford = shards >= cost;
        
        // Custom logic for Time Warp menu (it has variable cost, checking min cost 100)
        if (item.id === "timelapse_menu") {
             canAfford = shards >= 100;
        }

        let isDisabled = isOwned || (item.type !== "FREE" && !canAfford);

        // ✅ EXCEPTION: Time Warp menu is always active (it opens a modal)
        if (item.id === "timelapse_menu") {
            isDisabled = false; 
        }

        return (
            <Pressable
                key={item.id}
                style={[styles.card, isOwned && styles.cardOwned]}
                onPress={() => !isOwned && handleBuy(item)}
                disabled={isDisabled || isLoadingAd}
            >
                <LinearGradient
                    colors={["rgba(30, 41, 59, 0.6)", "rgba(15, 23, 42, 0.8)"]}
                    style={styles.cardGradient}
                >
                    <View style={styles.iconCircle}>
                        <Ionicons name={item.icon} size={16} color={item.color} />
                    </View>
                    
                    <View style={styles.info}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={[styles.rewardText, {color: item.color}]}>{rewardText}</Text>
                    </View>

                    {/* ACTION BUTTON */}
                    <View style={styles.actionBox}>
                         {item.type === "FREE" ? (
                             <View style={styles.priceTagFree}>
                                 {isLoadingAd ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.priceFreeText}>FREE</Text>}
                             </View>
                         ) : isOwned ? (
                             <View style={styles.priceTagOwned}>
                                 <Ionicons name="checkmark" size={14} color="#fff" />
                                 <Text style={styles.priceText}>OWNED</Text>
                             </View>
                         ) : (
                             <View style={[styles.priceTag, !canAfford && styles.priceTagDisabled]}>
                                 <Ionicons name="prism" size={12} color="#fff" style={{marginRight: 4}} />
                                 <Text style={styles.priceText}>{cost}</Text>
                             </View>
                         )}
                    </View>
                </LinearGradient>
            </Pressable>
        );
    };

    return (
        <View style={styles.sheet} pointerEvents="auto">
            {/* HEADER */}
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Ionicons name="prism" size={24} color="#e879f9" />
                    <Text style={styles.title}>SHARD SHOP</Text>
                </View>
                
                <Pressable onPress={onClose} style={styles.closeBtn}>
                   <Ionicons name="close" size={24} color="#fff" />
                </Pressable>
            </View>

            {/* BALANCE */}
            <View style={styles.balanceBar}>
                <Text style={styles.balanceLabel}>BALANCE</Text>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                    <Ionicons name="prism" size={18} color="#e879f9" />
                    <Text style={styles.balanceVal}>{shards}</Text>
                </View>
            </View>

            {/* GET MORE SHARDS BTN */}
            <Pressable 
                style={styles.iapBtn}
                onPress={() => setShowIapModal(true)}
            >
                <LinearGradient
                    colors={["#facc15", "#eab308"]}
                    start={{x: 0, y: 0}} end={{x: 1, y: 0}}
                    style={styles.iapBtnGradient}
                >
                    <Text style={styles.iapBtnText}>GET MORE SHARDS</Text>
                    <Ionicons name="add-circle" size={16} color="#000" />
                </LinearGradient>
            </Pressable>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {/* SECTIONS */}
                <Text style={styles.sectionTitle}>FREE REWARDS</Text>
                <View style={styles.grid}>
                    {SHOP_ITEMS.filter(i => i.type === "FREE").map(renderItem)}
                </View>

                <Text style={styles.sectionTitle}>AUTOMATION</Text>
                <View style={styles.grid}>
                    {SHOP_ITEMS.filter(i => i.type === "AUTO").map(renderItem)}
                </View>

                <Text style={styles.sectionTitle}>TIME WARPS</Text>
                <View style={styles.grid}>
                    {SHOP_ITEMS.filter(i => i.type === "TIME").map(renderItem)}
                </View>

                <Text style={styles.sectionTitle}>RESOURCES</Text>
                <View style={styles.grid}>
                    {SHOP_ITEMS.filter(i => i.type === "RESOURCE").map(renderItem)}
                </View>
            </ScrollView>

            {/* TIMELAPSE MODAL OVERLAY */}
            {showTimeModal && (
                <View style={[StyleSheet.absoluteFill, styles.modalOverlay]}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>TIME WARP</Text>
                            <Pressable onPress={() => setShowTimeModal(false)}>
                                <Ionicons name="close-circle" size={24} color="#ef4444" />
                            </Pressable>
                        </View>
                        <Text style={styles.modalSub}>Forward time instantly based on your DPS.</Text>
                        
                        <View style={styles.modalGrid}>
                             <Pressable style={styles.modalItem} onPress={() => buyTimelapse(8, 100)}>
                                 <Ionicons name="time" size={24} color="#3b82f6" />
                                 <Text style={styles.modalItemTitle}>8 HOURS</Text>
                                 <View style={styles.priceTag}>
                                     <Ionicons name="prism" size={10} color="#fff" />
                                     <Text style={styles.priceText}>100</Text>
                                 </View>
                             </Pressable>
                             <Pressable style={styles.modalItem} onPress={() => buyTimelapse(24, 250)}>
                                 <Ionicons name="timer" size={24} color="#8b5cf6" />
                                 <Text style={styles.modalItemTitle}>24 HOURS</Text>
                                 <View style={styles.priceTag}>
                                     <Ionicons name="prism" size={10} color="#fff" />
                                     <Text style={styles.priceText}>250</Text>
                                 </View>
                             </Pressable>
                             <Pressable style={styles.modalItem} onPress={() => buyTimelapse(48, 450)}>
                                 <Ionicons name="infinite" size={24} color="#ec4899" />
                                 <Text style={styles.modalItemTitle}>48 HOURS</Text>
                                 <View style={styles.priceTag}>
                                     <Ionicons name="prism" size={10} color="#fff" />
                                     <Text style={styles.priceText}>450</Text>
                                 </View>
                             </Pressable>
                        </View>
                    </View>
                </View>
            )}

            {/* IAP MODAL OVERLAY */}
            {showIapModal && (
                <View style={[StyleSheet.absoluteFill, styles.modalOverlay]}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>SHARD STORE</Text>
                            <Pressable onPress={() => setShowIapModal(false)}>
                                <Ionicons name="close-circle" size={24} color="#ef4444" />
                            </Pressable>
                        </View>
                        <Text style={styles.modalSub}>Purchase Shards to accelerate your progress.</Text>
                        
                        <View style={styles.iapGrid}>
                            {IAP_PACKS.map(pack => (
                                <Pressable 
                                    key={pack.id} 
                                    style={styles.iapItem} 
                                    onPress={() => handleIapBuy(pack)}
                                >
                                    {pack.bonus && (
                                        <View style={styles.bonusBadge}>
                                            <Text style={styles.bonusText}>{pack.bonus}</Text>
                                        </View>
                                    )}
                                    <Ionicons name="prism" size={20} color="#e879f9" />
                                    <Text style={styles.iapAmount}>{pack.shards}</Text>
                                    <View style={styles.iapPriceTag}>
                                        <Text style={styles.iapPriceText}>{pack.price}</Text>
                                    </View>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 74,
    height: 280, // Match MinersSheet
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "rgba(12, 16, 28, 0.98)",
    borderTopWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
    paddingTop: 10,
    paddingHorizontal: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
    zIndex: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4, // More compact
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  // headerIcon removed (using icon directly)
  title: {
    fontSize: 10, // Minimal
    fontWeight: "800",
    color: "#e879f9",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  closeBtn: {
    padding: 2,
  },
  balanceBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 6,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.05)',
  },
  balanceLabel: {
      color: '#ffffff60',
      fontSize: 9,
      fontWeight: 'bold',
  },
  balanceVal: {
      color: '#fff',
      fontSize: 13,
      fontWeight: 'bold',
  },
  scroll: {
      flex: 1,
  },
  scrollContent: {
      paddingBottom: 20,
      gap: 2,
  },
  sectionTitle: {
      color: '#ffffff40',
      fontSize: 9,
      fontWeight: 'bold',
      marginTop: 6,
      marginBottom: 2,
      letterSpacing: 0.5,
  },
  grid: {
      gap: 6,
  },
  card: {
      height: 48, // Compact
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
  },
  cardOwned: {
      opacity: 0.6,
      borderColor: '#10b981',
  },
  cardGradient: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      gap: 10,
  },
  iconCircle: {
      width: 28, // Compact
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
  },
  info: {
      flex: 1,
      justifyContent: 'center',
  },
  itemName: {
      color: '#fff',
      fontSize: 11,
      fontWeight: 'bold',
  },
  itemDesc: {
      display: 'none', // Hide desc for minimal mode
  },
  rewardText: {
      fontSize: 9,
      fontWeight: '600',
      color: '#94a3b8',
      // marginTop: 1,
  },
  actionBox: {
      minWidth: 50,
      alignItems: 'flex-end',
  },
  priceTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#2563eb',
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 4,
  },
  priceTagDisabled: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      opacity: 0.5,
  },
  priceTagFree: {
      backgroundColor: '#ca8a04',
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 4,
  },
  priceTagOwned: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#059669',
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 4,
      gap: 2,
  },
  priceText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: 'bold',
  },
  priceFreeText: {
      color: '#000',
      fontSize: 10,
      fontWeight: 'bold',
  },
  // MODAL STYLES
  modalOverlay: {
      backgroundColor: 'rgba(0,0,0,0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 200,
      padding: 20,
  },
  modalContent: {
      width: '100%',
      backgroundColor: 'rgba(15, 23, 42, 1)',
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: '#3b82f6',
  },
  modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
  },
  modalTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#fff',
      letterSpacing: 1,
  },
  modalSub: {
      fontSize: 10,
      color: '#94a3b8',
      marginBottom: 16,
  },
  modalGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
  },
  modalItem: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 8,
      padding: 10,
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
  },
  modalItemTitle: {
      fontSize: 10, // Compact name
      fontWeight: 'bold',
      color: '#cbd5e1',
      textAlign: 'center',
  },
  
  // IAP STYLES
  iapBtn: {
      marginHorizontal: 16,
      marginBottom: 10,
      borderRadius: 8,
      overflow: 'hidden',
  },
  iapBtnGradient: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 6,
  },
  iapBtnText: {
      color: '#000',
      fontWeight: '900',
      fontSize: 12,
  },
  iapGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
  },
  iapItem: {
      width: '31%', // 3 columns
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 8,
      padding: 8,
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: 'rgba(232, 121, 249, 0.3)',
      marginTop: 6, // space for badge
  },
  iapAmount: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 14,
  },
  iapPriceTag: {
      backgroundColor: '#10b981',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      width: '100%',
      alignItems: 'center',
  },
  iapPriceText: {
      color: '#000',
      fontWeight: 'bold',
      fontSize: 11,
  },
  bonusBadge: {
      position: 'absolute',
      top: -8,
      right: -4,
      backgroundColor: '#f43f5e',
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
      zIndex: 10,
  },
  bonusText: {
      color: '#fff',
      fontSize: 8,
      fontWeight: '900',
  },
});
