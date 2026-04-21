import { useCallback, useRef, useState } from 'react';

import type { Cell, CellStyle, Selection, Sheet, Workbook } from '../types';
import { cellKey, emptyCell } from '../utils/cells';
import { evaluateAllFormulas, evaluateFormula } from '../utils/formulas';

function createSheet(name: string): Sheet {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    cells: {},
    colWidths: {},
    rowHeights: {},
  };
}

export function createDefaultWorkbook(): Workbook {
  const sheets = [
    createSheet('ФУАД АКА'),
    createSheet('ШАВКАТ ХОЖИ'),
    createSheet('СУХРОБ ТОШ'),
    createSheet('ЭЛМУРОД'),
  ];

  return {
    sheets,
    activeSheetId: sheets[0].id,
  };
}

export interface ClipboardData {
  cells: Record<string, Cell>;
  rows: number;
  cols: number;
  mode: 'copy' | 'cut';
  sourceStart: { row: number; col: number };
}

const MAX_UNDO = 30;

export function useWorkbook() {
  const [workbook, setWorkbook] = useState<Workbook>(createDefaultWorkbook);
  const [selection, setSelection] = useState<Selection>({
    start: { row: 0, col: 0 },
    end: { row: 0, col: 0 },
  });
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [formulaInput, setFormulaInput] = useState('');
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [rangeSelectionMode, setRangeSelectionMode] = useState(false);
  const [rangeStart, setRangeStart] = useState<{ row: number; col: number } | null>(null);
  const [formatPainterStyle, setFormatPainterStyle] = useState<CellStyle | null>(null);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const undoStack = useRef<Record<string, Cell>[]>([]);
  const redoStack = useRef<Record<string, Cell>[]>([]);

  const activeSheet = workbook.sheets.find((sheet) => sheet.id === workbook.activeSheetId)!;

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: undoStack.current.length > 0,
      canRedo: redoStack.current.length > 0,
    });
  }, []);

  const pushUndo = useCallback(() => {
    const current = workbook.sheets.find((sheet) => sheet.id === workbook.activeSheetId);
    if (!current) return;

    undoStack.current.push(JSON.parse(JSON.stringify(current.cells)));
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
    syncHistoryState();
  }, [syncHistoryState, workbook]);

  const getCell = useCallback(
    (key: string): Cell | undefined => activeSheet.cells[key],
    [activeSheet],
  );

  const getCellValue = useCallback(
    (key: string): Cell => activeSheet.cells[key] || emptyCell(),
    [activeSheet],
  );

  const recalculate = useCallback((cells: Record<string, Cell>): Record<string, Cell> => {
    const hasFormulas = Object.values(cells).some((cell) => cell.formula);
    if (!hasFormulas) return cells;

    const formulaResults = evaluateAllFormulas(cells);
    if (Object.keys(formulaResults).length === 0) return cells;

    const updated = { ...cells };
    for (const [key, value] of Object.entries(formulaResults)) {
      if (updated[key]) {
        updated[key] = { ...updated[key], value, display: undefined };
      }
    }

    return updated;
  }, []);

  const setCellValue = useCallback((row: number, col: number, rawValue: string) => {
    const key = cellKey(row, col);
    pushUndo();

    setWorkbook((previousWorkbook) => {
      const newSheets = previousWorkbook.sheets.map((sheet) => {
        if (sheet.id !== previousWorkbook.activeSheetId) return sheet;

        const existingCell = sheet.cells[key] || emptyCell();
        let newCell: Cell;

        if (rawValue.startsWith('=')) {
          const getter = (lookupKey: string) => sheet.cells[lookupKey];
          const result = evaluateFormula(rawValue, getter, sheet.cells);
          newCell = {
            ...existingCell,
            formula: rawValue,
            value: result,
            display: undefined,
          };
        } else {
          const parsed = parseFloat(rawValue.replace(/\s/g, '').replace(',', '.'));
          newCell = {
            ...existingCell,
            formula: undefined,
            value: rawValue === '' ? null : Number.isNaN(parsed) ? rawValue : parsed,
            display: undefined,
          };
        }

        const newCells = { ...sheet.cells, [key]: newCell };
        return { ...sheet, cells: recalculate(newCells) };
      });

      return { ...previousWorkbook, sheets: newSheets };
    });
  }, [pushUndo, recalculate]);

  const setCellStyle = useCallback((rows: number[], cols: number[], style: Partial<CellStyle>) => {
    pushUndo();

    setWorkbook((previousWorkbook) => {
      const newSheets = previousWorkbook.sheets.map((sheet) => {
        if (sheet.id !== previousWorkbook.activeSheetId) return sheet;
        const newCells = { ...sheet.cells };

        for (const row of rows) {
          for (const col of cols) {
            const key = cellKey(row, col);
            const existing = newCells[key] || emptyCell();
            newCells[key] = {
              ...existing,
              style: { ...existing.style, ...style },
            };
          }
        }

        return { ...sheet, cells: newCells };
      });

      return { ...previousWorkbook, sheets: newSheets };
    });
  }, [pushUndo]);

  const clearCells = useCallback((rows: number[], cols: number[]) => {
    pushUndo();

    setWorkbook((previousWorkbook) => {
      const newSheets = previousWorkbook.sheets.map((sheet) => {
        if (sheet.id !== previousWorkbook.activeSheetId) return sheet;

        const newCells = { ...sheet.cells };
        for (const row of rows) {
          for (const col of cols) {
            newCells[cellKey(row, col)] = emptyCell();
          }
        }

        return { ...sheet, cells: recalculate(newCells) };
      });

      return { ...previousWorkbook, sheets: newSheets };
    });
  }, [pushUndo, recalculate]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const current = workbook.sheets.find((sheet) => sheet.id === workbook.activeSheetId);
    if (current) {
      redoStack.current.push(JSON.parse(JSON.stringify(current.cells)));
    }
    const previous = undoStack.current.pop()!;
    syncHistoryState();
    setWorkbook((currentWorkbook) => ({
      ...currentWorkbook,
      sheets: currentWorkbook.sheets.map((sheet) => (
        sheet.id === currentWorkbook.activeSheetId ? { ...sheet, cells: previous } : sheet
      )),
    }));
  }, [syncHistoryState, workbook]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const current = workbook.sheets.find((sheet) => sheet.id === workbook.activeSheetId);
    if (current) {
      undoStack.current.push(JSON.parse(JSON.stringify(current.cells)));
    }
    const next = redoStack.current.pop()!;
    syncHistoryState();
    setWorkbook((currentWorkbook) => ({
      ...currentWorkbook,
      sheets: currentWorkbook.sheets.map((sheet) => (
        sheet.id === currentWorkbook.activeSheetId ? { ...sheet, cells: next } : sheet
      )),
    }));
  }, [syncHistoryState, workbook]);

  const copySelection = useCallback((mode: 'copy' | 'cut' = 'copy') => {
    const { start, end } = selection;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    const copiedCells: Record<string, Cell> = {};
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const key = cellKey(row, col);
        const cell = activeSheet.cells[key];
        if (!cell) continue;
        copiedCells[cellKey(row - minRow, col - minCol)] = JSON.parse(JSON.stringify(cell));
      }
    }

    setClipboard({
      cells: copiedCells,
      rows: maxRow - minRow + 1,
      cols: maxCol - minCol + 1,
      mode,
      sourceStart: { row: minRow, col: minCol },
    });

    return true;
  }, [activeSheet, selection]);

  const pasteToSelection = useCallback((pasteMode: 'all' | 'value' | 'style' = 'all') => {
    if (!clipboard) return;
    pushUndo();

    const targetRow = selection.start.row;
    const targetCol = selection.start.col;

    setWorkbook((previousWorkbook) => {
      const newSheets = previousWorkbook.sheets.map((sheet) => {
        if (sheet.id !== previousWorkbook.activeSheetId) return sheet;

        const newCells = { ...sheet.cells };

        for (let row = 0; row < clipboard.rows; row += 1) {
          for (let col = 0; col < clipboard.cols; col += 1) {
            const sourceCell = clipboard.cells[cellKey(row, col)];
            const destinationKey = cellKey(targetRow + row, targetCol + col);
            const existing = newCells[destinationKey] || emptyCell();

            if (pasteMode === 'style') {
              newCells[destinationKey] = {
                ...existing,
                style: sourceCell ? { ...sourceCell.style } : existing.style,
              };
            } else if (pasteMode === 'value') {
              newCells[destinationKey] = {
                ...existing,
                value: sourceCell?.value ?? null,
                formula: sourceCell?.formula,
                display: undefined,
              };
            } else {
              newCells[destinationKey] = sourceCell
                ? { ...JSON.parse(JSON.stringify(sourceCell)) }
                : emptyCell();
            }
          }
        }

        if (clipboard.mode === 'cut') {
          for (let row = 0; row < clipboard.rows; row += 1) {
            for (let col = 0; col < clipboard.cols; col += 1) {
              const sourceKey = cellKey(
                clipboard.sourceStart.row + row,
                clipboard.sourceStart.col + col,
              );
              if (sourceKey !== cellKey(targetRow + row, targetCol + col)) {
                newCells[sourceKey] = emptyCell();
              }
            }
          }
        }

        return { ...sheet, cells: recalculate(newCells) };
      });

      return { ...previousWorkbook, sheets: newSheets };
    });

    if (clipboard.mode === 'cut') {
      setClipboard(null);
    }
  }, [clipboard, pushUndo, recalculate, selection]);

  const pickFormatPainter = useCallback(() => {
    const key = cellKey(selection.start.row, selection.start.col);
    const cell = activeSheet.cells[key];
    if (cell) {
      setFormatPainterStyle({ ...cell.style });
    }
  }, [activeSheet, selection]);

  const applyFormatPainter = useCallback(() => {
    if (!formatPainterStyle) return;

    const { start, end } = selection;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    const rows: number[] = [];
    const cols: number[] = [];

    for (let row = minRow; row <= maxRow; row += 1) rows.push(row);
    for (let col = minCol; col <= maxCol; col += 1) cols.push(col);

    setCellStyle(rows, cols, formatPainterStyle);
    setFormatPainterStyle(null);
  }, [formatPainterStyle, selection, setCellStyle]);

  const loadWorkbook = useCallback((newWorkbook: Workbook) => {
    const recalculatedWorkbook: Workbook = {
      ...newWorkbook,
      sheets: newWorkbook.sheets.map((sheet) => ({
        ...sheet,
        cells: recalculate(sheet.cells),
      })),
    };

    setWorkbook(recalculatedWorkbook);
    setSelection({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } });
    setEditingCell(null);
    setFormulaInput('');
    setClipboard(null);
    setFormatPainterStyle(null);
    undoStack.current = [];
    redoStack.current = [];
    syncHistoryState();
  }, [recalculate, syncHistoryState]);

  const switchSheet = useCallback((sheetId: string) => {
    setWorkbook((previousWorkbook) => ({ ...previousWorkbook, activeSheetId: sheetId }));
    setSelection({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } });
    setEditingCell(null);
    setFormulaInput('');
  }, []);

  const addSheet = useCallback((name: string) => {
    const newSheet = createSheet(name);
    setWorkbook((previousWorkbook) => ({
      ...previousWorkbook,
      sheets: [...previousWorkbook.sheets, newSheet],
      activeSheetId: newSheet.id,
    }));
  }, []);

  const renameSheet = useCallback((sheetId: string, newName: string) => {
    setWorkbook((previousWorkbook) => ({
      ...previousWorkbook,
      sheets: previousWorkbook.sheets.map((sheet) => (
        sheet.id === sheetId ? { ...sheet, name: newName } : sheet
      )),
    }));
  }, []);

  const deleteSheet = useCallback((sheetId: string) => {
    setWorkbook((previousWorkbook) => {
      if (previousWorkbook.sheets.length <= 1) return previousWorkbook;
      const newSheets = previousWorkbook.sheets.filter((sheet) => sheet.id !== sheetId);
      return {
        ...previousWorkbook,
        sheets: newSheets,
        activeSheetId:
          previousWorkbook.activeSheetId === sheetId
            ? newSheets[0].id
            : previousWorkbook.activeSheetId,
      };
    });
  }, []);

  const applyFormulaToSelection = useCallback((formulaType: string) => {
    const { start, end } = selection;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    const startRef = cellKey(minRow, minCol);
    const endRef = cellKey(maxRow, maxCol);
    const resultRow = maxRow + 1;
    const resultCol = minCol;

    setCellValue(resultRow, resultCol, `=${formulaType}(${startRef}:${endRef})`);
    setSelection({
      start: { row: resultRow, col: resultCol },
      end: { row: resultRow, col: resultCol },
    });
  }, [selection, setCellValue]);

  const getSelectedRange = useCallback(() => {
    const { start, end } = selection;
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    const rows: number[] = [];
    const cols: number[] = [];

    for (let row = minRow; row <= maxRow; row += 1) rows.push(row);
    for (let col = minCol; col <= maxCol; col += 1) cols.push(col);

    return { rows, cols };
  }, [selection]);

  const startRangeSelection = useCallback(() => {
    setRangeSelectionMode(true);
    setRangeStart(selection.start);
  }, [selection]);

  const applyRangeSelection = useCallback((endCell: { row: number; col: number }) => {
    if (!rangeStart) return;

    const minRow = Math.min(rangeStart.row, endCell.row);
    const maxRow = Math.max(rangeStart.row, endCell.row);
    const minCol = Math.min(rangeStart.col, endCell.col);
    const maxCol = Math.max(rangeStart.col, endCell.col);

    setSelection({
      start: { row: minRow, col: minCol },
      end: { row: maxRow, col: maxCol },
    });
    setRangeSelectionMode(false);
    setRangeStart(null);
  }, [rangeStart]);

  const cancelRangeSelection = useCallback(() => {
    setRangeSelectionMode(false);
    setRangeStart(null);
  }, []);

  return {
    workbook,
    activeSheet,
    selection,
    setSelection,
    editingCell,
    setEditingCell,
    formulaInput,
    setFormulaInput,
    getCell,
    getCellValue,
    setCellValue,
    setCellStyle,
    clearCells,
    loadWorkbook,
    switchSheet,
    addSheet,
    renameSheet,
    deleteSheet,
    applyFormulaToSelection,
    getSelectedRange,
    undo,
    redo,
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    clipboard,
    copySelection,
    pasteToSelection,
    formatPainterStyle,
    pickFormatPainter,
    applyFormatPainter,
    rangeSelectionMode,
    rangeStart,
    startRangeSelection,
    applyRangeSelection,
    cancelRangeSelection,
  };
}
