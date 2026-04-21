import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View, GestureResponderEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';

import { File as ExpoFile } from 'expo-file-system/next';

import { useWorkbook } from '../store/useWorkbook';
import { Grid } from './Grid';
import { Toolbar } from './Toolbar';
import { SheetTabs } from './SheetTabs';
import { StatusBar } from './StatusBar';
import { ContextMenu } from './ContextMenu';
import { cellKey, letterToCol } from '../utils/cells';
import {
  loadWorkbookDraft,
  saveWorkbookDraft,
  saveWorkbookExport,
} from '../utils/localStorage';
import { Cell, Currency } from '../types';

const MIN_CELL_SCALE = 0.3;
const MAX_CELL_SCALE = 1.4;
const CELL_SCALE_STEP = 0.1;

function sanitizeFileName(name: string) {
  return name.replace(/[\/\\?%*:|"<>]/g, '_').trim();
}

function baseNameNoExt(name: string) {
  return name.replace(/\.xlsx$/i, '');
}

function formatRangeRef(
  start: { row: number; col: number },
  end: { row: number; col: number }
) {
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const startRef = cellKey(minRow, minCol);
  const endRef = cellKey(maxRow, maxCol);
  return startRef === endRef ? startRef : `${startRef}:${endRef}`;
}

// Convert SheetJS workbook → our native Cell/Sheet format
function sheetjsToCells(ws: XLSX.WorkSheet): Record<string, Cell> {
  const cells: Record<string, Cell> = {};
  if (!ws || !ws['!ref']) return cells;

  const range = XLSX.utils.decode_range(ws['!ref']);

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const xlCell = ws[addr] as XLSX.CellObject | undefined;
      if (!xlCell) continue;

      const cell: Cell = { value: null, style: {} };

      if (xlCell.f) {
        cell.formula = `=${xlCell.f}`;
      }
      if (xlCell.v !== undefined && xlCell.v !== null) {
        cell.value = typeof xlCell.v === 'boolean' ? (xlCell.v ? 1 : 0) : xlCell.v as string | number;
      }

      // Extract basic styling from xlsx cell
      if (xlCell.s) {
        const s = xlCell.s as any;
        if (s.font?.bold) cell.style.bold = true;
        if (s.font?.italic) cell.style.italic = true;
        if (s.font?.color?.rgb) cell.style.textColor = `#${s.font.color.rgb}`;
        if (s.fill?.fgColor?.rgb) cell.style.bgColor = `#${s.fill.fgColor.rgb}`;
      }

      if (cell.value !== null || cell.formula) {
        cells[addr] = cell;
      }
    }
  }

  return cells;
}

// Convert our native Cell format → SheetJS worksheet
function cellsToSheetjs(cells: Record<string, Cell>): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  let maxR = -1;
  let maxC = -1;

  for (const [addr, cell] of Object.entries(cells)) {
    if (cell.value === null && !cell.formula) continue;

    const decoded = XLSX.utils.decode_cell(addr);
    maxR = Math.max(maxR, decoded.r);
    maxC = Math.max(maxC, decoded.c);

    const outCell: any = {};
    if (cell.formula) {
      const f = cell.formula;
      outCell.f = f.startsWith('=') ? f.slice(1) : f;
    }
    if (cell.value !== undefined && cell.value !== null) {
      outCell.v = cell.value;
      if (typeof cell.value === 'number') outCell.t = 'n';
      else if (typeof cell.value === 'string') outCell.t = 's';
      else outCell.t = 'z';
    }

    ws[addr] = outCell;
  }

  ws['!ref'] = maxR >= 0 && maxC >= 0
    ? XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } })
    : 'A1';

  return ws;
}

export function SpreadsheetScreen() {
  const wb = useWorkbook();
  const [title, setTitle] = useState('Hisobot');
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formulaSelectionMode] = useState(false);
  const [cellScale, setCellScale] = useState(1);
  const [rangeSelectionAnchor, setRangeSelectionAnchor] = useState<{ row: number; col: number } | null>(null);
  const [rangeSelectionEnd, setRangeSelectionEnd] = useState<{ row: number; col: number } | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [lastTapPosition, setLastTapPosition] = useState<{ x: number; y: number } | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: { x: number; y: number };
  }>({ visible: false, position: { x: 0, y: 0 } });

  // Debounce pending range updates to prevent excessive re-renders during drag
  const pendingRangeRef = useRef<{ start: { row: number; col: number }; end: { row: number; col: number } } | null>(null);
  const rangeUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track range mode with ref to avoid stale state closures
  const rangeModeRef = useRef<{ active: boolean; anchor: { row: number; col: number } | null }>({ 
    active: false, 
    anchor: null 
  });

  // helper to read a cell's editable text (formula if present, else value)
  const getCellText = useCallback((row: number, col: number) => {
    const key = cellKey(row, col);
    const cell = wb.activeSheet.cells[key];
    return cell?.formula || (cell?.value !== null && cell?.value !== undefined ? String(cell.value) : '');
  }, [wb]);

  useEffect(() => {
    let cancelled = false;

    const restoreDraft = async () => {
      try {
        const draft = await loadWorkbookDraft();
        if (cancelled || !draft) return;

        wb.loadWorkbook(draft.workbook);
        setTitle(draft.title || 'Hisobot');
        setCurrentFileName(draft.currentFileName);
      } finally {
        if (!cancelled) {
          setStorageReady(true);
        }
      }
    };

    restoreDraft();

    return () => {
      cancelled = true;
    };
  }, [wb.loadWorkbook]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (rangeUpdateTimeoutRef.current) {
        clearTimeout(rangeUpdateTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    const timeoutId = setTimeout(() => {
      try {
        saveWorkbookDraft({
          workbook: wb.workbook,
          title,
          currentFileName,
        });
      } catch (error) {
        console.warn('Failed to save local draft', error);
      }
    }, 450);

    return () => clearTimeout(timeoutId);
  }, [storageReady, wb.workbook, title, currentFileName]);

  // --- Cell interaction handlers ---
  const handleSelectCell = useCallback((row: number, col: number, position?: { x: number; y: number }) => {
    if (position) {
      setLastTapPosition(position);
    }
    
    console.log(`[SelectCell] row=${row}, col=${col}, rangeMode=${rangeModeRef.current.active}, anchor=${JSON.stringify(rangeModeRef.current.anchor)}`);
    
    // If in workbook hook's range selection mode
    if (wb.rangeSelectionMode) {
      console.log(`[SelectCell] Using workbook range mode`);
      wb.applyRangeSelection({ row, col });
      return;
    }

    // If format painter is active
    if (wb.formatPainterStyle) {
      console.log(`[SelectCell] Format painter active`);
      wb.applyFormatPainter();
      rangeModeRef.current = { active: false, anchor: null };
      setRangeSelectionAnchor(null);
      setRangeSelectionEnd(null);
      return;
    }

    // If in range mode, handle first/second cell selection
    if (rangeModeRef.current.active) {
      if (rangeModeRef.current.anchor === null) {
        // First cell in range mode
        console.log(`[SelectCell] First cell in range mode: ${row},${col}`);
        wb.setSelection({ start: { row, col }, end: { row, col } });
        wb.setEditingCell(null);
        wb.setFormulaInput(getCellText(row, col));
        rangeModeRef.current.anchor = { row, col };
        setRangeSelectionAnchor({ row, col });
        return;
      } else {
        // Second cell in range mode - SHOW MENU
        console.log(`[SelectCell] Second cell in range mode: ${row},${col}`);
        const anchor = rangeModeRef.current.anchor;
        wb.setSelection({ start: anchor, end: { row, col } });
        wb.setEditingCell(null);
        wb.setFormulaInput(getCellText(row, col));
        rangeModeRef.current = { active: false, anchor: null };
        setRangeSelectionAnchor(anchor);
        setRangeSelectionEnd({ row, col });
        // Show context menu after range is complete
        if (position) {
          console.log(`[SelectCell] Showing menu at ${position.x}, ${position.y}`);
          setContextMenu({ visible: true, position });
        }
        return;
      }
    }

    // Tapping the already-selected cell → enter edit mode (like Excel)
    if (
      wb.selection.start.row === row &&
      wb.selection.start.col === col &&
      wb.selection.end.row === row &&
      wb.selection.end.col === col &&
      !wb.editingCell
    ) {
      console.log(`[SelectCell] Re-tapping same cell - enter edit mode`);
      wb.setEditingCell(cellKey(row, col));
      wb.setFormulaInput(getCellText(row, col));
      return;
    }

    // Normal cell selection
    console.log(`[SelectCell] Normal selection`);
    wb.setSelection({ start: { row, col }, end: { row, col } });
    wb.setEditingCell(null);
    wb.setFormulaInput(getCellText(row, col));
    rangeModeRef.current = { active: false, anchor: null };
    setRangeSelectionAnchor(null);
    setRangeSelectionEnd(null);
  }, [wb, getCellText]);

  const handleSelectRange = useCallback((start: { row: number; col: number }, end: { row: number; col: number }) => {
    // Update selection immediately during drag
    // The throttle in SelectionHandle (16ms) already limits call frequency
    // So we don't need additional debounce - that just delays the visual feedback
    wb.setSelection({ start, end });
  }, [wb]);

  const handleDoubleTapCell = useCallback((row: number, col: number) => {
    const key = cellKey(row, col);
    setRangeSelectionAnchor(null);
    setRangeSelectionEnd(null);
    wb.setEditingCell(key);
    const cell = wb.activeSheet.cells[key];
    wb.setFormulaInput(cell?.formula || (cell?.value !== null && cell?.value !== undefined ? String(cell.value) : ''));
  }, [wb]);

  const handleLongPressCell = useCallback((row: number, col: number, event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    setRangeSelectionAnchor(null);
    setRangeSelectionEnd(null);
    wb.setSelection({ start: { row, col }, end: { row, col } });
    setContextMenu({ visible: true, position: { x: pageX, y: pageY } });
  }, [wb]);

  const handleCellInputChange = useCallback((text: string) => {
    wb.setFormulaInput(text);
  }, [wb]);

  const handleCellInputSubmit = useCallback(() => {
    let commitRow: number;
    let commitCol: number;

    if (wb.editingCell) {
      const match = wb.editingCell.match(/^([A-Z]+)(\d+)$/);
      if (match) {
        commitCol = letterToCol(match[1]);
        commitRow = parseInt(match[2]) - 1;
      } else {
        commitRow = wb.selection.start.row;
        commitCol = wb.selection.start.col;
      }
    } else {
      commitRow = wb.selection.start.row;
      commitCol = wb.selection.start.col;
    }

    wb.setCellValue(commitRow, commitCol, wb.formulaInput);
    wb.setEditingCell(null);
    setRangeSelectionAnchor(null);
    setRangeSelectionEnd(null);

    // Move to the next row (like Excel)
    const nextRow = commitRow + 1;
    wb.setSelection({ start: { row: nextRow, col: commitCol }, end: { row: nextRow, col: commitCol } });
    wb.setFormulaInput(getCellText(nextRow, commitCol));
  }, [wb, getCellText]);

  // --- Toolbar handlers ---
  const handleFormulaChange = useCallback((text: string) => {
    wb.setFormulaInput(text);
  }, [wb]);

  const handleFormulaFocus = useCallback(() => {
    // Could enable formula selection mode here
  }, []);

  const handleFormulaSubmit = useCallback(() => {
    const { row, col } = wb.selection.start;
    setRangeSelectionAnchor(null);
    setRangeSelectionEnd(null);
    wb.setCellValue(row, col, wb.formulaInput);
    wb.setEditingCell(null);

    // Move to the next row (like Excel)
    const nextRow = row + 1;
    wb.setSelection({ start: { row: nextRow, col }, end: { row: nextRow, col } });
    wb.setFormulaInput(getCellText(nextRow, col));
  }, [wb, getCellText]);

  const handleBoldPress = useCallback(() => {
    const { rows, cols } = wb.getSelectedRange();
    const key = cellKey(wb.selection.start.row, wb.selection.start.col);
    const current = wb.activeSheet.cells[key];
    wb.setCellStyle(rows, cols, { bold: !current?.style?.bold });
  }, [wb]);

  const handleItalicPress = useCallback(() => {
    const { rows, cols } = wb.getSelectedRange();
    const key = cellKey(wb.selection.start.row, wb.selection.start.col);
    const current = wb.activeSheet.cells[key];
    wb.setCellStyle(rows, cols, { italic: !current?.style?.italic });
  }, [wb]);

  const handleColorPress = useCallback((color: string) => {
    const { rows, cols } = wb.getSelectedRange();
    wb.setCellStyle(rows, cols, { bgColor: color });
  }, [wb]);

  const handleTextColorPress = useCallback((color: string) => {
    const { rows, cols } = wb.getSelectedRange();
    wb.setCellStyle(rows, cols, { textColor: color });
  }, [wb]);

  const handleCurrencyPress = useCallback((currency: Currency) => {
    const { rows, cols } = wb.getSelectedRange();
    wb.setCellStyle(rows, cols, { currency });
  }, [wb]);

  const handleToggleRangeSelection = useCallback(() => {
    console.log(`[ToggleRange] Current active=${rangeModeRef.current.active}`);
    
    if (!rangeModeRef.current.active) {
      console.log(`[ToggleRange] Starting range mode`);
      rangeModeRef.current = { active: true, anchor: null };
      setRangeSelectionAnchor({ row: -1, col: -1 });
      wb.setEditingCell(null);
    } else {
      console.log(`[ToggleRange] Canceling range mode`);
      rangeModeRef.current = { active: false, anchor: null };
      setRangeSelectionAnchor(null);
      setRangeSelectionEnd(null);
    }
  }, [wb]);

  const handleDecreaseCellSize = useCallback(() => {
    setCellScale((current) => Math.max(MIN_CELL_SCALE, Number((current - CELL_SCALE_STEP).toFixed(2))));
  }, []);

  const handleIncreaseCellSize = useCallback(() => {
    setCellScale((current) => Math.min(MAX_CELL_SCALE, Number((current + CELL_SCALE_STEP).toFixed(2))));
  }, []);

  // --- Context menu handlers ---
  const handleClear = useCallback(() => {
    const { rows, cols } = wb.getSelectedRange();
    for (const r of rows) {
      for (const c of cols) {
        wb.setCellValue(r, c, '');
      }
    }
  }, [wb]);

  // --- File handlers ---
  const handleOpen = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (res.canceled) return;
    const asset = res.assets?.[0];
    if (!asset?.uri) return;

    try {
      const file = new ExpoFile(asset.uri);
      const base64 = await file.base64();

      const xlWb = XLSX.read(base64, { type: 'base64', cellStyles: true });
      const niceName = asset.name ? baseNameNoExt(asset.name) : 'Workbook';

      // Convert each sheet
      const sheets = xlWb.SheetNames.map((sheetName, idx) => {
        const ws = xlWb.Sheets[sheetName];
        return {
          id: `imported-${idx}-${Date.now()}`,
          name: sheetName,
          cells: sheetjsToCells(ws),
          colWidths: {} as Record<number, number>,
          rowHeights: {} as Record<number, number>,
        };
      });

      if (sheets.length === 0) {
        Alert.alert('Empty file', 'No sheets found in the workbook.');
        return;
      }

      // Load into workbook state
      wb.loadWorkbook({ sheets, activeSheetId: sheets[0].id });
      setRangeSelectionAnchor(null);
      setRangeSelectionEnd(null);
      setTitle(niceName);
      setCurrentFileName(asset.name ? sanitizeFileName(asset.name) : null);
    } catch (e: any) {
      Alert.alert('Open failed', String(e?.message || e));
    }
  }, [wb]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Save not available on web', 'Local device storage is enabled for iPhone/iPad and Android builds, not browser preview.');
        return;
      }

      const outWb = XLSX.utils.book_new();

      for (const sheet of wb.workbook.sheets) {
        const ws = cellsToSheetjs(sheet.cells);
        // Ensure sheet name is valid for xlsx (max 31 chars, no special chars)
        const safeName = sheet.name.slice(0, 31).replace(/[\/\\?*[\]]/g, '_') || 'Sheet';
        XLSX.utils.book_append_sheet(outWb, ws, safeName);
      }

      const base64 = XLSX.write(outWb, { bookType: 'xlsx', type: 'base64' });

      const suggested = currentFileName
        || sanitizeFileName(`${title || 'Workbook'}.xlsx`)
        || `Workbook-${Date.now()}.xlsx`;

      const fileName = suggested.endsWith('.xlsx') ? suggested : `${suggested}.xlsx`;
      saveWorkbookExport(fileName, base64);
      saveWorkbookDraft({
        workbook: wb.workbook,
        title,
        currentFileName: fileName,
      });
      setCurrentFileName(fileName);

      Alert.alert(
        'Saved locally',
        `Stored on this device as ${fileName}.\n\nOn iPad builds, open it from Files > On My iPad > mobile > ExcelClone > SavedWorkbooks.`
      );
    } catch (e: any) {
      Alert.alert('Save failed', String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }, [wb, currentFileName, title]);

  const primaryCellRef = cellKey(wb.selection.start.row, wb.selection.start.col);
  const rangeSelectionLabel = !rangeSelectionAnchor
    ? 'Range'
    : rangeSelectionEnd
      ? 'Confirm'
      : 'Cancel';

  const rangeSelectionDetail = !rangeSelectionAnchor
    ? '1st cell -> button -> 2nd cell'
    : rangeSelectionEnd
      ? formatRangeRef(rangeSelectionAnchor, rangeSelectionEnd)
      : `Pick end from ${cellKey(rangeSelectionAnchor.row, rangeSelectionAnchor.col)}`;

  const selectedCellRef = useMemo(() => {
    return formatRangeRef(wb.selection.start, wb.selection.end);
  }, [wb.selection]);

  const currentCell = wb.activeSheet.cells[primaryCellRef];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ExpoStatusBar style="dark" />

      {/* Top bar with title + Open/Save */}
      <View style={styles.topBar}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.openBtn, saving && styles.btnDisabled]}
            onPress={handleOpen}
            disabled={saving}
          >
            <Text style={styles.openBtnText}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Toolbar: formatting + formula bar */}
      <Toolbar
        selectedCellRef={selectedCellRef}
        formulaInput={wb.formulaInput}
        isBoldActive={!!currentCell?.style?.bold}
        isItalicActive={!!currentCell?.style?.italic}
        selectedFillColor={currentCell?.style?.bgColor || '#FFFFFF'}
        selectedTextColor={currentCell?.style?.textColor || '#000000'}
        selectedCurrency={currentCell?.style?.currency || ''}
        rangeSelectionActive={!!rangeSelectionAnchor}
        rangeSelectionLabel={rangeSelectionLabel}
        rangeSelectionDetail={rangeSelectionDetail}
        cellScalePercent={Math.round(cellScale * 100)}
        canDecreaseCellSize={cellScale > MIN_CELL_SCALE}
        canIncreaseCellSize={cellScale < MAX_CELL_SCALE}
        onFormulaChange={handleFormulaChange}
        onFormulaFocus={handleFormulaFocus}
        onFormulaSubmit={handleFormulaSubmit}
        onBoldPress={handleBoldPress}
        onItalicPress={handleItalicPress}
        onColorPress={handleColorPress}
        onTextColorPress={handleTextColorPress}
        onCurrencyPress={handleCurrencyPress}
        onUndoPress={wb.undo}
        onRedoPress={wb.redo}
        onToggleRangeSelection={handleToggleRangeSelection}
        onDecreaseCellSize={handleDecreaseCellSize}
        onIncreaseCellSize={handleIncreaseCellSize}
        canUndo={wb.canUndo}
        canRedo={wb.canRedo}
      />

      {/* Range selection mode UI - from workbook hook */}
      {wb.rangeSelectionMode && (
        <View style={styles.rangeSelectionBar}>
          <Text style={styles.rangeSelectionText}>
            Select second cell: {wb.rangeStart ? `${cellKey(wb.rangeStart.row, wb.rangeStart.col)}` : ''}
          </Text>
          <TouchableOpacity 
            style={styles.rangeConfirmButton}
            onPress={() => wb.cancelRangeSelection()}
          >
            <Text style={styles.rangeConfirmText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Range selection mode UI - waiting for FIRST cell */}
      {rangeSelectionAnchor?.row === -1 && rangeSelectionAnchor?.col === -1 && !wb.rangeSelectionMode && (
        <View style={styles.rangeSelectionBar}>
          <Text style={styles.rangeSelectionText}>
            📍 Range mode: tap FIRST cell
          </Text>
          <TouchableOpacity 
            style={styles.rangeConfirmButton}
            onPress={handleToggleRangeSelection}
          >
            <Text style={styles.rangeConfirmText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Range selection mode UI - waiting for SECOND cell */}
      {rangeSelectionAnchor !== null && rangeSelectionAnchor.row !== -1 && rangeSelectionEnd === null && !wb.rangeSelectionMode && (
        <View style={styles.rangeSelectionBar}>
          <Text style={styles.rangeSelectionText}>
            📍 Range mode: tap SECOND cell (anchor: {cellKey(rangeSelectionAnchor.row, rangeSelectionAnchor.col)})
          </Text>
          <TouchableOpacity 
            style={styles.rangeConfirmButton}
            onPress={handleToggleRangeSelection}
          >
            <Text style={styles.rangeConfirmText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Range selection complete */}
      {rangeSelectionEnd !== null && !wb.rangeSelectionMode && (
        <View style={styles.rangeSelectionBar}>
          <Text style={styles.rangeSelectionText}>
            ✓ Range selected: {cellKey(rangeSelectionAnchor!.row, rangeSelectionAnchor!.col)}:{cellKey(rangeSelectionEnd.row, rangeSelectionEnd.col)}
          </Text>
          <TouchableOpacity 
            style={styles.rangeConfirmButton}
            onPress={handleToggleRangeSelection}
          >
            <Text style={styles.rangeConfirmText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Grid */}
      <Grid
        cells={wb.activeSheet.cells}
        selection={wb.selection}
        editingCell={wb.editingCell}
        formulaInput={wb.formulaInput}
        formulaSelectionMode={formulaSelectionMode}
        cellScale={cellScale}
        onSelectCell={handleSelectCell}
        onSelectRange={handleSelectRange}
        onLongPressCell={handleLongPressCell}
        onDoubleTapCell={handleDoubleTapCell}
        onCellInputChange={handleCellInputChange}
        onCellInputSubmit={handleCellInputSubmit}
      />

      {/* Status bar (SUM/AVG/COUNT for multi-select) */}
      <StatusBar cells={wb.activeSheet.cells} selection={wb.selection} />

      {/* Sheet tabs */}
      <SheetTabs
        sheets={wb.workbook.sheets}
        activeSheetId={wb.workbook.activeSheetId}
        onSwitchSheet={wb.switchSheet}
        onAddSheet={wb.addSheet}
        onRenameSheet={wb.renameSheet}
        onDeleteSheet={wb.deleteSheet}
      />

      {/* Context menu (long-press) */}
      <ContextMenu
        visible={contextMenu.visible}
        position={contextMenu.position}
        hasClipboard={!!wb.clipboard}
        hasFormatPainter={!!wb.formatPainterStyle}
        onClose={() => setContextMenu({ visible: false, position: { x: 0, y: 0 } })}
        onFormula={(type) => wb.applyFormulaToSelection(type)}
        onColor={handleColorPress}
        onCurrency={handleCurrencyPress}
        onCopy={() => wb.copySelection('copy')}
        onCut={() => wb.copySelection('cut')}
        onPaste={(mode) => wb.pasteToSelection(mode)}
        onFormatPainterPick={wb.pickFormatPainter}
        onFormatPainterApply={wb.applyFormatPainter}
        onClear={handleClear}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DADCE0',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A73E8',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  openBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#E8F0FE',
    borderRadius: 8,
  },
  openBtnText: {
    color: '#1A73E8',
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: '#1A73E8',
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rangeSelectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF3CD',
    borderBottomWidth: 1,
    borderBottomColor: '#FFC107',
  },
  rangeSelectionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    flex: 1,
  },
  rangeConfirmButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFC107',
    borderRadius: 6,
  },
  rangeConfirmText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
