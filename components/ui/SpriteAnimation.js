
import { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";

/**
 * Animated Sprite Sheet Component
 * 
 * Assumes a HORIZONTAL strip sprite sheet by default.
 * If you have a grid, you can extend logic to handle rows/cols.
 * 
 * @param {Object} source - Image require(...)
 * @param {number} frameWidth - Width of a single frame
 * @param {number} frameHeight - Height of a single frame
 * @param {number} frameCount - Total number of frames
 * @param {number} fps - Frames per second (default: 12)
 * @param {boolean} loop - Whether to loop (default: true)
 * @param {boolean} playing - Control playback (default: true)
 * @param {Object} style - Container style
 */
export default function SpriteAnimation({
  source,
  frameWidth,
  frameHeight,
  frameCount,
  framesToPlay, // Optional: Limit playback to first N frames
  fps = 12,
  loop = true,
  playing = true,
  enableSafetyClip = false, // Deprecated in favor of explicit trim, but kept for compatibility
  trimAmount = 0, // Pixels to crop from BOTH sides
  style,
}) {
  const [frameIndex, setFrameIndex] = useState(0);
  const frameRef = useRef(0);
  const timerRef = useRef(null);
  
  // Default to playing all frames if not specified
  const limit = framesToPlay || frameCount;

  useEffect(() => {
    if (!playing) {
        if (timerRef.current) clearInterval(timerRef.current);
        return;
    }

    const intervalMs = 1000 / fps;
    
    timerRef.current = setInterval(() => {
        let next = frameRef.current + 1;
        
        if (next >= limit) {
             if (loop) {
                 next = 0;
             } else {
                 next = limit - 1;
                 clearInterval(timerRef.current);
             }
        }
        
        frameRef.current = next;
        setFrameIndex(next);
    }, intervalMs);

    return () => clearInterval(timerRef.current);
  }, [playing, fps, limit, loop]);

  // Determine trim
  // If enableSafetyClip is true but no trimAmount, default to 1.
  // If trimAmount is > 0, use it.
  const effectiveTrim = trimAmount > 0 ? trimAmount : (enableSafetyClip ? 1 : 0);
  
  const containerWidth = frameWidth - (effectiveTrim * 2);
  const offsetAdjustment = -effectiveTrim;

  return (
    <View style={[
        style, 
        { 
            width: containerWidth, 
            height: frameHeight, 
            overflow: "hidden", 
        }
    ]}>
      <Image
        source={source}
        style={{
            width: frameWidth * frameCount, 
            height: frameHeight,
            // Shift image left to show current frame + clip offset
            transform: [{ translateX: -(frameIndex * frameWidth) + offsetAdjustment }],
        }}
      />
    </View>
  );
}
