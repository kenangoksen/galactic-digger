// components/game/MinersSheetHost.js
// Keep sheet mounted (no remount), but allow props to update every render.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

export default function MinersSheetHost({ sheetContent, children, visible, onClose }) {
  const sheet = useRef(new Animated.Value(0)).current; // 0 closed / 1 open
  const [localOpen, setLocalOpen] = useState(false);

  // Controlled vs Uncontrolled logic
  const isControlled = typeof visible !== "undefined";
  const isOpen = isControlled ? visible : localOpen;

  // React to prop change
  useEffect(() => {
    if (isControlled) {
      Animated.timing(sheet, {
        toValue: visible ? 1 : 0,
        duration: visible ? 240 : 220,
        easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, isControlled, sheet]);

  // sheetContent inline geliyorsa identity sürekli değişir -> ref ile yakala
  const sheetContentRef = useRef(sheetContent);
  sheetContentRef.current = sheetContent;

  const openSheet = useCallback(() => {
     if (isControlled) return; // Ignore local calls in controlled mode? Or call callback?
     setLocalOpen(true);
     Animated.timing(sheet, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [sheet, isControlled]);

  const closeSheet = useCallback(() => {
    if (isControlled) {
        if (onClose) onClose();
        return;
    }
    Animated.timing(sheet, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setLocalOpen(false));
  }, [sheet, isControlled, onClose]);

  const toggleSheet = useCallback(() => {
    if (isOpen) closeSheet();
    else openSheet();
  }, [isOpen, closeSheet, openSheet]);

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
        style={{ transform: [{ translateY: sheetTranslateY }], zIndex: 100 }}
        pointerEvents={isOpen ? "auto" : "none"}
      >
        {sheetContentRef.current({ closeSheet })}
      </Animated.View>
    );
  }, [isOpen, sheetTranslateY, closeSheet]);

  return children({
    sheetOpen: isOpen,
    openSheet,
    closeSheet,
    closeSheet,
    toggleSheet,
    stageTranslateY,
    stageScale,
    sheetProgress: sheet,
    Sheet,
  });
}
