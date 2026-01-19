// components/SideBarLeft.js
import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, StyleSheet, View } from "react-native";

const ICONS = {
  settings: require("../assets/images/ui/side/settings.png"),
  achievements: require("../assets/images/ui/side/achievements.png"),
  relics: require("../assets/images/ui/side/relics.png"),
  clan: require("../assets/images/ui/side/clan.png"),
};

export default function SideBarLeft({
  onSettings,
  onAchievements,
  onRelics,
  onClan,
}) {
  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={[
          "rgba(255,255,255,0.02)", // sol: neredeyse şeffaf
          "rgba(20,16,32,0.65)", // sağ: koyu
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.container}
      >
        <SideBtn icon={ICONS.settings} onPress={onSettings} />
        <SideBtn icon={ICONS.achievements} onPress={onAchievements} />
        <SideBtn icon={ICONS.relics} onPress={onRelics} />
        <SideBtn icon={ICONS.clan} onPress={onClan} />
      </LinearGradient>
    </View>
  );
}

function SideBtn({ icon, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.btn}>
      <Image source={icon} style={styles.icon} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    top: 184, // 👈 TopBar yüksekliği kadar
    width: 56,
    paddingVertical: 12,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    overflow: "hidden",
  },

  container: {
    paddingVertical: 1,
    paddingRight: 0,
    paddingLeft: 8,

    gap: 12,

    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,

    // sadece sağ taraf border
    borderRightWidth: 5,
    borderColor: "rgba(255,255,255,0.18)",
  },

  btn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  icon: {
    width: 100,
    height: 100,
    resizeMode: "contain",
  },
});
