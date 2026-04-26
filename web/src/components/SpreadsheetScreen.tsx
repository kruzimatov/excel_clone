import { useEffect, useMemo, useRef, useState } from 'react';

import { cellKey, letterToCol } from '../utils/cells';
import { classNames } from '../utils/classNames';
import { t, type AppLanguage } from '../utils/i18n';
import { COLUMN_INCREMENT_COUNT, DEFAULT_VISIBLE_COLUMN_COUNT } from '../utils/workbookLayout';
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

interface SpreadsheetScreenProps {
  language: AppLanguage;
  workbookStore: WorkbookStore;
  title: string;
  storageSaving: boolean;
  loadingProgress: {
    active: boolean;
    loadedRows: number;
    totalRows: number;
    currentSheetName: string;
  };
  canDeleteWorkbook: boolean;
  onGoHome: () => void;
  onSave: () => void;
  onSwitchSheet: (sheetId: string) => void;
  onDeleteWorkbook: () => void;
  onRenameTitle: (value: string) => void;
}

export function SpreadsheetScreen({
  language,
  workbookStore,
  title,
  storageSaving,
  loadingProgress,
  canDeleteWorkbook,
  onGoHome,
  onSave,
  onSwitchSheet,
  onDeleteWorkbook,
  onRenameTitle,
}: SpreadsheetScreenProps) {
  const storeRef = useRef(workbookStore);
  const saveRef = useRef(onSave);
  const previousSheetIdRef = useRef(workbookStore.workbook.activeSheetId);
  const switchTimerRef = useRef<number | null>(null);

  const [formulaSelectionMode] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(false);
  const [cellScale, setCellScale] = useState(1);
  const [rangeSelectionAnchor, setRangeSelectionAnchor] = useState<{ row: number; col: number } | null>(null);
  const [rangeSelectionEnd, setRangeSelectionEnd] = useState<{ row: number; col: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: { x: number; y: number };
  }>({ visible: false, position: { x: 0, y: 0 } });
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(title);
  const [rowMenuOpen, setRowMenuOpen] = useState(false);
  const [rowAddInput, setRowAddInput] = useState('1000');
  const [sheetTransitionVisible, setSheetTransitionVisible] = useState(false);
  const [sheetTransitionLabel, setSheetTransitionLabel] = useState(workbookStore.activeSheet.name);

  useEffect(() => {
    storeRef.current = workbookStore;
    saveRef.current = onSave;
  }, [onSave, workbookStore]);

  useEffect(() => () => {
    if (switchTimerRef.current !== null) {
      window.clearTimeout(switchTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const nextSheetId = workbookStore.workbook.activeSheetId;
    const nextSheetName = workbookStore.activeSheet.name;

    if (previousSheetIdRef.current !== nextSheetId) {
      previousSheetIdRef.current = nextSheetId;
      setSheetTransitionLabel(nextSheetName);
      setSheetTransitionVisible(true);

      if (switchTimerRef.current !== null) {
        window.clearTimeout(switchTimerRef.current);
      }

      switchTimerRef.current = window.setTimeout(() => {
        switchTimerRef.current = null;
        setSheetTransitionVisible(false);
      }, 420);
      return;
    }

    setSheetTransitionLabel(nextSheetName);
  }, [workbookStore.activeSheet.name, workbookStore.workbook.activeSheetId]);

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
        setRowMenuOpen(false);
        store.setEditingCell(null);
        return;
      }

      const currentRow = store.selection.start.row;
      const currentCol = store.selection.start.col;
      const activeMaxRowIndex = Math.max(0, store.activeSheet.visibleRowCount - 1);
      const activeMaxColIndex = Math.max(
        0,
        Math.max(DEFAULT_VISIBLE_COLUMN_COUNT, store.activeSheet.visibleColumnCount) - 1,
      );

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
          start: { row: currentRow, col: Math.min(activeMaxColIndex, currentCol + 1) },
          end: { row: currentRow, col: Math.min(activeMaxColIndex, currentCol + 1) },
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
    workbookStore.setSelection({
      start: { row: commitRow, col: commitCol },
      end: { row: commitRow, col: commitCol },
    });
    workbookStore.setFormulaInput(getCellText(commitRow, commitCol));
  }

  function handleFormulaSubmit() {
    const { row, col } = workbookStore.selection.start;
    setRangeSelectionAnchor(null);
    setRangeSelectionEnd(null);
    workbookStore.setCellValue(row, col, workbookStore.formulaInput);
    workbookStore.setEditingCell(null);
    workbookStore.setSelection({
      start: { row, col },
      end: { row, col },
    });
    workbookStore.setFormulaInput(getCellText(row, col));
  }

  function handleTitleSubmit() {
    const nextTitle = titleInput.trim();
    if (!nextTitle) {
      setTitleInput(title);
      setEditingTitle(false);
      return;
    }

    onRenameTitle(nextTitle);
    setEditingTitle(false);
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

  function handleAddRowsSubmit() {
    const amount = parseInt(rowAddInput.trim(), 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    workbookStore.expandActiveSheetRows(amount);
    setRowMenuOpen(false);
  }

  const primaryCellRef = cellKey(workbookStore.selection.start.row, workbookStore.selection.start.col);
  const currentCell = workbookStore.activeSheet.cells[primaryCellRef];
  const selectedRange = workbookStore.getSelectedRange();
  const effectiveColumnCount = Math.max(
    DEFAULT_VISIBLE_COLUMN_COUNT,
    workbookStore.activeSheet.visibleColumnCount,
  );
  const isWholeRowSelection = selectedRange.cols.length === effectiveColumnCount;
  const selectedRowCount = selectedRange.rows.length;
  const selectedCellRef = useMemo(
    () => formatRangeRef(workbookStore.selection.start, workbookStore.selection.end),
    [workbookStore.selection],
  );

  const rangeSelectionDetail = !rangeSelectionAnchor
    ? t(language, 'range')
    : rangeSelectionEnd
      ? formatRangeRef(rangeSelectionAnchor, rangeSelectionEnd)
      : rangeSelectionAnchor.row === -1
        ? '1'
        : cellKey(rangeSelectionAnchor.row, rangeSelectionAnchor.col);
  const showSheetTransitionOverlay = sheetTransitionVisible || loadingProgress.active;
  const transitionCaption = loadingProgress.active
    ? (loadingProgress.currentSheetName || sheetTransitionLabel)
    : sheetTransitionLabel;

  return (
    <div className={styles.container}>
      {loadingProgress.active ? (
        <div className={styles.loadingBanner}>
          <div className={styles.loadingText}>
            <strong>{t(language, 'loadingFile')}</strong>
            <span>
              {loadingProgress.currentSheetName
                ? `${loadingProgress.currentSheetName}: ${loadingProgress.loadedRows}/${loadingProgress.totalRows}`
                : `${loadingProgress.loadedRows}/${loadingProgress.totalRows}`}
            </span>
          </div>
          <div className={styles.loadingTrack}>
            <div
              className={styles.loadingFill}
              style={{
                width: `${loadingProgress.totalRows > 0
                  ? Math.min(100, (loadingProgress.loadedRows / loadingProgress.totalRows) * 100)
                  : 0}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={classNames(styles.edgeMenuButton, chromeVisible && styles.edgeMenuButtonOpen)}
        onClick={() => setChromeVisible((current) => !current)}
        aria-label={t(language, chromeVisible ? 'hideMenus' : 'showMenus')}
        title={t(language, chromeVisible ? 'hideMenus' : 'showMenus')}
      >
        <span className={styles.edgeMenuIcon} aria-hidden="true">
          {chromeVisible ? '×' : '☰'}
        </span>
        <span className={styles.edgeMenuText}>{t(language, 'menu')}</span>
      </button>

      {chromeVisible ? (
        <header className={styles.topBar}>
          <div className={styles.brandBlock}>
            <button
              type="button"
              className={styles.homeButton}
              onClick={onGoHome}
              aria-label={t(language, 'home')}
              title={t(language, 'home')}
            >
              <span className={styles.homeIcon} aria-hidden="true">⌂</span>
            </button>
            <div className={styles.titleWrap}>
              {editingTitle ? (
                <input
                  className={styles.titleInput}
                  value={titleInput}
                  onChange={(event) => setTitleInput(event.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleTitleSubmit();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setTitleInput(title);
                      setEditingTitle(false);
                    }
                  }}
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  className={styles.titleButton}
                  onClick={() => {
                    setTitleInput(title);
                    setEditingTitle(true);
                  }}
                  title={t(language, 'renameWorkbook')}
                >
                  <h1 className={styles.title}>{title}</h1>
                </button>
              )}
            </div>
          </div>

          <div className={styles.ribbonSlot}>
            <Toolbar
              mode="ribbon"
              language={language}
              selectedCellRef={selectedCellRef}
              formulaInput={workbookStore.formulaInput}
              isBoldActive={!!currentCell?.style?.bold}
              isItalicActive={!!currentCell?.style?.italic}
              selectedFillColor={currentCell?.style?.bgColor || '#FFFFFF'}
              selectedTextColor={currentCell?.style?.textColor || '#000000'}
              selectedCurrency={currentCell?.style?.currency || ''}
              rangeSelectionActive={!!rangeSelectionAnchor}
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
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.viewModeButton}
              onClick={workbookStore.toggleActiveSheetRowOrder}
            >
              {workbookStore.activeSheetReversed
                ? t(language, 'showOldestFirst')
                : t(language, 'showNewestFirst')}
            </button>
            {canDeleteWorkbook ? (
              <button type="button" className={styles.deleteButton} onClick={onDeleteWorkbook}>
                {t(language, 'delete')}
              </button>
            ) : null}
            <button type="button" className={styles.saveButton} onClick={onSave} disabled={storageSaving}>
              {storageSaving ? t(language, 'saving') : t(language, 'save')}
            </button>
          </div>
        </header>
      ) : null}

      {chromeVisible ? (
        <Toolbar
          mode="formula"
          language={language}
          selectedCellRef={selectedCellRef}
          formulaInput={workbookStore.formulaInput}
          isBoldActive={!!currentCell?.style?.bold}
          isItalicActive={!!currentCell?.style?.italic}
          selectedFillColor={currentCell?.style?.bgColor || '#FFFFFF'}
          selectedTextColor={currentCell?.style?.textColor || '#000000'}
          selectedCurrency={currentCell?.style?.currency || ''}
          rangeSelectionActive={!!rangeSelectionAnchor}
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
      ) : null}

      {chromeVisible && workbookStore.rangeSelectionMode ? (
        <div className={styles.rangeBar}>
          <span className={styles.rangeText}>
            {workbookStore.rangeStart
              ? `2: ${cellKey(workbookStore.rangeStart.row, workbookStore.rangeStart.col)}`
              : '2'}
          </span>
          <button type="button" className={styles.rangeButton} onClick={workbookStore.cancelRangeSelection}>
            {t(language, 'cancel')}
          </button>
        </div>
      ) : null}

      {chromeVisible && rangeSelectionAnchor?.row === -1 && rangeSelectionAnchor?.col === -1 ? (
        <div className={styles.rangeBar}>
          <span className={styles.rangeText}>1</span>
          <button type="button" className={styles.rangeButton} onClick={handleToggleRangeSelection}>
            {t(language, 'cancel')}
          </button>
        </div>
      ) : null}

      {chromeVisible && rangeSelectionAnchor && rangeSelectionAnchor.row !== -1 && rangeSelectionEnd === null ? (
        <div className={styles.rangeBar}>
          <span className={styles.rangeText}>2: {cellKey(rangeSelectionAnchor.row, rangeSelectionAnchor.col)}</span>
          <button type="button" className={styles.rangeButton} onClick={handleToggleRangeSelection}>
            {t(language, 'cancel')}
          </button>
        </div>
      ) : null}

      {chromeVisible && rangeSelectionAnchor && rangeSelectionEnd ? (
        <div className={styles.rangeBar}>
          <span className={styles.rangeText}>
            {`${cellKey(rangeSelectionAnchor.row, rangeSelectionAnchor.col)}:${cellKey(rangeSelectionEnd.row, rangeSelectionEnd.col)}`}
          </span>
          <button type="button" className={styles.rangeButton} onClick={handleToggleRangeSelection}>
            {t(language, 'clear')}
          </button>
        </div>
      ) : null}

      <div className={classNames(styles.gridStage, showSheetTransitionOverlay && styles.gridStageDimmed)}>
        <Grid
          language={language}
          cells={workbookStore.activeSheet.cells}
          selection={workbookStore.selection}
          editingCell={workbookStore.editingCell}
          formulaInput={workbookStore.formulaInput}
          formulaSelectionMode={formulaSelectionMode}
          cellScale={cellScale}
          reverseRows={workbookStore.activeSheetReversed}
          rowCount={workbookStore.activeSheet.visibleRowCount}
          columnCount={effectiveColumnCount}
          scrollToBottomToken={workbookStore.loadVersion}
          onSelectCell={handleSelectCell}
          onSelectRange={(start, end) => workbookStore.setSelection({ start, end })}
          onOpenRowMenu={(row, position) => {
            workbookStore.setSelection({ start: { row, col: 0 }, end: { row, col: effectiveColumnCount - 1 } });
            setContextMenu({ visible: true, position });
          }}
          onLongPressCell={handleLongPressCell}
          onDoubleTapCell={handleDoubleTapCell}
          onCellInputChange={workbookStore.setFormulaInput}
          onCellInputSubmit={handleCellInputSubmit}
        />

        {showSheetTransitionOverlay ? (
          <div className={classNames(styles.sheetTransitionOverlay, loadingProgress.active && styles.sheetTransitionOverlayLoading)}>
            <div className={styles.sheetTransitionCard}>
              <div className={styles.sheetTransitionPulse} aria-hidden="true" />
              <div className={styles.sheetTransitionText}>
                <strong>{transitionCaption}</strong>
                <span>
                  {loadingProgress.active
                    ? `${loadingProgress.loadedRows}/${loadingProgress.totalRows}`
                    : t(language, 'loadingFile')}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {chromeVisible ? (
        <div className={styles.rowFabWrap}>
          <div className={styles.rowActions}>
            <button
              type="button"
              className={styles.columnFab}
              onClick={() => workbookStore.expandActiveSheetColumns(COLUMN_INCREMENT_COUNT)}
            >
              +23
            </button>
            <button
              type="button"
              className={styles.rowFab}
              onClick={() => setRowMenuOpen((current) => !current)}
            >
              {t(language, 'add')}
            </button>

            {rowMenuOpen ? (
              <div className={styles.rowMenu}>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  className={styles.rowMenuInput}
                  value={rowAddInput}
                  onChange={(event) => setRowAddInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddRowsSubmit();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setRowMenuOpen(false);
                    }
                  }}
                  placeholder={t(language, 'addRowsPlaceholder')}
                  autoFocus
                />
                <button
                  type="button"
                  className={styles.rowMenuItem}
                  onClick={handleAddRowsSubmit}
                >
                  {t(language, 'addAmount', { amount: rowAddInput || 0 })}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {chromeVisible ? (
        <StatusBar language={language} cells={workbookStore.activeSheet.cells} selection={workbookStore.selection} />
      ) : null}

      {chromeVisible ? (
        <SheetTabs
          language={language}
          sheets={workbookStore.workbook.sheets}
          activeSheetId={workbookStore.workbook.activeSheetId}
          onSwitchSheet={onSwitchSheet}
          onAddSheet={workbookStore.addSheet}
          onRenameSheet={workbookStore.renameSheet}
          onDeleteSheet={workbookStore.deleteSheet}
        />
      ) : null}

      <ContextMenu
        language={language}
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
        deleteRowsLabel={isWholeRowSelection
          ? t(language, selectedRowCount === 1 ? 'deleteRow' : 'deleteRows', { count: selectedRowCount })
          : null}
        onDeleteRows={isWholeRowSelection ? () => {
          if (!window.confirm(t(language, 'deleteRowsConfirm', { count: selectedRowCount }))) {
            return;
          }
          workbookStore.deleteRows(selectedRange.rows[0], selectedRange.rows[selectedRange.rows.length - 1]);
        } : undefined}
        onClear={() => {
          const { rows, cols } = workbookStore.getSelectedRange();
          workbookStore.clearCells(rows, cols);
        }}
      />
    </div>
  );
}
