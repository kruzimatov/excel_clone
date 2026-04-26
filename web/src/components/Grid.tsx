import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import type { Cell, Selection } from '../types';
import { cellKey, colToLetter, getDisplayValue } from '../utils/cells';
import { classNames } from '../utils/classNames';
import { t, type AppLanguage } from '../utils/i18n';
import { DEFAULT_VISIBLE_COLUMN_COUNT } from '../utils/workbookLayout';

import { SelectionHandle } from './SelectionHandle';
import styles from './Grid.module.css';

function getBaseSizes(viewportWidth: number, viewportHeight: number) {
  const isTablet = viewportWidth >= 700 && viewportWidth <= 1400 && viewportHeight <= 1100;
  if (isTablet) {
    return {
      headerHeight: 24,
      rowHeaderWidth: 38,
      rowHeight: 28,
      cellFontSize: 12,
      headerFontSize: 10,
      visibleColTarget: Math.min(8, Math.max(5, Math.floor(viewportWidth / 140))),
    };
  }
  return {
    headerHeight: 28,
    rowHeaderWidth: 46,
    rowHeight: 32,
    cellFontSize: 13,
    headerFontSize: 11,
    visibleColTarget: 8,
  };
}

interface GridProps {
  language: AppLanguage;
  cells: Record<string, Cell>;
  selection: Selection;
  editingCell: string | null;
  formulaInput: string;
  formulaSelectionMode: boolean;
  cellScale: number;
  reverseRows: boolean;
  rowCount: number;
  columnCount: number;
  scrollToBottomToken: number;
  onSelectCell: (row: number, col: number, options?: { position?: { x: number; y: number }; extendSelection?: boolean }) => void;
  onSelectRange: (start: { row: number; col: number }, end: { row: number; col: number }) => void;
  onOpenRowMenu: (row: number, position: { x: number; y: number }) => void;
  onLongPressCell: (row: number, col: number, position: { x: number; y: number }) => void;
  onDoubleTapCell: (row: number, col: number) => void;
  onCellInputChange: (text: string) => void;
  onCellInputSubmit: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function Grid({
  language,
  cells,
  selection,
  editingCell,
  formulaInput,
  formulaSelectionMode,
  cellScale,
  reverseRows,
  rowCount,
  columnCount,
  scrollToBottomToken,
  onSelectCell,
  onSelectRange,
  onOpenRowMenu,
  onLongPressCell,
  onDoubleTapCell,
  onCellInputChange,
  onCellInputSubmit,
}: GridProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const horizontalScrollerRef = useRef<HTMLDivElement | null>(null);
  const mouseDragRef = useRef<{
    anchor: { row: number; col: number };
    moved: boolean;
    wasPrimarySelected: boolean;
  } | null>(null);
  const [colWidthOverrides, setColWidthOverrides] = useState<Record<number, number>>({});
  const colResizeRef = useRef<{ col: number; startX: number; startWidth: number } | null>(null);
  const submitGuardRef = useRef(false);
  const rowHeaderTouchRef = useRef<{ timer: number | null; row: number; x: number; y: number } | null>(null);
  const touchStateRef = useRef<{
    row: number;
    col: number;
    pointerId: number;
    moved: boolean;
    longPressTriggered: boolean;
    timer: number | null;
    startX: number;
    startY: number;
  } | null>(null);

  const [viewportSize, setViewportSize] = useState({ width: 1024, height: 640 });
  const [virtualScrollState, setVirtualScrollState] = useState({
    firstVisibleVisualRow: 0,
    showPinnedFirstRow: false,
  });
  const scrollFrameRef = useRef<number | null>(null);
  const syncScrollRef = useRef<'viewport' | 'scroller' | null>(null);
  const pendingScrollRef = useRef({ top: 0 });

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;

    const observer = new ResizeObserver(() => {
      setViewportSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    });

    observer.observe(element);
    setViewportSize({
      width: element.clientWidth,
      height: element.clientHeight,
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      const timer = touchStateRef.current?.timer;
      if (timer !== null && timer !== undefined) {
        window.clearTimeout(timer);
      }
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
      const rowHeaderTimer = rowHeaderTouchRef.current?.timer;
      if (rowHeaderTimer !== null && rowHeaderTimer !== undefined) {
        window.clearTimeout(rowHeaderTimer);
      }
      mouseDragRef.current = null;
      touchStateRef.current = null;
      rowHeaderTouchRef.current = null;
      syncScrollRef.current = null;
    };
  }, []);

  const screenW = viewportSize.width || window.innerWidth;
  const baseSizes = getBaseSizes(viewportSize.width || window.innerWidth, viewportSize.height || window.innerHeight);
  const safeColumnCount = Math.max(DEFAULT_VISIBLE_COLUMN_COUNT, columnCount);
  const columnData = Array.from({ length: safeColumnCount }, (_, index) => index);

  const rowHeaderWidth = Math.max(30, Math.round(baseSizes.rowHeaderWidth * cellScale));
  const headerHeight = Math.max(20, Math.round(baseSizes.headerHeight * cellScale));
  const rowHeight = Math.max(22, Math.round(baseSizes.rowHeight * cellScale));
  const cellFontSize = Math.max(10, Math.round(baseSizes.cellFontSize * cellScale));
  const headerFontSize = Math.max(9, Math.round(baseSizes.headerFontSize * cellScale));
  const baseColWidth = Math.max(
    72,
    Math.floor((screenW - rowHeaderWidth) / baseSizes.visibleColTarget),
  );
  const widthScale = 0.55 + (cellScale * 0.45);
  const defaultColWidth = clamp(
    Math.floor(baseColWidth * widthScale),
    48,
    160,
  );

  function getColWidth(col: number) {
    return colWidthOverrides[col] ?? defaultColWidth;
  }

  const totalGridWidth = rowHeaderWidth + columnData.reduce((sum, col) => sum + getColWidth(col), 0);
  const safeRowCount = Math.max(1, rowCount);

  function rowToVisualIndex(row: number) {
    return reverseRows ? safeRowCount - 1 - row : row;
  }

  function visualIndexToRow(visualIndex: number) {
    return reverseRows ? safeRowCount - 1 - visualIndex : visualIndex;
  }

  const layoutStyle = {
    '--row-header-width': `${rowHeaderWidth}px`,
    '--header-height': `${headerHeight}px`,
    '--row-height': `${rowHeight}px`,
    '--col-width': `${defaultColWidth}px`,
    '--cell-font-size': `${cellFontSize}px`,
    '--header-font-size': `${headerFontSize}px`,
    '--grid-width': `${totalGridWidth}px`,
    '--grid-body-height': `${rowHeight * safeRowCount}px`,
    '--grid-total-height': `${headerHeight + rowHeight * safeRowCount}px`,
  } as CSSProperties;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || scrollToBottomToken === 0) {
      return;
    }

    const nextTop = 0;
    viewport.scrollTop = nextTop;
    setVirtualScrollState({
      firstVisibleVisualRow: 0,
      showPinnedFirstRow: false,
    });
  }, [headerHeight, rowHeight, safeRowCount, scrollToBottomToken]);

  function handleColResizeStart(col: number, event: ReactMouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    colResizeRef.current = { col, startX: event.clientX, startWidth: getColWidth(col) };

    function onMove(e: MouseEvent) {
      const activeResize = colResizeRef.current;
      if (!activeResize) return;
      const delta = e.clientX - activeResize.startX;
      const newWidth = Math.max(50, activeResize.startWidth + delta);
      setColWidthOverrides((prev) => ({ ...prev, [activeResize.col]: newWidth }));
    }
    function onUp() {
      colResizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const minRow = Math.min(selection.start.row, selection.end.row);
  const maxRow = Math.max(selection.start.row, selection.end.row);
  const minCol = Math.min(selection.start.col, selection.end.col);
  const maxCol = Math.max(selection.start.col, selection.end.col);
  const isMultiSelect = minRow !== maxRow || minCol !== maxCol;

  const bodyViewportHeight = Math.max(0, viewportSize.height - headerHeight);
  const rowsPerViewport = Math.max(1, Math.ceil(bodyViewportHeight / rowHeight));
  const visibleStart = clamp(
    virtualScrollState.firstVisibleVisualRow - 6,
    0,
    safeRowCount - 1,
  );
  const visibleEnd = clamp(
    virtualScrollState.firstVisibleVisualRow + rowsPerViewport + 6,
    0,
    safeRowCount - 1,
  );
  const visibleRows: number[] = [];
  for (let visualRow = visibleStart; visualRow <= visibleEnd; visualRow += 1) {
    visibleRows.push(visualIndexToRow(visualRow));
  }

  function getCellFromClientPoint(clientX: number, clientY: number) {
    const viewport = viewportRef.current;
    if (!viewport) return null;

    const rect = viewport.getBoundingClientRect();
    const adjustedX = clientX - rect.left + viewport.scrollLeft - rowHeaderWidth;
    const adjustedY = clientY - rect.top + viewport.scrollTop - headerHeight;

    const visualRow = clamp(Math.floor(adjustedY / rowHeight), 0, safeRowCount - 1);
    let cumX = 0;
    let col = 0;
    for (let c = 0; c < safeColumnCount; c++) {
      cumX += getColWidth(c);
      if (adjustedX < cumX) { col = c; break; }
      col = c;
    }
    return { row: visualIndexToRow(visualRow), col: clamp(col, 0, safeColumnCount - 1) };
  }

  function clearTouchState() {
    const timer = touchStateRef.current?.timer;
    if (timer !== null && timer !== undefined) {
      window.clearTimeout(timer);
    }
    touchStateRef.current = null;
  }

  function clearRowHeaderTouchState() {
    const timer = rowHeaderTouchRef.current?.timer;
    if (timer !== null && timer !== undefined) {
      window.clearTimeout(timer);
    }
    rowHeaderTouchRef.current = null;
  }

  function handleMouseMove(event: MouseEvent) {
    const dragState = mouseDragRef.current;
    if (!dragState) return;

    const nextCell = getCellFromClientPoint(event.clientX, event.clientY);
    if (!nextCell) return;

    dragState.moved = true;
    onSelectRange(dragState.anchor, nextCell);
  }

  function handleMouseUp(event: MouseEvent) {
    const dragState = mouseDragRef.current;
    mouseDragRef.current = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);

    if (!dragState) return;

    if (dragState.moved) {
      const finalCell = getCellFromClientPoint(event.clientX, event.clientY) ?? dragState.anchor;
      onSelectRange(dragState.anchor, finalCell);
      return;
    }

    // Mouse didn't move — use the anchor cell (exact row/col from the button),
    // not pixel recalculation which can be off by a row
    const { row, col } = dragState.anchor;

    if (dragState.wasPrimarySelected) {
      onDoubleTapCell(row, col);
      return;
    }

    onSelectCell(row, col, {
      position: { x: event.clientX, y: event.clientY },
    });
  }

  function handleCellMouseDown(row: number, col: number, event: ReactMouseEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    // Skip if this was triggered by a touch (touch uses pointer events path)
    if (touchStateRef.current) return;
    if (editingCell === cellKey(row, col)) return;

    if (event.shiftKey) {
      onSelectCell(row, col, {
        extendSelection: true,
        position: { x: event.clientX, y: event.clientY },
      });
      return;
    }

    const isPrimarySelected =
      selection.start.row === row
      && selection.start.col === col
      && selection.end.row === row
      && selection.end.col === col
      && !editingCell;

    mouseDragRef.current = {
      anchor: { row, col },
      moved: false,
      wasPrimarySelected: isPrimarySelected,
    };

    // Don't re-select if already the primary cell — avoids flicker before entering edit mode
    if (!isPrimarySelected) {
      onSelectRange({ row, col }, { row, col });
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleTouchPointerDown(row: number, col: number, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== 'touch') return;

    const timer = window.setTimeout(() => {
      touchStateRef.current = {
        ...(touchStateRef.current ?? {
          row,
          col,
          pointerId: event.pointerId,
          moved: false,
          startX: event.clientX,
          startY: event.clientY,
        }),
        longPressTriggered: true,
        timer: null,
      };
      onLongPressCell(row, col, { x: event.clientX, y: event.clientY });
    }, 350);

    touchStateRef.current = {
      row,
      col,
      pointerId: event.pointerId,
      moved: false,
      longPressTriggered: false,
      timer,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function handleTouchPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== 'touch' || !touchStateRef.current) return;
    if (touchStateRef.current.pointerId !== event.pointerId) return;

    const movedX = Math.abs(event.clientX - touchStateRef.current.startX);
    const movedY = Math.abs(event.clientY - touchStateRef.current.startY);
    if (movedX > 10 || movedY > 10) {
      touchStateRef.current.moved = true;
      if (touchStateRef.current.timer !== null) {
        window.clearTimeout(touchStateRef.current.timer);
        touchStateRef.current.timer = null;
      }
    }
  }

  function handleTouchPointerEnd(row: number, col: number, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== 'touch' || !touchStateRef.current) return;
    if (touchStateRef.current.pointerId !== event.pointerId) return;

    const touchState = touchStateRef.current;
    clearTouchState();

    if (touchState.longPressTriggered || touchState.moved) {
      return;
    }

    const isPrimarySelected =
      selection.start.row === row
      && selection.start.col === col
      && selection.end.row === row
      && selection.end.col === col
      && !editingCell;

    if (isPrimarySelected) {
      onDoubleTapCell(row, col);
      return;
    }

    onSelectCell(row, col, {
      position: { x: event.clientX, y: event.clientY },
    });
  }

  function handleBottomRightDrag(dx: number, dy: number) {
    const colShift = Math.round(dx / defaultColWidth);
    const rowShift = Math.round(dy / rowHeight);
    const newEndCol = clamp(maxCol + colShift, minCol, safeColumnCount - 1);
    const newEndRow = clamp(maxRow + rowShift, minRow, safeRowCount - 1);
    onSelectRange({ row: minRow, col: minCol }, { row: newEndRow, col: newEndCol });
  }

  function handleTopLeftDrag(dx: number, dy: number) {
    const colShift = Math.round(dx / defaultColWidth);
    const rowShift = Math.round(dy / rowHeight);
    const newStartCol = clamp(minCol + colShift, 0, maxCol);
    const newStartRow = clamp(minRow + rowShift, 0, maxRow);
    onSelectRange({ row: newStartRow, col: newStartCol }, { row: maxRow, col: maxCol });
  }

  const selectionText = isMultiSelect
    ? (formulaSelectionMode
      ? `${t(language, 'range')}: ${cellKey(minRow, minCol)}:${cellKey(maxRow, maxCol)}`
      : `${cellKey(minRow, minCol)}:${cellKey(maxRow, maxCol)}`)
    : null;

  const showPinnedFirstRow = virtualScrollState.showPinnedFirstRow && safeRowCount > 1;

  function renderRow(row: number, pinned = false) {
    const rowStyle = pinned
      ? undefined
      : ({ top: `${headerHeight + rowToVisualIndex(row) * rowHeight}px` } as CSSProperties);

    return (
      <div
        key={`${pinned ? 'pinned' : 'row'}-${row}`}
        className={classNames(styles.row, pinned && styles.rowPinned)}
        style={rowStyle}
      >
        <button
          type="button"
          className={classNames(styles.rowHeader, styles.headerButton)}
          onClick={() => onSelectRange({ row, col: 0 }, { row, col: safeColumnCount - 1 })}
          onContextMenu={(event) => {
            event.preventDefault();
            onSelectRange({ row, col: 0 }, { row, col: safeColumnCount - 1 });
            onOpenRowMenu(row, { x: event.clientX, y: event.clientY });
          }}
          onPointerDown={(event) => {
            if (event.pointerType !== 'touch') return;
            clearRowHeaderTouchState();
            rowHeaderTouchRef.current = {
              row,
              x: event.clientX,
              y: event.clientY,
              timer: window.setTimeout(() => {
                onSelectRange({ row, col: 0 }, { row, col: safeColumnCount - 1 });
                onOpenRowMenu(row, { x: event.clientX, y: event.clientY });
                rowHeaderTouchRef.current = null;
              }, 350),
            };
          }}
          onPointerUp={clearRowHeaderTouchState}
          onPointerCancel={clearRowHeaderTouchState}
        >
          {row + 1}
        </button>

        {columnData.map((col) => {
          const key = cellKey(row, col);
          const cell = cells[key];
          const selected = row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
          const primary = row === selection.start.row && col === selection.start.col;
          const editing = editingCell === key;
          const numericValue = typeof cell?.value === 'number' ? cell.value : null;
          const isNumber = numericValue !== null;
          const negative = numericValue !== null && numericValue < 0;
          const bgColor = cell?.style?.bgColor || (selected ? '#E8F0FE' : '#FFFFFF');
          const textColor = negative ? '#CC0000' : (cell?.style?.textColor || '#000000');

          const cw = getColWidth(col);
          const cellStyle = {
            width: cw,
            flexBasis: cw,
            flexShrink: 0,
            flexGrow: 0,
            backgroundColor: bgColor,
            color: textColor,
            fontWeight: cell?.style?.bold ? 700 : 400,
            fontStyle: cell?.style?.italic ? 'italic' : 'normal',
            fontSize: cell?.style?.fontSize ? `${cell.style.fontSize}px` : 'var(--cell-font-size)',
          } as CSSProperties;
          return (
            <button
              key={key}
              type="button"
              style={cellStyle}
              className={classNames(
                styles.cell,
                selected && isMultiSelect && row === minRow && styles.selTop,
                selected && isMultiSelect && row === maxRow && styles.selBottom,
                selected && isMultiSelect && col === minCol && styles.selLeft,
                selected && isMultiSelect && col === maxCol && styles.selRight,
                primary && !isMultiSelect && styles.cellPrimary,
                isNumber && styles.numberCell,
              )}
              onMouseDown={(event) => handleCellMouseDown(row, col, event)}
              onPointerDown={(event) => handleTouchPointerDown(row, col, event)}
              onPointerMove={handleTouchPointerMove}
              onPointerUp={(event) => handleTouchPointerEnd(row, col, event)}
              onPointerCancel={clearTouchState}
              onContextMenu={(event) => {
                event.preventDefault();
                onLongPressCell(row, col, { x: event.clientX, y: event.clientY });
              }}
            >
              {editing ? (
                <input
                  className={classNames(styles.cellInput, isNumber && styles.numberCell)}
                  value={formulaInput}
                  onChange={(event) => onCellInputChange(event.target.value)}
                  onBlur={(event) => {
                    if (submitGuardRef.current) return;
                    const related = event.relatedTarget as HTMLElement | null;
                    if (related?.classList.contains(styles.cell)) return;
                    onCellInputSubmit();
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      submitGuardRef.current = true;
                      onCellInputSubmit();
                      setTimeout(() => { submitGuardRef.current = false; }, 0);
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      submitGuardRef.current = true;
                      onCellInputChange('');
                      onCellInputSubmit();
                      setTimeout(() => { submitGuardRef.current = false; }, 0);
                    }
                    if (event.key === 'Tab') {
                      event.preventDefault();
                      submitGuardRef.current = true;
                      onCellInputSubmit();
                      setTimeout(() => { submitGuardRef.current = false; }, 0);
                    }
                  }}
                  autoFocus
                />
              ) : (
                <span className={styles.cellText}>{getDisplayValue(cell)}</span>
              )}

              {selected && row === maxRow && col === maxCol ? (
                <SelectionHandle position="bottom-right" onDrag={handleBottomRightDrag} onDragEnd={() => {}} />
              ) : null}

              {selected && row === minRow && col === minCol ? (
                <SelectionHandle position="top-left" onDrag={handleTopLeftDrag} onDragEnd={() => {}} />
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <section className={styles.container} style={layoutStyle}>
      {selectionText ? (
        <div className={styles.selectionBar}>{selectionText}</div>
      ) : null}

      <div
        ref={viewportRef}
        className={styles.viewport}
        onScroll={(event) => {
          const target = event.currentTarget;
          if (syncScrollRef.current !== 'scroller' && horizontalScrollerRef.current) {
            syncScrollRef.current = 'viewport';
            horizontalScrollerRef.current.scrollLeft = target.scrollLeft;
            syncScrollRef.current = null;
          }
          pendingScrollRef.current = { top: target.scrollTop };
          if (scrollFrameRef.current !== null) {
            return;
          }

          scrollFrameRef.current = window.requestAnimationFrame(() => {
          scrollFrameRef.current = null;
            const firstVisibleVisualRow = clamp(
              Math.floor(pendingScrollRef.current.top / rowHeight),
              0,
              safeRowCount - 1,
            );
            const pinned = pendingScrollRef.current.top > rowHeight;

            startTransition(() => {
              setVirtualScrollState((current) => (
                current.firstVisibleVisualRow === firstVisibleVisualRow && current.showPinnedFirstRow === pinned
                  ? current
                  : { firstVisibleVisualRow, showPinnedFirstRow: pinned }
              ));
            });
          });
        }}
      >
        <div className={styles.inner}>
          <div className={styles.headerRow}>
            <button type="button" className={classNames(styles.cornerCell, styles.headerButton)} />
            {columnData.map((col) => (
              <button
                key={col}
                type="button"
                className={classNames(styles.colHeader, styles.headerButton)}
                style={{ width: getColWidth(col), flexBasis: getColWidth(col), flexShrink: 0, flexGrow: 0 }}
                onClick={() => onSelectRange({ row: 0, col }, { row: safeRowCount - 1, col })}
              >
                {colToLetter(col)}
                <span
                  className={styles.colResizeHandle}
                  onMouseDown={(e) => handleColResizeStart(col, e)}
                />
              </button>
            ))}
          </div>

          {showPinnedFirstRow ? (
            <div className={styles.pinnedRowOverlay}>
              {renderRow(0, true)}
            </div>
          ) : null}

          <div className={styles.rowsLayer}>
            {visibleRows.map((row) => renderRow(row))}
          </div>
        </div>
      </div>

      <div
        ref={horizontalScrollerRef}
        className={styles.horizontalScroller}
        onScroll={(event) => {
          if (syncScrollRef.current === 'viewport') {
            return;
          }

          const viewport = viewportRef.current;
          if (!viewport) {
            return;
          }

          syncScrollRef.current = 'scroller';
          viewport.scrollLeft = event.currentTarget.scrollLeft;
          syncScrollRef.current = null;
        }}
      >
        <div className={styles.horizontalScrollerInner} style={{ width: `${totalGridWidth}px` }} />
      </div>
    </section>
  );
}
