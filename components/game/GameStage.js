// components/game/GameStage.js
import { Animated, Pressable, StyleSheet, View } from "react-native";
import SpriteAnimation from "../ui/SpriteAnimation";
import BossBar from "./BossBar";
import HpBarCompact from "./HpBarCompact";

export default function GameStage({
  planetImg,
  planetData, // New prop for animation metadata
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
  activeDroneCount,
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
          <Animated.View
            style={[
              styles.miner,
              {
                // Override dimensions for the large sprite
                width: 192, 
                height: 1024,
                // Adjust centering offset since dimensions changed?
                // styles.miner uses top:50%, left:50% which centers the top-left corner usually?
                // No, usually requires marginTop: -height/2.
                // styles.miner doesn't have margin offsets. It assumes simple placement.
                // Actually styles.miner has top: 50%, left: 50%.
                // To center it, RN default anchor is top-left.
                // So (0,0) of view is at 50%,50% of parent.
                // We likely need `marginTop: -512`, `marginLeft: -96`.
                marginTop: -512,
                marginLeft: -96,
                
                transform: [
                  { translateX: -50 }, // Moved Right (was -85)
                  { translateY: -55 }, // Moved Down (was -90)
                  { rotate: "-15deg" }, // Adjusted rotation
                  { scale: 0.15625 }, // 1024 * 0.15625 = 160px exact
                ],
              },
            ]}
          >
             <SpriteAnimation 
                source={require("../../assets/images/sprites/miners/miner_animate.png")}
                frameWidth={192}
                frameHeight={1024}
                frameCount={8}
                framesToPlay={5} // Skip last 3 frames (Play 0-4)
                fps={8}
             />
          </Animated.View>

          {/* drone */}
          {/* drone */}
          {(activeDroneCount > 0) && (
             <View style={{
                 position: 'absolute',
                 width: 120, height: 120,
                 top: '50%', left: '50%',
                 zIndex: 4, elevation: 4,
                 pointerEvents: 'none' // Click through to planet
             }}>
                <Animated.Image
                    source={require("../../assets/images/sprites/drones/drone_01.png")}
                    style={[
                    styles.drone,
                    {
                        // Reset absolute positioning in style since we wrapped it
                        top: 0, left: 0,
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
                
                {/* Active Count Badge */}
                <Animated.View style={{
                    position: 'absolute',
                    top: 0, 
                    left: 0,
                    transform: [
                        { translateX: 40 }, // Offset relative to wrapper
                        { translateY: -170 } // Near drone
                    ],
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#10b981',
                }}>
                    <Animated.Text style={{
                        color: '#fff', fontSize: 10, fontWeight: 'bold'
                    }}>
                        {activeDroneCount}x
                    </Animated.Text>
                </Animated.View>
             </View>
          )}

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
    width: 120,
    height: 120,
    // Positioning handled by wrapper view
  },

  hpDock: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    alignItems: "center",
    transform: [{ translateY: 85 }], // Moved closer to planet (was 95)
    zIndex: 10,
  },
  zenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 5, 20, 0.4)', // Dimming
    zIndex: 2, // Above planet, below UI
    borderRadius: 300, // Circular mask attempt? Or full? full is fine for flavor
  },
});
