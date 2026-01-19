// components/game/MineralTray.js
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { fmt } from "../../game/damage";

const MINERAL_IMG = require("../../assets/images/ui/minerals/mineral_01.png");

export default function MineralTray({ trayCount, onCollect }) {
  return (
    <Pressable style={styles.tray} onPress={onCollect}>
      <View style={styles.trayInner}>
        <Image source={MINERAL_IMG} style={styles.trayIcon} resizeMode="contain" />
        <Text style={styles.trayText}>
          {trayCount > 0 ? `+${fmt(trayCount)}` : "—"}
        </Text>
        <Text style={styles.trayHint}>
          {trayCount > 0 ? "Tap to collect" : "Minerals will drop here"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tray: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 92,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  trayInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  trayIcon: { width: 28, height: 28, opacity: 0.95 },
  trayText: {
    color: "rgba(255,255,255,0.95)",
    fontWeight: "900",
    fontSize: 16,
  },
  trayHint: {
    marginLeft: "auto",
    color: "rgba(255,255,255,0.6)",
    fontWeight: "700",
  },
});
