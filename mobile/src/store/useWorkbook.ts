import { useState, useCallback, useRef } from 'react';
import { Workbook, Sheet, Cell, Selection, CellStyle, Currency } from '../types';
import { cellKey, emptyCell } from '../utils/cells';
import { evaluateFormula, evaluateAllFormulas } from '../utils/formulas';

function createSheet(name: string): Sheet {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    name,
    cells: {},
    colWidths: {},
    rowHeights: {},
  };
}

function createDefaultWorkbook(): Workbook {
  const sheets = [
    createSheet('ФУАД АКА'),
    createSheet('ШАВКАТ ХОЖИ'),
    createSheet('СУХРОБ ТОШ'),
    createSheet('ЭЛМУРОД'),
  ];
  return { sheets, activeSheetId: sheets[0].id };
}

// Clipboard: stores copied cell(s) — value + style
export interface ClipboardData {
  cells: Record<string, Cell>; // relative keys like "A1", "A2", "B1"
  rows: number; // how many rows
  cols: number; // how many cols
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
  const [rangeStart, setRangeStart] = useState<{row: number, col: number} | null>(null);

  // Undo/Redo stacks — store snapshots of sheet cells
  const undoStack = useRef<Record<string, Cell>[]>([]);
  const redoStack = useRef<Record<string, Cell>[]>([]);

  const activeSheet = workbook.sheets.find((s) => s.id === workbook.activeSheetId)!;

  // Save current state to undo stack before making changes
  const pushUndo = useCallback(() => {
    const current = workbook.sheets.find((s) => s.id === workbook.activeSheetId);
    if (current) {
      undoStack.current.push(JSON.parse(JSON.stringify(current.cells)));
      if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
      redoStack.current = []; // clear redo on new action
    }
  }, [workbook]);

  const getCell = useCallback(
    (key: string): Cell | undefined => {
      return activeSheet.cells[key];
    },
    [activeSheet]
  );

  const getCellValue = useCallback(
    (key: string): Cell => {
      return activeSheet.cells[key] || emptyCell();
    },
    [activeSheet]
  );

  const recalculate = useCallback(
    (cells: Record<string, Cell>): Record<string, Cell> => {
      const hasFormulas = Object.values(cells).some((c) => c.formula);
      if (!hasFormulas) return cells;

      // Build ONE HyperFormula engine for all formulas instead of one per cell.
      const formulaResults = evaluateAllFormulas(cells);
      if (Object.keys(formulaResults).length === 0) return cells;

      const updated = { ...cells };
      for (const [key, value] of Object.entries(formulaResults)) {
        if (updated[key]) {
          updated[key] = { ...updated[key], value, display: undefined };
        }
      }
      return updated;
    },
    []
  );

  const setCellValue = useCallback(
    (row: number, col: number, rawValue: string) => {
      const key = cellKey(row, col);
      pushUndo();

      setWorkbook((prev) => {
        const newSheets = prev.sheets.map((sheet) => {
          if (sheet.id !== prev.activeSheetId) return sheet;

          const existingCell = sheet.cells[key] || emptyCell();
          let newCell: Cell;

          if (rawValue.startsWith('=')) {
            const getter = (k: string) => sheet.cells[k];
            const result = evaluateFormula(rawValue, getter, sheet.cells);
            newCell = {
              ...existingCell,
              formula: rawValue,
              value: result,
              display: undefined,
            };
          } else {
            const num = parseFloat(rawValue.replace(/\s/g, '').replace(',', '.'));
            newCell = {
              ...existingCell,
              formula: undefined,
              value: rawValue === '' ? null : isNaN(num) ? rawValue : num,
              display: undefined,
            };
          }

          const newCells = { ...sheet.cells, [key]: newCell };
          return { ...sheet, cells: recalculate(newCells) };
        });

        return { ...prev, sheets: newSheets };
      });
    },
    [recalculate, pushUndo]
  );

  const setCellStyle = useCallback(
    (rows: number[], cols: number[], style: Partial<CellStyle>) => {
      pushUndo();
      setWorkbook((prev) => {
        const newSheets = prev.sheets.map((sheet) => {
          if (sheet.id !== prev.activeSheetId) return sheet;
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
        return { ...prev, sheets: newSheets };
      });
    },
    [pushUndo]
  );

  // --- Undo / Redo ---
  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const current = workbook.sheets.find((s) => s.id === workbook.activeSheetId);
    if (current) {
      redoStack.current.push(JSON.parse(JSON.stringify(current.cells)));
    }
    const prev = undoStack.current.pop()!;
    setWorkbook((wb) => ({
      ...wb,
      sheets: wb.sheets.map((s) =>
        s.id === wb.activeSheetId ? { ...s, cells: prev } : s
      ),
    }));
  }, [workbook]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const current = workbook.sheets.find((s) => s.id === workbook.activeSheetId);
    if (current) {
      undoStack.current.push(JSON.parse(JSON.stringify(current.cells)));
    }
    const next = redoStack.current.pop()!;
    setWorkbook((wb) => ({
      ...wb,
      sheets: wb.sheets.map((s) =>
        s.id === wb.activeSheetId ? { ...s, cells: next } : s
      ),
    }));
  }, [workbook]);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  // --- Copy / Cut / Paste ---
  const copySelection = useCallback(
    (mode: 'copy' | 'cut' = 'copy') => {
      const { start, end } = selection;
      const minR = Math.min(start.row, end.row);
      const maxR = Math.max(start.row, end.row);
      const minC = Math.min(start.col, end.col);
      const maxC = Math.max(start.col, end.col);

      const copiedCells: Record<string, Cell> = {};
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const key = cellKey(r, c);
          const cell = activeSheet.cells[key];
          if (cell) {
            // Store with relative key (offset from minR/minC)
            const relKey = cellKey(r - minR, c - minC);
            copiedCells[relKey] = JSON.parse(JSON.stringify(cell));
          }
        }
      }

      setClipboard({
        cells: copiedCells,
        rows: maxR - minR + 1,
        cols: maxC - minC + 1,
        mode,
        sourceStart: { row: minR, col: minC },
      });

      return true;
    },
    [selection, activeSheet]
  );

  const pasteToSelection = useCallback(
    (pasteMode: 'all' | 'value' | 'style' = 'all') => {
      if (!clipboard) return;
      pushUndo();

      const targetR = selection.start.row;
      const targetC = selection.start.col;

      setWorkbook((prev) => {
        const newSheets = prev.sheets.map((sheet) => {
          if (sheet.id !== prev.activeSheetId) return sheet;
          const newCells = { ...sheet.cells };

          for (let r = 0; r < clipboard.rows; r++) {
            for (let c = 0; c < clipboard.cols; c++) {
              const relKey = cellKey(r, c);
              const srcCell = clipboard.cells[relKey];
              const destKey = cellKey(targetR + r, targetC + c);
              const existing = newCells[destKey] || emptyCell();

              if (pasteMode === 'style') {
                // Only paste style
                newCells[destKey] = {
                  ...existing,
                  style: srcCell ? { ...srcCell.style } : existing.style,
                };
              } else if (pasteMode === 'value') {
                // Only paste value/formula
                newCells[destKey] = {
                  ...existing,
                  value: srcCell?.value ?? null,
                  formula: srcCell?.formula,
                  display: undefined,
                };
              } else {
                // Paste everything
                newCells[destKey] = srcCell
                  ? { ...JSON.parse(JSON.stringify(srcCell)) }
                  : emptyCell();
              }
            }
          }

          // If cut, clear source cells
          if (clipboard.mode === 'cut') {
            for (let r = 0; r < clipboard.rows; r++) {
              for (let c = 0; c < clipboard.cols; c++) {
                const srcKey = cellKey(
                  clipboard.sourceStart.row + r,
                  clipboard.sourceStart.col + c
                );
                // Don't clear if pasting on top of source
                if (srcKey !== cellKey(targetR + r, targetC + c)) {
                  newCells[srcKey] = emptyCell();
                }
              }
            }
          }

          return { ...sheet, cells: recalculate(newCells) };
        });
        return { ...prev, sheets: newSheets };
      });

      // Clear cut clipboard after paste
      if (clipboard.mode === 'cut') {
        setClipboard(null);
      }
    },
    [clipboard, selection, pushUndo, recalculate]
  );

  // --- Format painter: copy style from one cell, apply to selection ---
  const [formatPainterStyle, setFormatPainterStyle] = useState<CellStyle | null>(null);

  const pickFormatPainter = useCallback(() => {
    const key = cellKey(selection.start.row, selection.start.col);
    const cell = activeSheet.cells[key];
    if (cell) {
      setFormatPainterStyle({ ...cell.style });
    }
  }, [selection, activeSheet]);

  const applyFormatPainter = useCallback(() => {
    if (!formatPainterStyle) return;
    const { start, end } = selection;
    const minR = Math.min(start.row, end.row);
    const maxR = Math.max(start.row, end.row);
    const minC = Math.min(start.col, end.col);
    const maxC = Math.max(start.col, end.col);

    const rows: number[] = [];
    const cols: number[] = [];
    for (let r = minR; r <= maxR; r++) rows.push(r);
    for (let c = minC; c <= maxC; c++) cols.push(c);

    setCellStyle(rows, cols, formatPainterStyle);
    setFormatPainterStyle(null);
  }, [formatPainterStyle, selection, setCellStyle]);

  const loadWorkbook = useCallback((newWorkbook: Workbook) => {
    setWorkbook(newWorkbook);
    setSelection({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } });
    setEditingCell(null);
    setFormulaInput('');
    setClipboard(null);
    undoStack.current = [];
    redoStack.current = [];
  }, []);

  const switchSheet = useCallback((sheetId: string) => {
    setWorkbook((prev) => ({ ...prev, activeSheetId: sheetId }));
    setSelection({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } });
    setEditingCell(null);
  }, []);

  const addSheet = useCallback((name: string) => {
    const newSheet = createSheet(name);
    setWorkbook((prev) => ({
      ...prev,
      sheets: [...prev.sheets, newSheet],
      activeSheetId: newSheet.id,
    }));
  }, []);

  const renameSheet = useCallback((sheetId: string, newName: string) => {
    setWorkbook((prev) => ({
      ...prev,
      sheets: prev.sheets.map((s) =>
        s.id === sheetId ? { ...s, name: newName } : s
      ),
    }));
  }, []);

  const deleteSheet = useCallback((sheetId: string) => {
    setWorkbook((prev) => {
      if (prev.sheets.length <= 1) return prev;
      const newSheets = prev.sheets.filter((s) => s.id !== sheetId);
      return {
        ...prev,
        sheets: newSheets,
        activeSheetId:
          prev.activeSheetId === sheetId ? newSheets[0].id : prev.activeSheetId,
      };
    });
  }, []);

  const applyFormulaToSelection = useCallback(
    (formulaType: string) => {
      const { start, end } = selection;
      const minR = Math.min(start.row, end.row);
      const maxR = Math.max(start.row, end.row);
      const minC = Math.min(start.col, end.col);
      const maxC = Math.max(start.col, end.col);

      const startRef = cellKey(minR, minC);
      const endRef = cellKey(maxR, maxC);
      const range = `${startRef}:${endRef}`;

      const resultRow = maxR + 1;
      const resultCol = minC;

      const formula = `=${formulaType}(${range})`;
      setCellValue(resultRow, resultCol, formula);

      setSelection({
        start: { row: resultRow, col: resultCol },
        end: { row: resultRow, col: resultCol },
      });
    },
    [selection, setCellValue]
  );

  const getSelectedRange = useCallback(() => {
    const { start, end } = selection;
    const minR = Math.min(start.row, end.row);
    const maxR = Math.max(start.row, end.row);
    const minC = Math.min(start.col, end.col);
    const maxC = Math.max(start.col, end.col);

    const rows: number[] = [];
    const cols: number[] = [];
    for (let r = minR; r <= maxR; r++) rows.push(r);
    for (let c = minC; c <= maxC; c++) cols.push(c);
    return { rows, cols };
  }, [selection]);

  const startRangeSelection = useCallback(() => {
    setRangeSelectionMode(true);
    setRangeStart(selection.start);
  }, [selection]);

  const applyRangeSelection = useCallback((endCell: {row: number, col: number}) => {
    if (!rangeStart) return;
    
    const minRow = Math.min(rangeStart.row, endCell.row);
    const maxRow = Math.max(rangeStart.row, endCell.row);
    const minCol = Math.min(rangeStart.col, endCell.col);
    const maxCol = Math.max(rangeStart.col, endCell.col);
    
    setSelection({
      start: { row: minRow, col: minCol },
      end: { row: maxRow, col: maxCol }
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
    loadWorkbook,
    switchSheet,
    addSheet,
    renameSheet,
    deleteSheet,
    applyFormulaToSelection,
    getSelectedRange,
    // New
    undo,
    redo,
    canUndo,
    canRedo,
    clipboard,
    copySelection,
    pasteToSelection,
    formatPainterStyle,
    pickFormatPainter,
    applyFormatPainter,
    // Range selection
    rangeSelectionMode,
    rangeStart,
    startRangeSelection,
    applyRangeSelection,
    cancelRangeSelection,
  };
}
