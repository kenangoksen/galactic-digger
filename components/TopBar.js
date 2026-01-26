import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { fmtD } from "../game/bn";

const icons = {
  mineral: require("../assets/images/ui/topbar/mineral.png"),
  fragment: require("../assets/images/ui/topbar/fragment.png"),
  sword: require("../assets/images/ui/topbar/sword.png"),
  dps: require("../assets/images/ui/topbar/dps.png"),
  click: require("../assets/images/ui/topbar/toggle_click.png"),
  idle: require("../assets/images/ui/topbar/toggle_idle.png"),
};

export default function TopBar({
  minerals = 0,
  fragments = 0,
  clickDamage = 0,
  dps = 0,
  mode = "click", // "click" | "idle"
  onToggleMode,
}) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        <Stat icon={icons.mineral} value={fmtD(minerals)} />
        <Stat icon={icons.fragment} value={`+${fragments}`} />
        <Stat icon={icons.sword} value={fmtD(clickDamage)} />
        <Stat icon={icons.dps} value={fmtD(dps)} />

        <Pressable onPress={onToggleMode} style={styles.toggle}>
          <Image
            source={mode === "click" ? icons.click : icons.idle}
            style={styles.toggleImg}
          />
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ icon, value }) {
  return (
    <View style={styles.stat}>
      <Image source={icon} style={styles.icon} />
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 52,
    left: 10,
    right: 10,
    zIndex: 100,
  },

  bar: {
    height: 44,
    borderRadius: 32,
    paddingHorizontal: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  icon: {
    width: 18,
    height: 18,
    resizeMode: "contain",
  },

  value: {
    color: "rgba(255,255,255,0.92)",
    fontWeight: "900",
    fontSize: 13,
  },

  toggle: {
    width: 42,
    height: 30,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  toggleImg: {
    width: 22,
    height: 22,
    resizeMode: "contain",
  },
});
