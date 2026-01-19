import { Image, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { CONFIG, SPRITES } from '../../data/catalog';

export default function GameScreen() {
  const planet = CONFIG.planets[0];
  const drone = CONFIG.drones[0];
  const miner = CONFIG.miners[0];

  return (
    <ImageBackground
      source={require('../../assets/images/backgrounds/bg_space_full.png')}
      style={styles.root}
      resizeMode="cover"
    >
      <Text style={styles.debugTitle}>DESIGN MODE</Text>

      <View style={styles.stage}>
        <Image source={SPRITES.planets[planet.sprite]} style={styles.planet} />
        <Image source={SPRITES.drones[drone.sprite]} style={styles.drone} />
        <Image source={SPRITES.miners[miner.sprite]} style={styles.minerLeft} />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  debugTitle: {
    marginTop: 50,
    textAlign: 'center',
    fontWeight: '800',
    color: 'white',
    fontSize: 18,
  },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  planet: { width: 260, height: 260 },
  drone: { position: 'absolute', top: 160, right: 60, width: 90, height: 90 },
  minerLeft: { position: 'absolute', left: 30, bottom: 220, width: 110, height: 110 },
});
