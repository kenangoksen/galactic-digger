// components/game/MinersSheetHost.js
// NOTE: Keep sheet mounted to preserve scroll position and avoid remount jank.

import { useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

export default function MinersSheetHost({ sheetContent, children }) {
  const sheet = useRef(new Animated.Value(0)).current; // 0 closed / 1 open
  const [sheetOpen, setSheetOpen] = useState(false);

  const openSheet = () => {
    setSheetOpen(true);
    Animated.timing(sheet, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheet, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setSheetOpen(false));
  };

  const toggleSheet = () => {
    if (sheetOpen) closeSheet();
    else openSheet();
  };

  // Stage slides a bit when sheet opens (visual only)
  const stageTranslateY = useMemo(
    () =>
      sheet.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -160],
      }),
    [sheet]
  );

  // Sheet slides up from bottom
  const sheetTranslateY = useMemo(
    () =>
      sheet.interpolate({
        inputRange: [0, 1],
        outputRange: [420, 0],
      }),
    [sheet]
  );

  // Keep sheet mounted always. When closed, pointerEvents='none' so it won't steal taps.
  const Sheet = useMemo(() => {
    function SheetImpl() {
      return (
        <Animated.View
          style={{
            transform: [{ translateY: sheetTranslateY }],
            pointerEvents: sheetOpen ? "auto" : "none",
          }}
        >
          {sheetContent({ closeSheet })}
        </Animated.View>
      );
    }
    return SheetImpl;
  }, [sheetContent, sheetOpen, sheetTranslateY]);

  return children({
    sheetOpen,
    openSheet,
    closeSheet,
    toggleSheet,
    stageTranslateY,
    Sheet,
  });
}
