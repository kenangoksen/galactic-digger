import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import { Image } from 'react-native';

// Exhaustive list of game images for preloading
const IMAGES = [
    // Backgrounds
    require('../assets/images/backgrounds/bg_space_full.png'),
    require('../assets/images/backgrounds/bg_space1_full.png'),
    require('../assets/images/backgrounds/bg_space_2full.png'),
    require('../assets/images/loading_screen.png'), 

    // Boss Planet BG
    require('../assets/images/sprites/boss_bg/backgrounds.png'),

    // Planets
    require('../assets/images/sprites/planets/planet_01.png'),
    require('../assets/images/sprites/planets/planet_02.png'),
    require('../assets/images/sprites/planets/planet_03.png'),
    require('../assets/images/sprites/planets/planet_04.png'),
    require('../assets/images/sprites/planets/planet_05.png'),
    require('../assets/images/sprites/planets/planet_06.png'),
    require('../assets/images/sprites/planets/planet_07.png'),
    require('../assets/images/sprites/planets/planet_08.png'),
    require('../assets/images/sprites/planets/planet_09.png'),
    require('../assets/images/sprites/planets/planet_10.png'),
    require('../assets/images/sprites/planets/planet_11.png'),
    require('../assets/images/sprites/planets/planet_12.png'),
    require('../assets/images/sprites/planets/planet_13.png'),
    require('../assets/images/sprites/planets/planet_14.png'),
    require('../assets/images/sprites/planets/planet_15.png'),
    require('../assets/images/sprites/planets/planet_16.png'),
    require('../assets/images/sprites/planets/planet_17.png'),
    require('../assets/images/sprites/planets/planet_18.png'),
    require('../assets/images/sprites/planets/planet_19.png'),

    // Bosses
    require('../assets/images/sprites/boss_planet/boss_01.png'),
    require('../assets/images/sprites/boss_planet/boss_02.png'),
    require('../assets/images/sprites/boss_planet/boss_03.png'),
    require('../assets/images/sprites/boss_planet/boss_04.png'),

    // Miners (1-20)
    require('../assets/images/sprites/miners/miner_01.png'),
    // require('../assets/images/sprites/miners/miner_02.png'),
    // require('../assets/images/sprites/miners/miner_03.png'),
    // require('../assets/images/sprites/miners/miner_04.png'),
    // require('../assets/images/sprites/miners/miner_05.png'),
    // require('../assets/images/sprites/miners/miner_06.png'),
    // require('../assets/images/sprites/miners/miner_07.png'),
    // require('../assets/images/sprites/miners/miner_08.png'),
    // require('../assets/images/sprites/miners/miner_09.png'),
    // require('../assets/images/sprites/miners/miner_10.png'),
    // require('../assets/images/sprites/miners/miner_11.png'),
    // require('../assets/images/sprites/miners/miner_12.png'),
    // require('../assets/images/sprites/miners/miner_13.png'),
    // require('../assets/images/sprites/miners/miner_14.png'),
    // require('../assets/images/sprites/miners/miner_15.png'),
    // require('../assets/images/sprites/miners/miner_16.png'),
    // require('../assets/images/sprites/miners/miner_17.png'),
    // require('../assets/images/sprites/miners/miner_18.png'),
    // require('../assets/images/sprites/miners/miner_19.png'),
    // require('../assets/images/sprites/miners/miner_20.png'),

    // Drones
    require('../assets/images/sprites/drones/drone_01.png'),

    // UI Icons - Minerals
    require('../assets/images/ui/minerals/mineral_01.png'),
    // require('../assets/images/ui/minerals/mineral_02.png'),
    // require('../assets/images/ui/minerals/mineral_03.png'),
    // require('../assets/images/ui/minerals/mineral_04.png'),
    // require('../assets/images/ui/minerals/mineral_05.png'),
    // require('../assets/images/ui/minerals/mineral_06.png'),

    // UI Icons - Top Bar
    require('../assets/images/ui/topbar/dps.png'),
    require('../assets/images/ui/topbar/fragment.png'),
    require('../assets/images/ui/topbar/mineral.png'),
    require('../assets/images/ui/topbar/sword.png'),
    require('../assets/images/ui/topbar/toggle_click.png'),
    require('../assets/images/ui/topbar/toggle_idle.png'),
    
    // UI Icons - Bottom Nav
    require('../assets/images/ui/bottom/miners.png'),
    require('../assets/images/ui/bottom/skills.png'),
    require('../assets/images/ui/bottom/quests.png'),
    require('../assets/images/ui/bottom/cosmic_protocol.png'),
    require('../assets/images/ui/bottom/bigbang.png'),
    require('../assets/images/ui/bottom/gem.png'),
    
    // UI Icons - Side
    require('../assets/images/ui/side/settings.png'),
    require('../assets/images/ui/side/achievements.png'),
    require('../assets/images/ui/side/relics.png'),
    require('../assets/images/ui/side/clan.png'),

    // UI Zone
    require('../assets/images/ui/zone/arrow_left.png'),
    require('../assets/images/ui/zone/arrow_right.png'),
    require('../assets/images/ui/zone/zone_planet.png'),

    // Misc
    require('../assets/images/icon.png'),
];

// Cache Fonts
export const cacheFonts = (fonts) => {
    return fonts.map(font => Font.loadAsync(font));
};

// Cache Images
export const cacheImages = (images) => {
    return images.map(image => {
        if (typeof image === 'string') {
            return Image.prefetch(image);
        } else {
            return Asset.fromModule(image).downloadAsync();
        }
    });
};

export const loadAssetsAsync = async (onProgress) => {
    const fontAssets = cacheFonts([Ionicons.font, MaterialCommunityIcons.font]);
    const imageAssets = cacheImages(IMAGES);

    const total = fontAssets.length + imageAssets.length;
    let loaded = 0;

    const allPromises = [...fontAssets, ...imageAssets].map(p => 
        p.then(() => {
            loaded++;
            if (onProgress) onProgress(loaded / total);
        })
    );

    await Promise.all(allPromises);
};
