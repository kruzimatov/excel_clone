import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  useWindowDimensions,
  GestureResponderEvent,
  LayoutChangeEvent,
} from 'react-native';
import { Cell, Selection } from '../types';
import { cellKey, colToLetter, getDisplayValue } from '../utils/cells';
import { SelectionHandle } from './SelectionHandle';

const COL_COUNT = 26;
const ROW_COUNT = 200;
const BASE_HEADER_HEIGHT = 32;
const BASE_ROW_HEADER_WIDTH = 52;
const BASE_ROW_HEIGHT = 48;
const BASE_CELL_FONT_SIZE = 14;
const BASE_HEADER_FONT_SIZE = 12;
const COLUMN_DATA = Array.from({ length: COL_COUNT }, (_, i) => i);
const ROW_DATA = Array.from({ length: ROW_COUNT }, (_, i) => i);

// Extract row index (0-based) from a cell key like "A1" → 0, "B12" → 11
function rowFromCellKey(key: string | null): number {
  if (!key) return -1;
  const m = key.match(/\d+$/);
  return m ? parseInt(m[0]) - 1 : -1;
}

interface GridProps {
  cells: Record<string, Cell>;
  selection: Selection;
  editingCell: string | null;
  formulaInput: string;
  formulaSelectionMode: boolean;
  cellScale: number;
  onSelectCell: (row: number, col: number, position?: { x: number; y: number }) => void;
  onSelectRange: (start: { row: number; col: number }, end: { row: number; col: number }) => void;
  onLongPressCell: (row: number, col: number, event: GestureResponderEvent) => void;
  onDoubleTapCell: (row: number, col: number) => void;
  onCellInputChange: (text: string) => void;
  onCellInputSubmit: () => void;
}

// ---------------------------------------------------------------------------
// GridRow — memoized with row-level smart comparison.
// Re-renders ONLY when:
//   • This row is/was in the selection range, OR
//   • This row contains the editing cell, OR
//   • The cells data itself changed (e.g. after a value commit)
// This means tapping a cell only re-renders ~2 rows instead of all 200.
// ---------------------------------------------------------------------------
interface GridRowProps {
  row: number;
  cells: Record<string, Cell>;
  selection: Selection;
  editingCell: string | null;
  formulaInput: string;
  colWidth: number;
  rowHeight: number;
  rowHeaderWidth: number;
  cellFontSize: number;
  headerFontSize: number;
  onTap: (row: number, col: number) => void;
  onLongPress: (row: number, col: number, event: GestureResponderEvent) => void;
  onSelectRange: (start: { row: number; col: number }, end: { row: number; col: number }) => void;
  onCellInputChange: (text: string) => void;
  onCellInputSubmit: () => void;
  onDragBottomRight: (dx: number, dy: number) => void;
  onDragTopLeft: (dx: number, dy: number) => void;
}

interface GridCellProps {
  row: number;
  col: number;
  cellRef: string;
  cell: Cell | undefined;
  selected: boolean;
  primary: boolean;
  editing: boolean;
  isMultiSelect: boolean;
  isTopEdge: boolean;
  isBottomEdge: boolean;
  isLeftEdge: boolean;
  isRightEdge: boolean;
  showBR: boolean;
  showTL: boolean;
  colWidth: number;
  rowHeight: number;
  cellFontSize: number;
  formulaInput: string;
  onTap: (row: number, col: number, event?: GestureResponderEvent) => void;
  onLongPress: (row: number, col: number, event: GestureResponderEvent) => void;
  onCellInputChange: (text: string) => void;
  onCellInputSubmit: () => void;
  onDragBottomRight: (dx: number, dy: number) => void;
  onDragTopLeft: (dx: number, dy: number) => void;
}

function rowsAreEqual(prev: GridRowProps, next: GridRowProps): boolean {
  if (prev.colWidth !== next.colWidth) return false;
  if (prev.rowHeight !== next.rowHeight) return false;
  if (prev.rowHeaderWidth !== next.rowHeaderWidth) return false;
  if (prev.cellFontSize !== next.cellFontSize) return false;
  if (prev.headerFontSize !== next.headerFontSize) return false;

  const prevMinR = Math.min(prev.selection.start.row, prev.selection.end.row);
  const prevMaxR = Math.max(prev.selection.start.row, prev.selection.end.row);
  const nextMinR = Math.min(next.selection.start.row, next.selection.end.row);
  const nextMaxR = Math.max(next.selection.start.row, next.selection.end.row);

  const rowInPrev = prev.row >= prevMinR && prev.row <= prevMaxR;
  const rowInNext = next.row >= nextMinR && next.row <= nextMaxR;

  const prevEditRow = rowFromCellKey(prev.editingCell);
  const nextEditRow = rowFromCellKey(next.editingCell);
  const editInRow = prevEditRow === prev.row || nextEditRow === next.row;

  if (!rowInPrev && !rowInNext && !editInRow) {
    // Row is unaffected by selection or editing — only re-render if cell data changed
    return prev.cells === next.cells; // true = "equal" = skip re-render
  }

  // Row is/was selected or contains editing cell — allow re-render
  return false;
}

function cellsAreEqual(prev: GridCellProps, next: GridCellProps): boolean {
  if (prev.cell !== next.cell) return false;
  if (prev.selected !== next.selected) return false;
  if (prev.primary !== next.primary) return false;
  if (prev.editing !== next.editing) return false;
  if (prev.isMultiSelect !== next.isMultiSelect) return false;
  if (prev.isTopEdge !== next.isTopEdge) return false;
  if (prev.isBottomEdge !== next.isBottomEdge) return false;
  if (prev.isLeftEdge !== next.isLeftEdge) return false;
  if (prev.isRightEdge !== next.isRightEdge) return false;
  if (prev.showBR !== next.showBR) return false;
  if (prev.showTL !== next.showTL) return false;
  if (prev.colWidth !== next.colWidth) return false;
  if (prev.rowHeight !== next.rowHeight) return false;
  if (prev.cellFontSize !== next.cellFontSize) return false;
  if (prev.editing && prev.formulaInput !== next.formulaInput) return false;
  return true;
}

const GridCell = React.memo(function GridCell({
  row,
  col,
  cellRef,
  cell,
  selected,
  primary,
  editing,
  isMultiSelect,
  isTopEdge,
  isBottomEdge,
  isLeftEdge,
  isRightEdge,
  showBR,
  showTL,
  colWidth,
  rowHeight,
  cellFontSize,
  formulaInput,
  onTap,
  onLongPress,
  onCellInputChange,
  onCellInputSubmit,
  onDragBottomRight,
  onDragTopLeft,
}: GridCellProps) {
  const displayValue = getDisplayValue(cell);
  const bgColor = cell?.style?.bgColor || '#FFFFFF';
  const textColor = cell?.style?.textColor || '#000000';

  return (
    <Pressable
      key={cellRef}
      onPress={(event) => onTap(row, col, event)}
      onLongPress={(event) => onLongPress(row, col, event)}
      delayLongPress={250}
      style={[
        styles.cell,
        {
          width: colWidth,
          height: rowHeight,
          backgroundColor: selected
            ? cell?.style?.bgColor ? bgColor : '#E8F0FE'
            : bgColor,
        },
        isMultiSelect && isTopEdge && styles.selTop,
        isMultiSelect && isBottomEdge && styles.selBottom,
        isMultiSelect && isLeftEdge && styles.selLeft,
        isMultiSelect && isRightEdge && styles.selRight,
        primary && !isMultiSelect && styles.cellPrimary,
      ]}
    >
      {editing ? (
        <TextInput
          style={[styles.cellInput, { color: textColor, fontSize: cellFontSize }]}
          value={formulaInput}
          onChangeText={onCellInputChange}
          onSubmitEditing={onCellInputSubmit}
          onBlur={onCellInputSubmit}
          autoFocus
          selectTextOnFocus
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />
      ) : (
        <Text
          style={[
            styles.cellText,
            {
              color: typeof cell?.value === 'number' && cell.value < 0 ? '#CC0000' : textColor,
              fontWeight: cell?.style?.bold ? 'bold' : 'normal',
              fontStyle: cell?.style?.italic ? 'italic' : 'normal',
              fontSize: cellFontSize,
            },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {displayValue}
        </Text>
      )}

      {showBR && (
        <SelectionHandle position="bottom-right" onDrag={onDragBottomRight} onDragEnd={() => {}} />
      )}
      {showTL && (
        <SelectionHandle position="top-left" onDrag={onDragTopLeft} onDragEnd={() => {}} />
      )}
    </Pressable>
  );
}, cellsAreEqual);

const GridRow = React.memo(function GridRow({
  row,
  cells,
  selection,
  editingCell,
  formulaInput,
  colWidth,
  rowHeight,
  rowHeaderWidth,
  cellFontSize,
  headerFontSize,
  onTap,
  onLongPress,
  onSelectRange,
  onCellInputChange,
  onCellInputSubmit,
  onDragBottomRight,
  onDragTopLeft,
}: GridRowProps) {
  const minR = Math.min(selection.start.row, selection.end.row);
  const maxR = Math.max(selection.start.row, selection.end.row);
  const minC = Math.min(selection.start.col, selection.end.col);
  const maxC = Math.max(selection.start.col, selection.end.col);
  const isMultiSelect = minR !== maxR || minC !== maxC;

  return (
    <View style={styles.row}>
      {/* Row number header */}
      <Pressable
        style={[styles.rowHeader, { width: rowHeaderWidth, height: rowHeight }]}
        onPress={() => onSelectRange({ row, col: 0 }, { row, col: COL_COUNT - 1 })}
      >
        <Text style={[styles.headerText, { fontSize: headerFontSize }]}>{row + 1}</Text>
      </Pressable>

      {/* Cells */}
      {COLUMN_DATA.map((col) => {
        const key = cellKey(row, col);
        const cell = cells[key];
        const selected = row >= minR && row <= maxR && col >= minC && col <= maxC;
        const primary = row === selection.start.row && col === selection.start.col;
        const editing = editingCell === key;

        const isTopEdge = selected && row === minR;
        const isBottomEdge = selected && row === maxR;
        const isLeftEdge = selected && col === minC;
        const isRightEdge = selected && col === maxC;
        const showBR = row === maxR && col === maxC && selected;
        const showTL = row === minR && col === minC && selected;

        return (
          <GridCell
            key={key}
            row={row}
            col={col}
            cellRef={key}
            cell={cell}
            selected={selected}
            primary={primary}
            editing={editing}
            isMultiSelect={isMultiSelect}
            isTopEdge={isTopEdge}
            isBottomEdge={isBottomEdge}
            isLeftEdge={isLeftEdge}
            isRightEdge={isRightEdge}
            showBR={showBR}
            showTL={showTL}
            colWidth={colWidth}
            rowHeight={rowHeight}
            cellFontSize={cellFontSize}
            formulaInput={formulaInput}
            onTap={onTap}
            onLongPress={onLongPress}
            onCellInputChange={onCellInputChange}
            onCellInputSubmit={onCellInputSubmit}
            onDragBottomRight={onDragBottomRight}
            onDragTopLeft={onDragTopLeft}
          />
        );
      })}
    </View>
  );
}, rowsAreEqual);

// ---------------------------------------------------------------------------
// Grid — main component
// ---------------------------------------------------------------------------
export function Grid({
  cells,
  selection,
  editingCell,
  formulaInput,
  formulaSelectionMode,
  cellScale,
  onSelectCell,
  onSelectRange,
  onLongPressCell,
  onDoubleTapCell,
  onCellInputChange,
  onCellInputSubmit,
}: GridProps) {
  const { width: screenWidth } = useWindowDimensions();
  const rowHeaderWidth = Math.max(44, Math.round(BASE_ROW_HEADER_WIDTH * cellScale));
  const headerHeight = Math.max(28, Math.round(BASE_HEADER_HEIGHT * cellScale));
  const rowHeight = Math.max(38, Math.round(BASE_ROW_HEIGHT * cellScale));
  const cellFontSize = Math.max(12, Math.round(BASE_CELL_FONT_SIZE * cellScale));
  const headerFontSize = Math.max(11, Math.round(BASE_HEADER_FONT_SIZE * cellScale));
  const colWidth = Math.max(84, Math.floor((screenWidth - rowHeaderWidth) / 8 * cellScale));

  // Measure the ScrollView height so FlatList gets an explicit height.
  // Without this, FlatList inside a horizontal ScrollView has infinite height
  // and virtualization is disabled (all 200 rows render at once).
  const [scrollViewHeight, setScrollViewHeight] = useState(600);
  const handleScrollViewLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setScrollViewHeight(h);
  }, []);
  const flatListHeight = Math.max(100, scrollViewHeight - headerHeight);

  // Double-tap detection
  const lastTap = useRef<{ row: number; col: number; time: number } | null>(null);
  const flatListRef = useRef<FlatList<number>>(null);
  
  // Auto-scroll to selected cell when selection changes
  useEffect(() => {
    if (flatListRef.current && selection.end.row > -1) {
      // Scroll to show the selected row with some padding
      flatListRef.current.scrollToItem({
        item: selection.end.row,
        viewPosition: 0.5, // Center the row in view
        animated: true,
      });
    }
  }, [selection.end.row]);
  const handleTap = useCallback(
    (row: number, col: number, event?: GestureResponderEvent) => {
      const pageX = event?.nativeEvent?.pageX || 0;
      const pageY = event?.nativeEvent?.pageY || 0;
      
      const now = Date.now();
      const prev = lastTap.current;
      if (prev && prev.row === row && prev.col === col && now - prev.time < 350) {
        lastTap.current = null;
        onDoubleTapCell(row, col);
      } else {
        lastTap.current = { row, col, time: now };
        onSelectCell(row, col, { x: pageX, y: pageY });
      }
    },
    [onSelectCell, onDoubleTapCell]
  );

  const minR = Math.min(selection.start.row, selection.end.row);
  const maxR = Math.max(selection.start.row, selection.end.row);
  const minC = Math.min(selection.start.col, selection.end.col);
  const maxC = Math.max(selection.start.col, selection.end.col);
  const isMultiSelect = minR !== maxR || minC !== maxC;

  // Track drag state with fractional positioning
  // Allows smooth tracking even when dr    agging small distances
  const dragStateRef = useRef({ 
    minR, maxR, minC, maxC, colWidth, rowHeight,
    lastReportedColShift: 0,
    lastReportedRowShift: 0,
  });
  
  // Reset shift tracking when selection changes (new drag started)
  if (dragStateRef.current.minR !== minR || dragStateRef.current.maxR !== maxR || 
      dragStateRef.current.minC !== minC || dragStateRef.current.maxC !== maxC) {
    dragStateRef.current.lastReportedColShift = 0;
    dragStateRef.current.lastReportedRowShift = 0;
  }
  dragStateRef.current = { minR, maxR, minC, maxC, colWidth, rowHeight, lastReportedColShift: dragStateRef.current.lastReportedColShift, lastReportedRowShift: dragStateRef.current.lastReportedRowShift };

  const handleBottomRightDrag = useCallback(
    (dx: number, dy: number) => {
      const s = dragStateRef.current;
      
      // Calculate total offset as floating point - allows accumulation
      const totalColOffset = dx / s.colWidth;
      const totalRowOffset = dy / s.rowHeight;
      
      // Use floor to count only complete cells crossed
      const colShift = Math.floor(totalColOffset);
      const rowShift = Math.floor(totalRowOffset);
      
      console.log(`[DragBR] dx=${dx}, dy=${dy}, colOff=${totalColOffset.toFixed(2)}, rowOff=${totalRowOffset.toFixed(2)}, shift=${colShift},${rowShift}`);
      
      // Only update if shift changed from last reported
      if (colShift === s.lastReportedColShift && rowShift === s.lastReportedRowShift) {
        console.log(`[DragBR] No change`);
        return;
      }
      
      // Update ref to track what we reported
      dragStateRef.current.lastReportedColShift = colShift;
      dragStateRef.current.lastReportedRowShift = rowShift;
      
      const newEndCol = Math.max(s.minC, Math.min(COL_COUNT - 1, s.maxC + colShift));
      const newEndRow = Math.max(s.minR, Math.min(ROW_COUNT - 1, s.maxR + rowShift));
      console.log(`[DragBR] Result: col=${newEndCol}, row=${newEndRow}`);
      onSelectRange({ row: s.minR, col: s.minC }, { row: newEndRow, col: newEndCol });
    },
    [onSelectRange]
  );

  const handleTopLeftDrag = useCallback(
    (dx: number, dy: number) => {
      const s = dragStateRef.current;
      
      // Calculate total offset as floating point
      const totalColOffset = dx / s.colWidth;
      const totalRowOffset = dy / s.rowHeight;
      
      // Use floor to count only complete cells crossed
      const colShift = Math.floor(totalColOffset);
      const rowShift = Math.floor(totalRowOffset);
      
      // Only update if shift changed from last reported
      if (colShift === s.lastReportedColShift && rowShift === s.lastReportedRowShift) return;
      
      dragStateRef.current.lastReportedColShift = colShift;
      dragStateRef.current.lastReportedRowShift = rowShift;
      
      const newStartCol = Math.max(0, Math.min(s.maxC, s.minC + colShift));
      const newStartRow = Math.max(0, Math.min(s.maxR, s.minR + rowShift));
      onSelectRange({ row: newStartRow, col: newStartCol }, { row: s.maxR, col: s.maxC });
    },
    [onSelectRange]
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: rowHeight,
      offset: rowHeight * index,
      index,
    }),
    [rowHeight]
  );

  const renderRow = useCallback(
    ({ item: row }: { item: number }) => (
      <GridRow
        row={row}
        cells={cells}
        selection={selection}
        editingCell={editingCell}
        formulaInput={formulaInput}
        colWidth={colWidth}
        rowHeight={rowHeight}
        rowHeaderWidth={rowHeaderWidth}
        cellFontSize={cellFontSize}
        headerFontSize={headerFontSize}
        onTap={handleTap}
        onLongPress={onLongPressCell}
        onSelectRange={onSelectRange}
        onCellInputChange={onCellInputChange}
        onCellInputSubmit={onCellInputSubmit}
        onDragBottomRight={handleBottomRightDrag}
        onDragTopLeft={handleTopLeftDrag}
      />
    ),
    [
      cells,
      selection,
      editingCell,
      formulaInput,
      colWidth,
      rowHeight,
      rowHeaderWidth,
      cellFontSize,
      headerFontSize,
      handleTap,
      onLongPressCell,
      onSelectRange,
      onCellInputChange,
      onCellInputSubmit,
      handleBottomRightDrag,
      handleTopLeftDrag,
    ]
  );

  return (
    <View style={styles.container}>
      {isMultiSelect && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionBarText}>
            {formulaSelectionMode
              ? `Range for formula: ${cellKey(minR, minC)}:${cellKey(maxR, maxC)}`
              : `${cellKey(minR, minC)}:${cellKey(maxR, maxC)}`}
          </Text>
        </View>
      )}

      {/*
        directionalLockEnabled: prevents the horizontal ScrollView from
        intercepting touches when the user is scrolling vertically.
        This fixes the "trying to scroll down but panning sideways" problem.
      */}
      <ScrollView
        horizontal
        bounces={false}
        directionalLockEnabled
        showsHorizontalScrollIndicator={true}
        style={styles.scrollView}
        onLayout={handleScrollViewLayout}
      >
        <View>
          {/* Column headers */}
          <View style={styles.headerRow}>
            <View style={[styles.cornerCell, { width: rowHeaderWidth, height: headerHeight }]} />
            {COLUMN_DATA.map((col) => (
              <Pressable
                key={col}
                style={[styles.colHeader, { width: colWidth, height: headerHeight }]}
                onPress={() => onSelectRange({ row: 0, col }, { row: ROW_COUNT - 1, col })}
              >
                <Text style={[styles.headerText, { fontSize: headerFontSize }]}>{colToLetter(col)}</Text>
              </Pressable>
            ))}
          </View>

          {/*
            Explicit height on FlatList is CRITICAL.
            Without it, FlatList inside a ScrollView gets infinite height and
            renders all 200 rows at once, killing performance.
          */}
          <FlatList
            ref={flatListRef}
            data={ROW_DATA}
            renderItem={renderRow}
            keyExtractor={(item) => String(item)}
            getItemLayout={getItemLayout}
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            style={{ height: flatListHeight }}
            scrollEnabled={true}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  selectionBar: {
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#C5D9F5',
  },
  selectionBarText: {
    fontSize: 13,
    color: '#1A73E8',
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#DADCE0',
  },
  cornerCell: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRightWidth: 1,
    borderRightColor: '#DADCE0',
  },
  colHeader: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E8EAED',
    backgroundColor: '#F8F9FA',
  },
  row: {
    flexDirection: 'row',
  },
  rowHeader: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRightWidth: 1,
    borderRightColor: '#DADCE0',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
  },
  headerText: {
    fontSize: 12,
    color: '#5F6368',
    fontWeight: '500',
  },
  cell: {
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#E8EAED',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAED',
    overflow: 'visible',
  },
  cellPrimary: {
    borderWidth: 2,
    borderColor: '#1A73E8',
  },
  selTop: {
    borderTopWidth: 2,
    borderTopColor: '#1A73E8',
  },
  selBottom: {
    borderBottomWidth: 2,
    borderBottomColor: '#1A73E8',
  },
  selLeft: {
    borderLeftWidth: 2,
    borderLeftColor: '#1A73E8',
  },
  selRight: {
    borderRightWidth: 2,
    borderRightColor: '#1A73E8',
  },
  cellText: {
    fontSize: 14,
    textAlign: 'right',
  },
  cellInput: {
    fontSize: 14,
    padding: 0,
    margin: 0,
    textAlign: 'right',
    flex: 1,
  },
});
