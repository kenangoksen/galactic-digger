
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function UnopenedTagsFab({ count, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    if (count > 0) {
      // Bouncing Animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.0, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scale.setValue(1); // Reset
    }
  }, [count]);

  if (!count || count <= 0) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPress} style={styles.fab} activeOpacity={0.8}>
         <Animated.View style={{ transform: [{ scale }] }}>
            <MaterialCommunityIcons name="treasure-chest" size={32} color="#ffd700" />
            <View style={styles.badge}>
                <Text style={styles.badgeText}>{count}</Text>
            </View>
         </Animated.View>
         <Text style={styles.label}>OPEN!</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 300, 
    right: 16,
    zIndex: 50,
  },
  fab: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#fbbf24',
    shadowColor: "#fbbf24",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  badge: {
     position: 'absolute',
     top: -4,
     right: -4,
     backgroundColor: '#ef4444',
     borderRadius: 10,
     minWidth: 20,
     height: 20,
     alignItems: 'center',
     justifyContent: 'center',
     borderWidth: 1,
     borderColor: '#fff',
     paddingHorizontal: 4
  },
  badgeText: {
     color: '#fff',
     fontSize: 10,
     fontWeight: 'bold',
  },
  label: {
      position: 'absolute',
      bottom: -16,
      color: '#fbbf24',
      fontWeight: 'bold',
      fontSize: 10,
      textShadowColor: 'black',
      textShadowRadius: 2
  }
});
