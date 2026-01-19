import { ImageBackground, StyleSheet, Text, View } from "react-native";

export default function Index() {
  return (
    <ImageBackground
      source={require("../assets/images/backgrounds/bg_space_full.png")}
      style={styles.root}
      resizeMode="cover"
    >
      <View style={styles.center}>
        <Text style={styles.title}>Galactic Digger</Text>
        <Text style={styles.sub}>Design Mode</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { color: "white", fontSize: 28, fontWeight: "800" },
  sub: { color: "white", opacity: 0.8, marginTop: 8 }
});
