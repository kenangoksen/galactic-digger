import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function UpgradeCard({
  title = "MINERS",
  subtitle = "Lv. 5",
  stat = "x15",
  price = "1.25K",
  buttonText = "UPGRADE",
  onPress,
}) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{subtitle}</Text>
        </View>
      </View>

      <Text style={styles.stat}>{stat}</Text>

      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.btn}>
        <Text style={styles.btnText}>
          {buttonText}  •  {price}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(10, 14, 28, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 14,
    fontWeight: "900",
    color: "white",
    letterSpacing: 0.6,
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "rgba(255,255,255,0.85)",
  },
  stat: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: "900",
    color: "white",
  },
  btn: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(90, 255, 180, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(90, 255, 180, 0.35)",
  },
  btnText: {
    fontSize: 13,
    fontWeight: "900",
    color: "white",
    letterSpacing: 0.4,
  },
});
