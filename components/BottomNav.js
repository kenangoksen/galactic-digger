// components/BottomNav.js
import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

const ICONS = {
  miners: require("../assets/images/ui/bottom/miners.png"),
  skills: require("../assets/images/ui/bottom/skills.png"),
  gem: require("../assets/images/ui/bottom/gem.png"),
  quests: require("../assets/images/ui/bottom/quests.png"),
  cosmic: require("../assets/images/ui/bottom/cosmic_protocol.png"),
  bigbang: require("../assets/images/ui/bottom/bigbang.png"),
};

export default function BottomNav({
  onMiners,
  onSkills,
  onGem,
  onQuests,
  onProtocols,
  onBigBang,
  onShop,
}) {

  const NAV_ITEMS = [
    { key: "miners", label: "Miners", icon: ICONS.miners, action: onMiners },
    { key: "skills", label: "Skills", icon: ICONS.skills, action: onSkills },
    { key: "gem", label: "Shop", icon: ICONS.gem, action: onShop }, // Mapped to onShop as per existing code
    { key: "quests", label: "Quests", icon: ICONS.quests, action: onQuests },
    { key: "cosmic", label: "Cosmic", icon: ICONS.cosmic, action: onProtocols },
    { key: "bigbang", label: "Big Bang", icon: ICONS.bigbang, action: onBigBang },
  ];

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={["rgba(18, 14, 28, 0.95)", "rgba(10, 8, 20, 0.98)"]}
        style={styles.container}
      >
        {NAV_ITEMS.map((item) => (
          <NavItem 
            key={item.key} 
            item={item} 
          />
        ))}
      </LinearGradient>
    </View>
  );
}

function NavItem({ item }) {
  return (
    <Pressable 
      onPress={item.action} 
      style={({ pressed }) => [
        styles.btn, 
        pressed && styles.btnPressed
      ]}
    >
      <View style={styles.iconContainer}>
        <Image source={item.icon} style={styles.icon} />
      </View>
      <Text style={styles.label}>{item.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
   
  btn: {
    alignItems: "center",
    justifyContent: "center",
    width: 50,
    height: 50,
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }]
  },

  iconContainer: {
    width: 48,
    height: 48,
    justifyContent: "center", 
    alignItems: "center",
  },
 
  wrapper: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 90,
  },

  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4, 

    paddingHorizontal: 12,
    paddingVertical: 3,

    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)", // Gold tint border
    backgroundColor: "rgba(10, 8, 20, 0.95)", // Handle alpha here too if LinearGradient covers it
    
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },

  btn: {
    alignItems: "center",
    justifyContent: "center",
    width: 60, // Wider to accommodate badge width
    height: 60,
  },
  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }]
  },

  iconContainer: {
    width: 54, // Large Icons
    height: 54,
    justifyContent: "center", 
    alignItems: "center",
  },

  icon: {
    width: 90,
    height: 90,
    resizeMode: "contain",
  },

  // Badge Style Label
  label: {
    position: "absolute",
    bottom: 2, // Overlap the bottom of the icon
    backgroundColor: "#1e1b4b", // Deep Indigo/Dark
    color: "#fcd34d", // Lighter Gold
    fontSize: 7,
    fontWeight: "800",
    textTransform: "uppercase",
    textAlign: "center",
    
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ca8a04",
    overflow: 'hidden',
    minWidth: 50,
    
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 20,
  },
});
