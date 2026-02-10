
import { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";

/**
 * Animated Sprite Sheet Component
 * 
 * Supports both HORIZONTAL STRIP and GRID sprite sheets.
 * 
 * For horizontal strips: set frameCount (cols=frameCount implicitly)
 * For grids: set cols + rows (frameCount = cols * rows)
 * 
 * @param {Object} source - Image require(...)
 * @param {number} frameWidth - Width of a single frame
 * @param {number} frameHeight - Height of a single frame
 * @param {number} frameCount - Total number of frames
 * @param {number} cols - Columns in the sprite sheet (default: frameCount = horizontal strip)
 * @param {number} rows - Rows in the sprite sheet (default: 1)
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
  cols,  // NEW: grid columns (default = frameCount for horizontal strip)
  rows,  // NEW: grid rows (default = 1)
  fps = 12,
  loop = true,
  playing = true,
  enableSafetyClip = false,
  trimAmount = 0,
  style,
}) {
  const [frameIndex, setFrameIndex] = useState(0);
  const frameRef = useRef(0);
  const timerRef = useRef(null);
  
  // Grid support: default to horizontal strip
  const sheetCols = cols || frameCount;
  const sheetRows = rows || 1;
  
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
  const effectiveTrim = trimAmount > 0 ? trimAmount : (enableSafetyClip ? 1 : 0);
  const containerWidth = frameWidth - (effectiveTrim * 2);
  const offsetAdjustment = -effectiveTrim;

  // Grid frame position: col = frameIndex % cols, row = floor(frameIndex / cols)
  const col = frameIndex % sheetCols;
  const row = Math.floor(frameIndex / sheetCols);

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
        resizeMode="stretch"
        style={{
            position: "absolute",
            top: -(row * frameHeight),
            left: -(col * frameWidth) + offsetAdjustment,
            width: frameWidth * sheetCols, 
            height: frameHeight * sheetRows,
        }}
      />
    </View>
  );
}
