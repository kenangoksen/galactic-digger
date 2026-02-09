import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet } from "react-native";

export default function ClickableItem({
  item, // { id, type, x, y, createdAt, expiresAt }
  onPress, // (item) => void
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // 1. Entrance & Float Loop
  useEffect(() => {
    // Fade In
    Animated.timing(opacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Bobbing Animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -10,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Force fade out before expiry? 
    // Engine handles hard removal, but we can do visual fade out if we know TTL.
    // TTL is 8s. Let's fade out at 7.5s.
    const ttl = item.expiresAt - Date.now();
    const fadeOutDelay = Math.max(0, ttl - 500);
    
    const timer = setTimeout(() => {
         Animated.timing(opacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
         }).start();
    }, fadeOutDelay);

    return () => clearTimeout(timer);
  }, []);

  const handlePress = () => {
      // Pop animation or just callback?
      onPress(item);
  };

  // Config based on Type
  const isComet = item.type === "COMET";
  const iconName = isComet ? "star-shooting" : "trash-can"; // or "rocket", "satellite-uplink"
  const iconColor = isComet ? "#fbbf24" : "#94a3b8"; // Gold vs Slate-400
  const iconSize = isComet ? 48 : 42; 

  // Position
  // x, y are 0..1 relative to container
  // We need to allow absolute positioning usage by parent? 
  // No, we can use percentages here if parent is flex:1 relative.
  
  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          left: `${item.x * 100}%`,
          top: `${item.y * 100}%`,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable onPress={handlePress} style={styles.touchArea}>
          {/* Glow for Comet */}
          {isComet && (
              <Animated.View style={styles.glow} />
          )}
          <MaterialCommunityIcons name={iconName} size={iconSize} color={iconColor} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    zIndex: 999, // Top of stage
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchArea: {
      padding: 10, // Hitbox padding
      alignItems: 'center',
      justifyContent: 'center',
  },
  glow: {
      position: 'absolute',
      width: 60, height: 60,
      borderRadius: 30,
      backgroundColor: 'rgba(251, 191, 36, 0.3)', // Amber glow
      zIndex: -1,
  }
});
