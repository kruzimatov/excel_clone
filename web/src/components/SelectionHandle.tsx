import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

import { classNames } from '../utils/classNames';

import styles from './SelectionHandle.module.css';

interface SelectionHandleProps {
  onDrag: (dx: number, dy: number) => void;
  onDragEnd: () => void;
  position: 'top-left' | 'bottom-right';
}

export function SelectionHandle({
  onDrag,
  onDragEnd,
  position,
}: SelectionHandleProps) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDeltaRef = useRef({ dx: 0, dy: 0 });

  useEffect(() => () => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
    }
  }, []);

  function handlePointerDown(event: ReactPointerEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();

    startRef.current = { x: event.clientX, y: event.clientY };

    const handleMove = (moveEvent: PointerEvent) => {
      if (!startRef.current) return;
      lastDeltaRef.current = {
        dx: moveEvent.clientX - startRef.current.x,
        dy: moveEvent.clientY - startRef.current.y,
      };

      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        onDrag(lastDeltaRef.current.dx, lastDeltaRef.current.dy);
      });
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      startRef.current = null;
      onDragEnd();
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLSpanElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`Selection handle ${position}`}
      className={classNames(
        styles.touchArea,
        position === 'bottom-right' ? styles.bottomRight : styles.topLeft,
      )}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    >
      <span className={styles.dot} />
    </span>
  );
}
