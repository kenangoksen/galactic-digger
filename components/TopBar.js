import { Image, Pressable, StyleSheet, Text, View } from "react-native";

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
        <Stat icon={icons.mineral} value={fmt(minerals)} />
        <Stat icon={icons.fragment} value={`+${fragments}`} />
        <Stat icon={icons.sword} value={fmt(clickDamage)} />
        <Stat icon={icons.dps} value={fmt(dps)} />

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

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.floor(n).toString();
}
const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 52,
    left: 10,
    right: 10,
    zIndex: 100,          // bottom menülerin üstünde kalsın
  },

  bar: {
    height: 44,           // ⬅️ biraz büyüttük
    borderRadius: 32,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,16,30,0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 12,
  },

  stat: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: -5,
  },

  icon: {
    width: 76,          // ⬅️ büyüdü
    height: 76,
    marginRight: -15,
    resizeMode: "contain",
  },

  value: {
    color: "#FFDFA3",
    fontWeight: "800",
    fontSize: 15,        // ⬅️ büyüdü
  },

  toggle: {
    marginLeft: "auto",
    height: 36,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  toggleImg: {
    width: 84,           // ⬅️ toggle daha net
    height: 34,
    resizeMode: "contain",
  },
});