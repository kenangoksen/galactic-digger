import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, ImageBackground, StyleSheet, Text, View } from 'react-native';

const BG_IMG = require('../assets/images/backgrounds/bg_space_full.png');
const { width } = Dimensions.get('window');

export default function LoadingScreen({ progress = 0, status = "Loading..." }) {
    const barWidth = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(barWidth, {
            toValue: progress, // 0 to 1
            duration: 200, // Smooth out small jumps
            useNativeDriver: false,
        }).start();
    }, [progress]);

    const widthInterp = barWidth.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={styles.container}>
            <ImageBackground source={BG_IMG} style={styles.bg} resizeMode="cover">
                {/* Overlay Curtain */}
                <View style={styles.overlay} />

                <View style={styles.content}>
                    {/* Title Area */}
                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>GALACTIC</Text>
                        <Text style={styles.subtitle}>DIGGER</Text>
                    </View>

                    {/* Loading Bar Area */}
                    <View style={styles.bottomContainer}>
                        <View style={styles.textRow}>
                            <Text style={styles.statusText}>{status}</Text>
                            <Text style={styles.percentText}>{Math.round(progress * 100)}%</Text>
                        </View>
                        
                        <View style={styles.barTrack}>
                            <Animated.View style={[styles.barFill, { width: widthInterp }]}>
                                <LinearGradient
                                    colors={['#fbbf24', '#d97706']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={StyleSheet.absoluteFill}
                                />
                            </Animated.View>
                        </View>
                        
                        <Text style={styles.version}>v1.0.0</Text>
                    </View>
                </View>
            </ImageBackground>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    bg: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)', // Light black curtain
    },
    content: {
        flex: 1,
        width: '100%',
        justifyContent: 'space-between',
        paddingVertical: 80,
        paddingHorizontal: 40,
        alignItems: 'center',
    },
    titleContainer: {
        alignItems: 'center',
        marginTop: 60,
    },
    title: {
        fontSize: 42,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 2,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 10,
    },
    subtitle: {
        fontSize: 42,
        fontWeight: '900',
        color: '#fbbf24', // Gold
        letterSpacing: 2,
        marginTop: -10,
        textShadowColor: 'rgba(251, 191, 36, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
    },
    bottomContainer: {
        width: '100%',
        alignItems: 'center',
    },
    statusText: {
        color: '#cbd5e1',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
        alignSelf: 'flex-start',
        marginLeft: 4,
    },
    textRow: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4, 
    },
    percentText: {
        color: '#fbbf24', // Gold
        fontSize: 14,
        fontWeight: 'bold',
        fontVariant: ['tabular-nums'],
    },
    barTrack: {
        width: '100%',
        height: 12,
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        borderRadius: 6,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    barFill: {
        height: '100%',
        borderRadius: 6,
    },
    version: {
        color: 'rgba(255, 255, 255, 0.3)',
        fontSize: 10,
        marginTop: 20,
    }
});
