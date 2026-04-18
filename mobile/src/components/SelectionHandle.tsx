import React, { useRef } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';

interface SelectionHandleProps {
  onDrag: (dx: number, dy: number) => void;
  onDragEnd: () => void;
  position: 'top-left' | 'bottom-right';
}

// A small draggable blue dot — PanResponder is ONLY on this 30x30 touch area
export function SelectionHandle({ onDrag, onDragEnd, position }: SelectionHandleProps) {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
      // Stop ScrollView from stealing the touch while dragging the handle
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        onDrag(gesture.dx, gesture.dy);
      },
      onPanResponderRelease: () => {
        onDragEnd();
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
