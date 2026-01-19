// components/game/GameStage.js
import { Animated, Pressable, StyleSheet, View } from "react-native";
import HpBarCompact from "./HpBarCompact";

export default function GameStage({
  planetImg,
  stageTranslateY,
  puffScale,
  puffOpacity,
  planetSquash,
  hover,
  minerIdle,
  floaters,
  onTap,
  hpPct = 1,
  hpText = "",
  bossTimeText = "",
  planetLevelText = "",
  zoneText,
  hp,
  maxHp,
  bossMsLeft,
}) {
  const pct = Math.max(0, Math.min(1, Number(hpPct || 0)));

  return (
    <Animated.View
      style={{ flex: 1, transform: [{ translateY: stageTranslateY }] }}
    >
      <Pressable style={styles.stagePress} onPress={onTap}>
        <View style={styles.stage} pointerEvents="none">
          {/* puff */}
          <Animated.View
            style={[
              styles.puff,
              { transform: [{ scale: puffScale }], opacity: puffOpacity },
            ]}
          />

          {/* floaters */}
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
          {/* HP BAR (planet altı) */}
          <View style={styles.hpDock}>
            <HpBarCompact
              zoneText={zoneText}
              hp={hp}
              maxHp={maxHp}
              bossMsLeft={bossMsLeft}
            />
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

  hpWrap: {
    position: "absolute",
    top: "50%",
    marginTop: 138, // planet altına yakın
    left: 22,
    right: 22,
    gap: 6,
  },

  zoneTxt: {
    color: "rgba(255,255,255,0.70)",
    fontWeight: "900",
    textAlign: "center",
    fontSize: 12,
  },

  hpBar: {
    height: 10,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  hpFill: {
    height: "100%",
    backgroundColor: "rgba(255,235,195,0.92)",
  },

  hpTxt: {
    color: "rgba(255,255,255,0.70)",
    fontWeight: "900",
    textAlign: "center",
    fontSize: 12,
  },

  bossTxt: {
    color: "rgba(255,255,255,0.70)",
    fontWeight: "900",
    textAlign: "center",
    fontSize: 12,
  },
  hpDock: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    alignItems: "center",
    // planetin altına yaklaştır:
    transform: [{ translateY: 120 }], // <<< burayı 110-135 arası oynatırız
    zIndex: 10,
  },
});
