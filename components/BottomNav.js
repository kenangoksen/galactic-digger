// components/BottomNav.js
import { Image, Pressable, StyleSheet, View } from "react-native";

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
  onCosmic,
  onBigBang,
  onShop,
  onProtocols,
}) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {/* MINERS */}
        <Pressable onPress={onMiners} style={styles.btnWrap}>
          <View style={styles.btn}>
            <Image
              source={require("../assets/images/ui/bottom/miners.png")}
              style={styles.icon}
            />
          </View>
        </Pressable>

        {/* SKILLS */}
        <Pressable onPress={onSkills} style={styles.btn}>
          <View>
            <Image
              source={require("../assets/images/ui/bottom/skills.png")}
              style={styles.icon}
            />
          </View>
        </Pressable>

        {/* GEM SHOP */}
        <Pressable onPress={onShop} style={styles.btn}>
          <Image
            source={require("../assets/images/ui/bottom/gem.png")}
            style={styles.icon}
          />
        </Pressable>

        {/* QUESTS */}
        <Pressable onPress={onQuests} style={styles.btn}>
          <Image
            source={require("../assets/images/ui/bottom/quests.png")}
            style={styles.icon}
          />
        </Pressable>

        {/* COSMIC PROTOCOL */}
        <Pressable onPress={onProtocols} style={styles.btn}>
          <Image
            source={require("../assets/images/ui/bottom/cosmic_protocol.png")}
            style={styles.icon}
          />
        </Pressable>

        {/* BIG BANG */}
        <Pressable onPress={onBigBang} style={styles.btn}>
          <Image
            source={require("../assets/images/ui/bottom/bigbang.png")}
            style={styles.icon}
          />
        </Pressable>
      </View>
    </View>
  );
}

function NavBtn({ icon, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.btn}>
      <Image source={icon} style={styles.icon} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  // dış alan tamamen transparan
  wrapper: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 90,
  },

  // asıl bottom bar (orta kutu)
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12, // ikonlar birbirine yakın

    paddingHorizontal: 18,
    paddingVertical: 10,

    borderRadius: 22,
    backgroundColor: "rgba(18,14,28,0.88)", // hafif koyu
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  btnWrap: {},
  btn: {
    width: 42,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  icon: {
    width: 90,
    height: 90,
    resizeMode: "contain",
  },
});
