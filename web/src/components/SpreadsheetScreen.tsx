import { useEffect, useMemo, useRef, useState } from 'react';

import type { FileDescriptor } from '../types';
import { cellKey, letterToCol } from '../utils/cells';
import { ROW_INCREMENT_OPTIONS } from '../utils/workbookLayout';
import type { WorkbookStore } from '../store/useWorkbook';

import { ContextMenu } from './ContextMenu';
import { Grid } from './Grid';
import { SheetTabs } from './SheetTabs';
import { StatusBar } from './StatusBar';
import { Toolbar } from './Toolbar';
import styles from './SpreadsheetScreen.module.css';

const MIN_CELL_SCALE = 0.3;
const MAX_CELL_SCALE = 1.4;
const CELL_SCALE_STEP = 0.1;

function formatRangeRef(
  start: { row: number; col: number },
  end: { row: number; col: number },
) {
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const startRef = cellKey(minRow, minCol);
  const endRef = cellKey(maxRow, maxCol);
  return startRef === endRef ? startRef : `${startRef}:${endRef}`;
}

function formatSourceLabel(file: FileDescriptor | null) {
  if (!file) return 'Local browser draft';
  if (file.source === 'google-drive') return 'Google Drive';
  if (file.source === 'device') return 'Device file';
  return 'Local browser draft';
}

interface SpreadsheetScreenProps {
  workbookStore: WorkbookStore;
  title: string;
  currentFileName: string | null;
  activeFile: FileDescriptor | null;
  localSaving: boolean;
  driveSaving: boolean;
  driveConfigured: boolean;
  driveConnected: boolean;
  onGoHome: () => void;
  onOpenFromDevice: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onSaveToDrive: () => void;
  onConnectDrive: () => void;
}

export function SpreadsheetScreen({
  workbookStore,
  title,
  currentFileName,
  activeFile,
  localSaving,
  driveSaving,
  driveConfigured,
  driveConnected,
  onGoHome,
  onOpenFromDevice,
  onSave,
  onSaveAs,
  onSaveToDrive,
  onConnectDrive,
}: SpreadsheetScreenProps) {
  const storeRef = useRef(workbookStore);
  const saveRef = useRef(onSave);

  const [formulaSelectionMode] = useState(false);
  const [cellScale, setCellScale] = useState(1);
  const [rangeSelectionAnchor, setRangeSelectionAnchor] = useState<{ row: number; col: number } | null>(null);
  const [rangeSelectionEnd, setRangeSelectionEnd] = useState<{ row: number; col: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: { x: number; y: number };
  }>({ visible: false, position: { x: 0, y: 0 } });

  const maxRowIndex = Math.max(0, workbookStore.activeSheet.visibleRowCount - 1);

  useEffect(() => {
    storeRef.current = workbookStore;
    saveRef.current = onSave;
  }, [onSave, workbookStore]);

  function getCellText(row: number, col: number) {
    const key = cellKey(row, col);
    const cell = workbookStore.activeSheet.cells[key];
    return cell?.formula || (
      cell?.value !== null && cell?.value !== undefined
        ? String(cell.value)
        : ''
    );
  }

  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      const store = storeRef.current;
      const target = event.target as HTMLElement | null;
      const isEditableTarget = !!target && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.isContentEditable
      );

      if ((event.metaKey || event.ctrlKey) && !isEditableTarget) {
        const key = event.key.toLowerCase();
        if (key === 'c') {
          event.preventDefault();
          store.copySelection('copy');
          return;
        }
        if (key === 'x') {
          event.preventDefault();
          store.copySelection('cut');
          return;
        }
        if (key === 'v') {
          event.preventDefault();
          store.pasteToSelection('all');
          return;
        }
        if (key === 'z' && !event.shiftKey) {
          event.preventDefault();
          store.undo();
          return;
        }
        if (key === 'y' || (key === 'z' && event.shiftKey)) {
          event.preventDefault();
          store.redo();
          return;
        }
        if (key === 's') {
          event.preventDefault();
          saveRef.current();
          return;
        }
      }

      if (isEditableTarget) return;

      if (event.key === 'Escape') {
        setContextMenu({ visible: false, position: { x: 0, y: 0 } });
        setRangeSelectionAnchor(null);
        setRangeSelectionEnd(null);
        store.setEditingCell(null);
        return;
      }

      const currentRow = store.selection.start.row;
      const currentCol = store.selection.start.col;
      const activeMaxRowIndex = Math.max(0, store.activeSheet.visibleRowCount - 1);

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        store.setSelection({
          start: { row: Math.max(0, currentRow - 1), col: currentCol },
          end: { row: Math.max(0, currentRow - 1), col: currentCol },
        });
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        store.setSelection({
          start: { row: Math.min(activeMaxRowIndex, currentRow + 1), col: currentCol },
          end: { row: Math.min(activeMaxRowIndex, currentRow + 1), col: currentCol },
        });
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        store.setSelection({
          start: { row: currentRow, col: Math.max(0, currentCol - 1) },
          end: { row: currentRow, col: Math.max(0, currentCol - 1) },
        });
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        store.setSelection({
          start: { row: currentRow, col: Math.min(25, currentCol + 1) },
          end: { row: currentRow, col: Math.min(25, currentCol + 1) },
        });
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        const { rows, cols } = store.getSelectedRange();
        store.clearCells(rows, cols);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        store.setSelection({
          start: { row: Math.min(activeMaxRowIndex, currentRow + 1), col: currentCol },
          end: { row: Math.min(activeMaxRowIndex, currentRow + 1), col: currentCol },
        });
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  function handleSelectCell(
    row: number,
    col: number,
    options?: { position?: { x: number; y: number }; extendSelection?: boolean },
  ) {
    if (workbookStore.editingCell) {
      const match = workbookStore.editingCell.match(/^([A-Z]+)(\d+)$/);
      if (match) {
        const editCol = letterToCol(match[1]);
        const editRow = parseInt(match[2], 10) - 1;
        if (editRow !== row || editCol !== col) {
          workbookStore.setCellValue(editRow, editCol, workbookStore.formulaInput);
          workbookStore.setEditingCell(null);
        }
      }
    }

    if (workbookStore.rangeSelectionMode) {
      workbookStore.applyRangeSelection({ row, col });
      return;
    }

    if (workbookStore.formatPainterStyle) {
      workbookStore.setSelection({ start: { row, col }, end: { row, col } });
      workbookStore.applyFormatPainter();
      setRangeSelectionAnchor(null);
      setRangeSelectionEnd(null);
      return;
    }

    if (rangeSelectionAnchor && rangeSelectionAnchor.row === -1 && rangeSelectionAnchor.col === -1) {
      workbookStore.setSelection({ start: { row, col }, end: { row, col } });
      workbookStore.setEditingCell(null);
      workbookStore.setFormulaInput(getCellText(row, col));
      setRangeSelectionAnchor({ row, col });
      return;
    }

    if (rangeSelectionAnchor && rangeSelectionEnd === null) {
      workbookStore.setSelection({ start: rangeSelectionAnchor, end: { row, col } });
      workbookStore.setEditingCell(null);
      workbookStore.setFormulaInput(getCellText(row, col));
      setRangeSelectionEnd({ row, col });
      if (options?.position) {
        setContextMenu({ visible: true, position: options.position });
      }
      return;
    }

    if (options?.extendSelection) {
      workbookStore.setSelection({
        start: workbookStore.selection.start,
        end: { row, col },
      });
      workbookStore.setEditingCell(null);
      workbookStore.setFormulaInput(getCellText(row, col));
      return;
    }

    workbookStore.setSelection({ start: { row, col }, end: { row, col } });
    workbookStore.setEditingCell(null);
    workbookStore.setFormulaInput(getCellText(row, col));
    setRangeSelectionAnchor(null);
    setRangeSelectionEnd(null);
  }

  function handleDoubleTapCell(row: number, col: number) {
    const key = cellKey(row, col);
    setRangeSelectionAnchor(null);
    setRangeSelectionEnd(null);
    workbookStore.setEditingCell(key);
    workbookStore.setFormulaInput(getCellText(row, col));
  }

  function handleLongPressCell(row: number, col: number, position: { x: number; y: number }) {
    setRangeSelectionAnchor(null);
    setRangeSelectionEnd(null);
    workbookStore.setSelection({ start: { row, col }, end: { row, col } });
    setContextMenu({ visible: true, position });
  }

  function handleCellInputSubmit() {
    let commitRow = workbookStore.selection.start.row;
    let commitCol = workbookStore.selection.start.col;

    if (workbookStore.editingCell) {
      const match = workbookStore.editingCell.match(/^([A-Z]+)(\d+)$/);
      if (match) {
        commitCol = letterToCol(match[1]);
        commitRow = parseInt(match[2], 10) - 1;
      }
    }

    workbookStore.setCellValue(commitRow, commitCol, workbookStore.formulaInput);
    workbookStore.setEditingCell(null);
    setRangeSelectionAnchor(null);
    setRangeSelectionEnd(null);

    const nextRow = Math.min(maxRowIndex, commitRow + 1);
    workbookStore.setSelection({
      start: { row: nextRow, col: commitCol },
      end: { row: nextRow, col: commitCol },
    });
    workbookStore.setFormulaInput(getCellText(nextRow, commitCol));
  }

  function handleFormulaSubmit() {
    const { row, col } = workbookStore.selection.start;
    setRangeSelectionAnchor(null);
    setRangeSelectionEnd(null);
    workbookStore.setCellValue(row, col, workbookStore.formulaInput);
    workbookStore.setEditingCell(null);

    const nextRow = Math.min(maxRowIndex, row + 1);
    workbookStore.setSelection({
      start: { row: nextRow, col },
      end: { row: nextRow, col },
    });
    workbookStore.setFormulaInput(getCellText(nextRow, col));
  }

  function handleBoldPress() {
    const { rows, cols } = workbookStore.getSelectedRange();
    const key = cellKey(workbookStore.selection.start.row, workbookStore.selection.start.col);
    const current = workbookStore.activeSheet.cells[key];
    workbookStore.setCellStyle(rows, cols, { bold: !current?.style?.bold });
  }

  function handleItalicPress() {
    const { rows, cols } = workbookStore.getSelectedRange();
    const key = cellKey(workbookStore.selection.start.row, workbookStore.selection.start.col);
    const current = workbookStore.activeSheet.cells[key];
    workbookStore.setCellStyle(rows, cols, { italic: !current?.style?.italic });
  }

  function handleColorPress(color: string) {
    const { rows, cols } = workbookStore.getSelectedRange();
    workbookStore.setCellStyle(rows, cols, { bgColor: color });
  }

  function handleTextColorPress(color: string) {
    const { rows, cols } = workbookStore.getSelectedRange();
    workbookStore.setCellStyle(rows, cols, { textColor: color });
  }

  function handleCurrencyPress(currency: '' | 'USD' | 'RUB' | 'UZS' | 'EUR') {
    const { rows, cols } = workbookStore.getSelectedRange();
    workbookStore.setCellStyle(rows, cols, { currency });
  }

  function handleToggleRangeSelection() {
    if (!rangeSelectionAnchor) {
      setRangeSelectionAnchor({ row: -1, col: -1 });
      setRangeSelectionEnd(null);
      workbookStore.setEditingCell(null);
      return;
    }

    setRangeSelectionAnchor(null);
    setRangeSelectionEnd(null);
  }

  const primaryCellRef = cellKey(workbookStore.selection.start.row, workbookStore.selection.start.col);
  const currentCell = workbookStore.activeSheet.cells[primaryCellRef];
  const selectedCellRef = useMemo(
    () => formatRangeRef(workbookStore.selection.start, workbookStore.selection.end),
    [workbookStore.selection],
  );

  const rangeSelectionLabel = !rangeSelectionAnchor
    ? 'Range'
    : rangeSelectionEnd
      ? 'Confirm'
      : 'Cancel';

  const rangeSelectionDetail = !rangeSelectionAnchor
    ? '1st cell -> button -> 2nd cell'
    : rangeSelectionEnd
      ? formatRangeRef(rangeSelectionAnchor, rangeSelectionEnd)
      : rangeSelectionAnchor.row === -1
        ? 'Tap first cell'
        : `Pick end from ${cellKey(rangeSelectionAnchor.row, rangeSelectionAnchor.col)}`;

  const driveButtonLabel = !driveConfigured
    ? 'Drive setup'
    : driveConnected
      ? (driveSaving ? 'Saving to Drive...' : 'Save to Drive')
      : 'Connect Drive';

  return (
    <div className={styles.container}>
      <header className={styles.topBar}>
        <div className={styles.brandBlock}>
          <button type="button" className={styles.homeButton} onClick={onGoHome}>
            Home
          </button>
          <div className={styles.brandBadge}>X</div>
          <div className={styles.titleWrap}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>
              {formatSourceLabel(activeFile)}
              {currentFileName ? ` • ${currentFileName}` : ''}
            </p>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.openButton} onClick={onOpenFromDevice}>
            Open
          </button>
          <button type="button" className={styles.saveButton} onClick={onSave} disabled={localSaving}>
            {localSaving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={onSaveAs}>
            Save As
          </button>
          <button
            type="button"
            className={styles.driveButton}
            onClick={driveConnected ? onSaveToDrive : onConnectDrive}
            disabled={!driveConfigured || driveSaving}
          >
            {driveButtonLabel}
          </button>
        </div>
      </header>

      <Toolbar
        selectedCellRef={selectedCellRef}
        formulaInput={workbookStore.formulaInput}
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
        onFormulaChange={workbookStore.setFormulaInput}
        onFormulaFocus={() => {}}
        onFormulaSubmit={handleFormulaSubmit}
        onBoldPress={handleBoldPress}
        onItalicPress={handleItalicPress}
        onColorPress={handleColorPress}
        onTextColorPress={handleTextColorPress}
        onCurrencyPress={handleCurrencyPress}
        onUndoPress={workbookStore.undo}
        onRedoPress={workbookStore.redo}
        onToggleRangeSelection={handleToggleRangeSelection}
        onDecreaseCellSize={() => setCellScale((current) => Math.max(MIN_CELL_SCALE, Number((current - CELL_SCALE_STEP).toFixed(2))))}
        onIncreaseCellSize={() => setCellScale((current) => Math.min(MAX_CELL_SCALE, Number((current + CELL_SCALE_STEP).toFixed(2))))}
        canUndo={workbookStore.canUndo}
        canRedo={workbookStore.canRedo}
      />

      {workbookStore.rangeSelectionMode ? (
        <div className={styles.rangeBar}>
          <span className={styles.rangeText}>
            Select second cell: {workbookStore.rangeStart ? cellKey(workbookStore.rangeStart.row, workbookStore.rangeStart.col) : ''}
          </span>
          <button type="button" className={styles.rangeButton} onClick={workbookStore.cancelRangeSelection}>
            Cancel
          </button>
        </div>
      ) : null}

      {rangeSelectionAnchor?.row === -1 && rangeSelectionAnchor?.col === -1 ? (
        <div className={styles.rangeBar}>
          <span className={styles.rangeText}>Range mode: tap FIRST cell</span>
          <button type="button" className={styles.rangeButton} onClick={handleToggleRangeSelection}>
            Cancel
          </button>
        </div>
      ) : null}

      {rangeSelectionAnchor && rangeSelectionAnchor.row !== -1 && rangeSelectionEnd === null ? (
        <div className={styles.rangeBar}>
          <span className={styles.rangeText}>
            Range mode: tap SECOND cell (anchor: {cellKey(rangeSelectionAnchor.row, rangeSelectionAnchor.col)})
          </span>
          <button type="button" className={styles.rangeButton} onClick={handleToggleRangeSelection}>
            Cancel
          </button>
        </div>
      ) : null}

      {rangeSelectionAnchor && rangeSelectionEnd ? (
        <div className={styles.rangeBar}>
          <span className={styles.rangeText}>
            Range selected: {cellKey(rangeSelectionAnchor.row, rangeSelectionAnchor.col)}:{cellKey(rangeSelectionEnd.row, rangeSelectionEnd.col)}
          </span>
          <button type="button" className={styles.rangeButton} onClick={handleToggleRangeSelection}>
            Clear
          </button>
        </div>
      ) : null}

      <Grid
        cells={workbookStore.activeSheet.cells}
        selection={workbookStore.selection}
        editingCell={workbookStore.editingCell}
        formulaInput={workbookStore.formulaInput}
        formulaSelectionMode={formulaSelectionMode}
        cellScale={cellScale}
        rowCount={workbookStore.activeSheet.visibleRowCount}
        onSelectCell={handleSelectCell}
        onSelectRange={(start, end) => workbookStore.setSelection({ start, end })}
        onLongPressCell={handleLongPressCell}
        onDoubleTapCell={handleDoubleTapCell}
        onCellInputChange={workbookStore.setFormulaInput}
        onCellInputSubmit={handleCellInputSubmit}
      />

      <div className={styles.rowBar}>
        <div>
          <strong>{workbookStore.activeSheet.visibleRowCount} rows visible</strong>
          <span className={styles.rowHint}>New sheets start at 50 rows. Add more only when you need them.</span>
        </div>
        <div className={styles.rowActions}>
          {ROW_INCREMENT_OPTIONS.map((amount) => (
            <button
              key={amount}
              type="button"
              className={styles.secondaryButton}
              onClick={() => workbookStore.expandActiveSheetRows(amount)}
            >
              Add {amount} rows
            </button>
          ))}
        </div>
      </div>

      <StatusBar cells={workbookStore.activeSheet.cells} selection={workbookStore.selection} />

      <SheetTabs
        sheets={workbookStore.workbook.sheets}
        activeSheetId={workbookStore.workbook.activeSheetId}
        onSwitchSheet={workbookStore.switchSheet}
        onAddSheet={workbookStore.addSheet}
        onRenameSheet={workbookStore.renameSheet}
        onDeleteSheet={workbookStore.deleteSheet}
      />

      <ContextMenu
        visible={contextMenu.visible}
        position={contextMenu.position}
        hasClipboard={!!workbookStore.clipboard}
        hasFormatPainter={!!workbookStore.formatPainterStyle}
        onClose={() => setContextMenu({ visible: false, position: { x: 0, y: 0 } })}
        onFormula={(type) => workbookStore.applyFormulaToSelection(type)}
        onColor={handleColorPress}
        onCurrency={handleCurrencyPress}
        onCopy={() => workbookStore.copySelection('copy')}
        onCut={() => workbookStore.copySelection('cut')}
        onPaste={(mode) => workbookStore.pasteToSelection(mode)}
        onFormatPainterPick={workbookStore.pickFormatPainter}
        onFormatPainterApply={workbookStore.applyFormatPainter}
        onClear={() => {
          const { rows, cols } = workbookStore.getSelectedRange();
          workbookStore.clearCells(rows, cols);
        }}
      />
    </div>
  );
}
