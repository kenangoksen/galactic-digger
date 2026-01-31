// components/game/MinersSheetHost.js
// Keep sheet mounted (no remount), but allow props to update every render.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

export default function MinersSheetHost({ sheetContent, children }) {
  const sheet = useRef(new Animated.Value(0)).current; // 0 closed / 1 open
  const [sheetOpen, setSheetOpen] = useState(false);

  // sheetContent inline geliyorsa identity sürekli değişir -> ref ile yakala
  const sheetContentRef = useRef(sheetContent);
  useEffect(() => {
    sheetContentRef.current = sheetContent;
  }, [sheetContent]);

  const openSheet = useCallback(() => {
    setSheetOpen(true);
    Animated.timing(sheet, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [sheet]);

  const closeSheet = useCallback(() => {
    Animated.timing(sheet, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setSheetOpen(false));
  }, [sheet]);

  const toggleSheet = useCallback(() => {
    if (sheetOpen) closeSheet();
    else openSheet();
  }, [sheetOpen, closeSheet, openSheet]);

  const stageTranslateY = useMemo(
    () =>
      sheet.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -100], // Push up even more (-100)
      }),
    [sheet],
  );

  const stageScale = useMemo(
    () =>
      sheet.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.75], // Shrink stage to 75%
      }),
    [sheet],
  );

  const sheetTranslateY = useMemo(
    () =>
      sheet.interpolate({
        inputRange: [0, 1],
        outputRange: [420, 0],
      }),
    [sheet],
  );

  // ✅ IMPORTANT:
  // Sheet component identity stable -> no remount / no scroll reset
  // BUT content is rendered each render -> minerals/props update normally
  const Sheet = useCallback(() => {
    return (
      <Animated.View
        style={{ transform: [{ translateY: sheetTranslateY }] }}
        pointerEvents={sheetOpen ? "auto" : "none"}
      >
        {sheetContentRef.current({ closeSheet })}
      </Animated.View>
    );
  }, [sheetOpen, sheetTranslateY, closeSheet]);

  return children({
    sheetOpen,
    openSheet,
    closeSheet,
    toggleSheet,
    toggleSheet,
    stageTranslateY,
    stageScale,
    sheetProgress: sheet,
    Sheet,
  });
}
