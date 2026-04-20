import React, { useRef } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';

interface SelectionHandleProps {
  onDrag: (dx: number, dy: number) => void;
  onDragEnd: () => void;
  position: 'top-left' | 'bottom-right';
}

// A small draggable blue dot — PanResponder is ONLY on this 30x30 touch area
export function SelectionHandle({ onDrag, onDragEnd, position }: SelectionHandleProps) {
  // Throttle drag updates to ~120fps (8ms) for ultra-smooth iPad selection
  // iPad Pro typically has 120Hz displays, so 8ms aligns with screen refresh rate
  const lastDragTimeRef = useRef(0);
  const lastReportedPosRef = useRef({ dx: 0, dy: 0 });
  const THROTTLE_MS = 8; // ~120fps (ideal for iPad Pro)
  const MIN_MOVEMENT_PX = 1; // Trigger on 1px movement for precision

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 1 || Math.abs(gesture.dy) > 1, // Reduced threshold for faster response
      // Stop ScrollView from stealing the touch while dragging the handle
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        const now = Date.now();
        const timeSinceLastDrag = now - lastDragTimeRef.current;
        const dxDelta = Math.abs(gesture.dx - lastReportedPosRef.current.dx);
        const dyDelta = Math.abs(gesture.dy - lastReportedPosRef.current.dy);

        // Update if: (1) enough time passed (throttle) OR (2) significant movement since last update
        // This ensures smooth 120fps updates while preventing excessive state updates
        if (timeSinceLastDrag >= THROTTLE_MS || dxDelta >= MIN_MOVEMENT_PX || dyDelta >= MIN_MOVEMENT_PX) {
          lastDragTimeRef.current = now;
          lastReportedPosRef.current = { dx: gesture.dx, dy: gesture.dy };
          onDrag(gesture.dx, gesture.dy);
        }
      },
      onPanResponderRelease: () => {
        onDragEnd();
        lastDragTimeRef.current = 0;
        lastReportedPosRef.current = { dx: 0, dy: 0 };
      },
    })
  ).current;

  const posStyle =
    position === 'bottom-right'
      ? { bottom: -19, right: -19 }
      : { top: -19, left: -19 };

  return (
    <View
      style={[styles.touchArea, posStyle]}
      {...panResponder.panHandlers}
    >
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Big invisible touch target (30x30) so it's easy to grab
  touchArea: {
    position: 'absolute',
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  // The visible blue dot
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1A73E8',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
