// components/ZoneSwitcher.js
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, StyleSheet, View } from "react-native";

// PNG yollarını sen koyacaksın:
const ICON_ARROW_LEFT = require("../assets/images/ui/zone/arrow_left.png");
const ICON_ARROW_RIGHT = require("../assets/images/ui/zone/arrow_right.png");
const ICON_PLANET = require("../assets/images/ui/zone/zone_planet.png"); // tek planet png

export default function ZoneSwitcher({
  zone = 1,                 // aktif zone
  maxUnlockedZone = 1,      // oyuncunun açtığı en ileri zone
  onPrev,
  onNext,
}) {
  const hasPrev = zone > 1;
  const hasNext = zone < maxUnlockedZone;

  // slotlarda hangi zone’lar gösterilecek
  const prevZone = zone - 1;
  const nextZone = zone + 1;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <LinearGradient
        colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.55)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.frame}
      >
        {/* LEFT ARROW */}
        <Pressable
          onPress={hasPrev ? onPrev : undefined}
          disabled={!hasPrev}
          style={[styles.arrowBtn, !hasPrev && styles.disabled]}
          hitSlop={12}
        >
          <Ionicons name="caret-back" size={24} color={hasPrev ? "#fff" : "rgba(255,255,255,0.2)"} />
        </Pressable>

        {/* ZONES */}
        <View style={styles.zones}>
          {/* PREV */}
          <ZoneSlot kind="side" enabled={hasPrev} labelZone={prevZone} />

          {/* ACTIVE */}
          <ZoneSlot kind="active" enabled labelZone={zone} />

          {/* NEXT */}
          <ZoneSlot kind="side" enabled={hasNext} labelZone={nextZone} />
        </View>

        {/* RIGHT ARROW */}
        <Pressable
          onPress={hasNext ? onNext : undefined}
          disabled={!hasNext}
          style={[styles.arrowBtn, !hasNext && styles.disabled]}
          hitSlop={12}
        >
          <Ionicons name="caret-forward" size={24} color={hasNext ? "#fff" : "rgba(255,255,255,0.2)"} />
        </Pressable>
      </LinearGradient>
    </View>
  );
}

function ZoneSlot({ kind = "side", enabled = false }) {
  const isActive = kind === "active";

  return (
    <View style={[styles.slot, isActive && styles.slotActive]}>
      <Image
        source={ICON_PLANET}
        style={[
          styles.planet,
          isActive ? styles.planetActive : styles.planetBW,
          !enabled && styles.planetHidden, // “açık değilse” neredeyse görünmesin
        ]}
      />
      {/* İstersen altına küçük yazı sonra ekleriz (zone numarası vs). Şimdilik yok. */}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 116, // TopBar yüksekliğine göre ayarla (gerekirse 4-8 px oynatırız)
    left: 0,
    right: 0,
    zIndex: 30,
    alignItems: "center",
  },

  frame: {
    width: "100%",
    height: 44,
    maxWidth: 320,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  arrowBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowIcon: {
    width: 178,
    height: 178,
    resizeMode: "contain",
    opacity: 0.95,
  },

  disabled: { opacity: 0.35 },

  zones: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  slot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  slotActive: {
    width: 44,
    height: 44,
    borderRadius: 18,
    borderColor: "rgba(255,235,195,0.35)",
    backgroundColor: "rgba(255,235,195,0.06)",
  },

  planet: {
    width: 108,
    height: 108,
    resizeMode: "contain",
  },

  planetActive: {
    opacity: 1,
  },

  // “Siyah-beyaz filtre” görünümü:
  // tintColor + opacity kombinasyonu pratikte desaturate hissi verir.
  planetBW: {
    tintColor: "rgba(255,255,255,0.85)",
    opacity: 0.40,
  },

  // “ileri seviye yoksa” sağ slot neredeyse görünmesin
  planetHidden: {
    opacity: 0.10,
  },
});
