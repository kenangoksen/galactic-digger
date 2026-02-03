import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function SettingsSheet({ onClose, onReset, onStats }) {
  return (
    <View style={styles.container}>
      {/* ... header ... */}
      <View style={styles.header}>
        {/* ... */}
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>GAME DATA</Text>

        <View style={styles.row}>
           {/* STATISTICS */}
           <View style={styles.itemContainer}>
            <Pressable
              onPress={onStats}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
              ]}
            >
              <LinearGradient
                colors={["#00e676", "#00994d"]}
                style={styles.gradientBg}
              >
                <MaterialCommunityIcons
                  name="chart-bar"
                  size={32}
                  color="white"
                />
              </LinearGradient>
            </Pressable>
            <Text style={styles.itemLabel}>STATS</Text>
          </View>

          {/* Reset Button (Icon Style) */}
          <View style={styles.itemContainer}>
            <Pressable
              onPress={onReset}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
              ]}
            >
              <LinearGradient
                colors={["#ff4d4d", "#b30000"]}
                style={styles.gradientBg}
              >
                <MaterialCommunityIcons
                  name="alert-octagon"
                  size={32}
                  color="white"
                />
              </LinearGradient>
            </Pressable>
            <Text style={styles.itemLabel}>RESET</Text>
          </View>

          {/* Placeholder for Sound */}
          <View style={styles.itemContainer}>
            <Pressable style={styles.iconBtn}>
              <LinearGradient
                colors={["#4d79ff", "#002db3"]}
                style={styles.gradientBg}
              >
                <MaterialCommunityIcons
                  name="volume-high"
                  size={32}
                  color="white"
                />
              </LinearGradient>
            </Pressable>
            <Text style={styles.itemLabel}>SOUND</Text>
          </View>

           {/* Placeholder for FX */}
           <View style={styles.itemContainer}>
            <Pressable style={styles.iconBtn}>
              <LinearGradient
                colors={["#b380ff", "#5900b3"]}
                style={styles.gradientBg}
              >
                <MaterialCommunityIcons
                   name="star-four-points"
                  size={32}
                  color="white"
                />
              </LinearGradient>
            </Pressable>
            <Text style={styles.itemLabel}>FX</Text>
          </View>
        </View>

        <View style={styles.divider} />
        
        <Text style={styles.version}>v1.0.0 • Galactic Digger</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(100, 200, 255, 0.15)",
    backgroundColor: "rgba(10, 12, 24, 0.95)",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#e0e0e0",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  row: {
    flexDirection: "row",
    gap: 24,
  },
  itemContainer: {
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
    shadowColor: "black",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  gradientBg: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabel: {
    color: "#ccc",
    fontSize: 12,
    fontWeight: "700",
  },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 30,
  },
  version: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 11,
    fontWeight: "600",
  },
});
