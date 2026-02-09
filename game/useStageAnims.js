// game/useStageAnims.js
import { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

export function useStageAnims() {
  // loops
  const hover = useRef(new Animated.Value(0)).current;
  const minerIdle = useRef(new Animated.Value(0)).current;

  // tap feedback
  const puffScale = useRef(new Animated.Value(0)).current;
  const puffOpacity = useRef(new Animated.Value(0)).current;
  const planetSquash = useRef(new Animated.Value(0)).current;

  // floaters
  const [floaters, setFloaters] = useState([]);
  const floaterId = useRef(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(hover, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(hover, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(minerIdle, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(minerIdle, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [hover, minerIdle]);

  const addFloater = (text, opts = {}) => {
    const id = ++floaterId.current;
    const t = new Animated.Value(0);

    const baseX = opts.x !== undefined ? opts.x : 90;
    const baseY = opts.y !== undefined ? opts.y : 8;
    const duration = opts.duration || 640;
    const color = opts.color || null; // default null means use style default
    const fontSize = opts.fontSize || null;

    setFloaters((prev) => [...prev, { id, t, baseX, baseY, value: text, color, fontSize }]);

    Animated.timing(t, {
      toValue: 1,
      duration: duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setFloaters((prev) => prev.filter((f) => f.id !== id));
    });
  };

  const runTapFeedback = () => {
    puffScale.stopAnimation();
    puffOpacity.stopAnimation();
    puffScale.setValue(0.6);
    puffOpacity.setValue(0.55);

    planetSquash.stopAnimation();
    planetSquash.setValue(0);

    Animated.parallel([
      Animated.timing(puffScale, {
        toValue: 1.3,
        duration: 380,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(puffOpacity, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(planetSquash, {
          toValue: 1,
          duration: 85,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(planetSquash, {
          toValue: 0,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  return {
    hover,
    minerIdle,
    puffScale,
    puffOpacity,
    planetSquash,
    floaters,
    addFloater,
    runTapFeedback,
  };
}
