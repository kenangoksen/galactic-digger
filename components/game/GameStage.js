// components/game/GameStage.js
import { Animated, Pressable, StyleSheet, View } from "react-native";
import BossBar from "./BossBar";
import HpBarCompact from "./HpBarCompact";

export default function GameStage({
  planetImg,
  stageTranslateY,
  stageScale = 1, // default
  puffScale,
  puffOpacity,
  planetSquash,
  hover,
  minerIdle,
  floaters,
  onTap,

  zoneText,
  hp,
  maxHp,
  bossMsLeft,

  isBossPlanet, // ⬅️ engine’den geliyor
  isPrimal, // 🟣
  isIdle,
  activeProtocols, // { "silent_observer": 5, ... }
}) {
  const hasZenMode = isIdle && (activeProtocols?.['silent_observer'] || 0) > 0;
  const hasHighEnergy = (activeProtocols?.['photon_strike_matrix'] || 0) > 0;
  return (
    <Animated.View
      style={{
        flex: 1,
        transform: [{ translateY: stageTranslateY }, { scale: stageScale }],
      }}
    >
      <Pressable style={styles.stagePress} onPress={onTap}>
        <View style={styles.stage} pointerEvents="none">
          {/* Zen Mode Overlay */}
           {hasZenMode && (
              <Animated.View style={styles.zenOverlay} />
           )}

          {/* puff */}
          <Animated.View
            style={[
              styles.puff,
              { transform: [{ scale: puffScale }], opacity: puffOpacity },
            ]}
          />

          {/* FLOATERS */}
          {(floaters || []).map((f) => {
            const translateX = f.t.interpolate({
              inputRange: [0, 1],
              outputRange: [f.baseX, f.baseX + 28],
            });

            const translateY = f.t.interpolate({
              inputRange: [0, 0.35, 1],
              outputRange: [f.baseY, f.baseY - 28, f.baseY + 18],
            });

            const opacity = f.t.interpolate({
              inputRange: [0, 0.15, 0.8, 1],
              outputRange: [0, 1, 1, 0],
            });

            const rotate = f.t.interpolate({
              inputRange: [0, 1],
              outputRange: ["-12deg", "14deg"],
            });

            const scale = f.t.interpolate({
              inputRange: [0, 0.2, 1],
              outputRange: [0.85, 1.05, 0.95],
            });

            return (
              <Animated.Text
                key={f.id}
                style={[
                  styles.tapDmg,
                  {
                    opacity,
                    transform: [
                      { translateX },
                      { translateY },
                      { rotate },
                      { scale },
                    ],
                  },
                ]}
              >
                {f.value}
              </Animated.Text>
            );
          })}

          {/* planet */}
          <Animated.Image
            source={planetImg}
            style={[
              styles.planet,
              {
                transform: [
                  {
                    scaleX: planetSquash.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1.1, 1.035],
                    }),
                  },
                  {
                    scaleY: planetSquash.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1.1, 0.975],
                    }),
                  },
                ],
              },
            ]}
            resizeMode="contain"
          />

          {/* =======================
              HP BAR (planet altı)
              ======================= */}
          <View style={styles.hpDock}>
            {isBossPlanet ? (
              <BossBar hp={hp} maxHp={maxHp} timeMs={bossMsLeft} isPrimal={isPrimal} />
            ) : (
              <HpBarCompact zoneText={zoneText} hp={hp} maxHp={maxHp} />
            )}
          </View>

          {/* miner */}
          <Animated.Image
            source={require("../../assets/images/sprites/miners/miner_01.png")}
            style={[
              styles.miner,
              {
                transform: [
                  { translateX: -145 },
                  {
                    translateY: minerIdle.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-135, -129],
                    }),
                  },
                  { rotate: "-24deg" },
                ],
              },
            ]}
            resizeMode="contain"
          />

          {/* drone */}
          <Animated.Image
            source={require("../../assets/images/sprites/drones/drone_01.png")}
            style={[
              styles.drone,
              {
                transform: [
                  { translateX: -45 },
                  {
                    translateY: hover.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-160, -172],
                    }),
                  },
                  {
                    rotate: hover.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["1deg", "-1deg"],
                    }),
                  },
                ],
              },
            ]}
            resizeMode="contain"
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stagePress: { flex: 1 },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },

  puff: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: "rgba(255, 235, 195, 0.85)",
  },

  tapDmg: {
    position: "absolute",
    zIndex: 50,
    elevation: 50,
    color: "rgba(255,245,235,0.98)",
    fontWeight: "900",
    fontSize: 18,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 2 },
  },

  planet: { width: 300, height: 300, zIndex: 1 },

  miner: {
    position: "absolute",
    width: 160,
    height: 160,
    top: "50%",
    left: "50%",
    zIndex: 3,
    elevation: 3,
  },

  drone: {
    position: "absolute",
    width: 120,
    height: 120,
    top: "50%",
    left: "50%",
    zIndex: 4,
    elevation: 4,
  },

  hpDock: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    alignItems: "center",
    transform: [{ translateY: 120 }],
    zIndex: 10,
  },
  zenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 5, 20, 0.4)', // Dimming
    zIndex: 2, // Above planet, below UI
    borderRadius: 300, // Circular mask attempt? Or full? full is fine for flavor
  },
});
