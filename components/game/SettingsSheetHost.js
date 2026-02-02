import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable } from "react-native";

/**
 * Bottom-sheet style modal host
 * - visible=true => slides in
 * - tap outside => closes
 */
export default function SettingsSheetHost({
  visible,
  onClose,
  sheetContent,
  children,
}) {
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);

    Animated.timing(sheetAnim, {
      toValue: visible ? 1 : 0,
      duration: 240,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, sheetAnim]);

  const overlayOpacity = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  const translateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [520, 0],
  });

  const sheetTransformStyle = useMemo(
    () => ({
      transform: [{ translateY }],
    }),
    [translateY],
  );

  if (!mounted) return <>{children}</>;

  return (
    <>
      {children}

      {/* Overlay */}
      <Animated.View
        pointerEvents={visible ? "auto" : "none"}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          opacity: overlayOpacity,
          backgroundColor: "black",
          zIndex: 1000,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        pointerEvents={visible ? "auto" : "none"}
        style={[
          {
            position: "absolute",
            left: 10,
            right: 10,
            bottom: 74, // bottom bar üstü gibi
            height: 380, // geniş ve ileride buton eklemeye uygun
            zIndex: 1001,
          },
          sheetTransformStyle,
        ]}
      >
        {sheetContent}
      </Animated.View>
    </>
  );
}
