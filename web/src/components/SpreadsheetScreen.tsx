import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';

import { useWorkbook } from '../store/useWorkbook';
import type { Cell, Currency, Workbook } from '../types';
import { cellKey, letterToCol } from '../utils/cells';
import { loadWorkbookDraft, saveWorkbookDraft } from '../utils/localStorage';

import { ContextMenu } from './ContextMenu';
import { Grid } from './Grid';
import { SheetTabs } from './SheetTabs';
import { StatusBar } from './StatusBar';
import { Toolbar } from './Toolbar';
import styles from './SpreadsheetScreen.module.css';

const MIN_CELL_SCALE = 0.3;
const MAX_CELL_SCALE = 1.4;
const CELL_SCALE_STEP = 0.1;
const MAX_ROW_INDEX = 199;

function sanitizeFileName(name: string) {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

function baseNameNoExt(name: string) {
  return name.replace(/\.xlsx$/i, '');
}

function normalizeColor(value?: string) {
  if (!value) return undefined;
  const clean = value.replace('#', '');
  if (clean.length === 8) return `#${clean.slice(2).toUpperCase()}`;
  if (clean.length === 6) return `#${clean.toUpperCase()}`;
  return undefined;
}

interface XlsxCellStyle {
  font?: {
    bold?: boolean;
    italic?: boolean;
    color?: { rgb?: string };
  };
  fill?: {
    fgColor?: { rgb?: string };
  };
  numFmt?: string;
}

function stripHash(value?: string) {
  return value?.replace('#', '').toUpperCase();
}

function detectCurrency(format?: string): Currency {
  if (!format) return '';
  const upper = format.toUpperCase();
  if (upper.includes('$')) return 'USD';
  if (upper.includes('₽') || upper.includes('RUB')) return 'RUB';
  if (upper.includes('UZS') || upper.includes("SO'M") || upper.includes('СУМ')) return 'UZS';
  if (upper.includes('€') || upper.includes('EUR')) return 'EUR';
  return '';
}

function getCurrencyFormat(currency: Currency) {
  switch (currency) {
    case 'USD':
      return '$#,##0.00';
    case 'RUB':
      return '#,##0.00 ₽';
    case 'UZS':
      return '#,##0.00 "UZS"';
    case 'EUR':
      return '€#,##0.00';
    default:
      return undefined;
  }
}

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

function sheetjsToCells(worksheet: XLSX.WorkSheet): Record<string, Cell> {
  const cells: Record<string, Cell> = {};
  if (!worksheet || !worksheet['!ref']) return cells;

  const range = XLSX.utils.decode_range(worksheet['!ref']);

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const workbookCell = worksheet[address] as (XLSX.CellObject & { s?: XlsxCellStyle }) | undefined;
      if (!workbookCell) continue;

      const cell: Cell = {
        value: null,
        display: typeof workbookCell.w === 'string' ? workbookCell.w : undefined,
        style: {},
      };

      if (workbookCell.f) {
        cell.formula = `=${workbookCell.f}`;
      }

      if (workbookCell.v !== undefined && workbookCell.v !== null) {
        cell.value = typeof workbookCell.v === 'boolean'
          ? (workbookCell.v ? 1 : 0)
          : workbookCell.v as string | number;
      }

      const workbookStyle = workbookCell.s;
      if (workbookStyle?.font?.bold) cell.style.bold = true;
      if (workbookStyle?.font?.italic) cell.style.italic = true;

      const textColor = normalizeColor(workbookStyle?.font?.color?.rgb);
      const bgColor = normalizeColor(workbookStyle?.fill?.fgColor?.rgb);
      if (textColor) cell.style.textColor = textColor;
      if (bgColor) cell.style.bgColor = bgColor;

      const currency = detectCurrency(String(workbookCell.z ?? workbookStyle?.numFmt ?? ''));
      if (currency) cell.style.currency = currency;

      if (cell.value !== null || cell.formula) {
        cells[address] = cell;
      }
    }
  }

  return cells;
}

function cellsToSheetjs(cells: Record<string, Cell>): XLSX.WorkSheet {
  const worksheet: XLSX.WorkSheet = {};
  let maxRow = -1;
  let maxCol = -1;

  for (const [address, cell] of Object.entries(cells)) {
    if (cell.value === null && !cell.formula) continue;

    const decoded = XLSX.utils.decode_cell(address);
    maxRow = Math.max(maxRow, decoded.r);
    maxCol = Math.max(maxCol, decoded.c);

    const outputCell = {} as XLSX.CellObject & { s?: Record<string, unknown> };
    if (cell.formula) {
      outputCell.f = cell.formula.startsWith('=') ? cell.formula.slice(1) : cell.formula;
    }
    if (cell.value !== undefined && cell.value !== null) {
      outputCell.v = cell.value;
      outputCell.t = typeof cell.value === 'number' ? 'n' : 's';
    }

    const style: Record<string, unknown> = {};
    const font: Record<string, unknown> = {};
    if (cell.style.bold) font.bold = true;
    if (cell.style.italic) font.italic = true;
    if (cell.style.textColor) font.color = { rgb: stripHash(cell.style.textColor) };
    if (Object.keys(font).length > 0) style.font = font;

    if (cell.style.bgColor) {
      style.fill = {
        patternType: 'solid',
        fgColor: { rgb: stripHash(cell.style.bgColor) },
      };
    }

    style.alignment = {
      horizontal: typeof cell.value === 'number' ? 'right' : 'left',
      vertical: 'center',
    };

    if (Object.keys(style).length > 0) {
      outputCell.s = style;
    }

    const currencyFormat = getCurrencyFormat(cell.style.currency ?? '');
    if (currencyFormat) {
      outputCell.z = currencyFormat;
    }

    worksheet[address] = outputCell;
  }

  worksheet['!ref'] = maxRow >= 0 && maxCol >= 0
    ? XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } })
    : 'A1';

  return worksheet;
}

export function SpreadsheetScreen() {
  const workbookStore = useWorkbook();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stable ref to always read the latest store without re-triggering effects
  const storeRef = useRef(workbookStore);
  storeRef.current = workbookStore;

  const [title, setTitle] = useState('Hisobot');
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formulaSelectionMode] = useState(false);
  const [cellScale, setCellScale] = useState(1);
  const [rangeSelectionAnchor, setRangeSelectionAnchor] = useState<{ row: number; col: number } | null>(null);
  const [rangeSelectionEnd, setRangeSelectionEnd] = useState<{ row: number; col: number } | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: { x: number; y: number };
  }>({ visible: false, position: { x: 0, y: 0 } });

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
    let cancelled = false;

    async function restoreDraft() {
      try {
        const draft = await loadWorkbookDraft();
        if (cancelled || !draft) return;

        storeRef.current.loadWorkbook(draft.workbook);
        setTitle(draft.title || 'Hisobot');
        setCurrentFileName(draft.currentFileName);
      } finally {
        if (!cancelled) {
          setStorageReady(true);
        }
      }
    }

    void restoreDraft();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!storageReady) return undefined;

    const timeoutId = window.setTimeout(() => {
      try {
        saveWorkbookDraft({
          workbook: workbookStore.workbook,
          title,
          currentFileName,
        });
      } catch (error) {
        console.warn('Failed to save workbook draft', error);
      }
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [storageReady, workbookStore.workbook, title, currentFileName]);

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

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        store.setSelection({
          start: { row: Math.max(0, currentRow - 1), col: currentCol },
          end: { row: Math.max(0, currentRow - 1), col: currentCol },
        });
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        store.setSelection({
          start: { row: Math.min(MAX_ROW_INDEX, currentRow + 1), col: currentCol },
          end: { row: Math.min(MAX_ROW_INDEX, currentRow + 1), col: currentCol },
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
          start: { row: Math.min(MAX_ROW_INDEX, currentRow + 1), col: currentCol },
          end: { row: Math.min(MAX_ROW_INDEX, currentRow + 1), col: currentCol },
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
    // Commit any pending edit before moving to a new cell
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

    const nextRow = Math.min(MAX_ROW_INDEX, commitRow + 1);
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

    const nextRow = Math.min(MAX_ROW_INDEX, row + 1);
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

  function handleCurrencyPress(currency: Currency) {
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

  function handleOpenClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const importedWorkbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellStyles: true,
        cellNF: true,
        cellText: true,
      });

      const sheets = importedWorkbook.SheetNames.map((sheetName, index) => ({
        id: `imported-${index}-${Date.now()}`,
        name: sheetName,
        cells: sheetjsToCells(importedWorkbook.Sheets[sheetName]),
        colWidths: {},
        rowHeights: {},
      }));

      if (sheets.length === 0) {
        window.alert('No sheets found in this workbook.');
        return;
      }

      const workbook: Workbook = {
        sheets,
        activeSheetId: sheets[0].id,
      };

      workbookStore.loadWorkbook(workbook);
      setRangeSelectionAnchor(null);
      setRangeSelectionEnd(null);
      setTitle(baseNameNoExt(file.name) || 'Workbook');
      setCurrentFileName(sanitizeFileName(file.name));
    } catch (error) {
      window.alert(`Open failed: ${String(error)}`);
    } finally {
      event.target.value = '';
    }
  }

  async function handleSave() {
    setSaving(true);

    try {
      const outputWorkbook = XLSX.utils.book_new();

      for (const sheet of workbookStore.workbook.sheets) {
        const worksheet = cellsToSheetjs(sheet.cells);
        const safeName = sheet.name.slice(0, 31).replace(/[/\\?*[\]]/g, '_') || 'Sheet';
        XLSX.utils.book_append_sheet(outputWorkbook, worksheet, safeName);
      }

      const data = XLSX.write(outputWorkbook, {
        bookType: 'xlsx',
        type: 'array',
        cellStyles: true,
      });

      const suggested = currentFileName
        || sanitizeFileName(`${title || 'Workbook'}.xlsx`)
        || `Workbook-${Date.now()}.xlsx`;
      const fileName = suggested.endsWith('.xlsx') ? suggested : `${suggested}.xlsx`;

      const blob = new Blob([data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      saveWorkbookDraft({
        workbook: workbookStore.workbook,
        title,
        currentFileName: fileName,
      });
      setCurrentFileName(fileName);
    } catch (error) {
      window.alert(`Save failed: ${String(error)}`);
    } finally {
      setSaving(false);
    }
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

  return (
    <div className={styles.container}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />

      <header className={styles.topBar}>
        <div className={styles.brandBlock}>
          <div className={styles.brandBadge}>X</div>
          <div className={styles.titleWrap}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>Responsive workbook for iPad Safari and desktop</p>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.openButton} onClick={handleOpenClick} disabled={saving}>
            Open
          </button>
          <button type="button" className={styles.saveButton} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
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
        onSelectCell={handleSelectCell}
        onSelectRange={(start, end) => workbookStore.setSelection({ start, end })}
        onLongPressCell={handleLongPressCell}
        onDoubleTapCell={handleDoubleTapCell}
        onCellInputChange={workbookStore.setFormulaInput}
        onCellInputSubmit={handleCellInputSubmit}
      />

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
