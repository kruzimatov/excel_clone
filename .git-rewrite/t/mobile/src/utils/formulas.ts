import { HyperFormula, SimpleCellAddress } from 'hyperformula';
import { Cell } from '../types';

// Create a fresh HyperFormula engine with cell data loaded
function buildEngine(allCells: Record<string, Cell>): { hf: HyperFormula; sheetId: number } {
  // Convert our cells to a 2D array for HyperFormula
  let maxRow = 0;
  let maxCol = 0;

  const entries: { row: number; col: number; value: string | number | null; formula?: string }[] = [];

  for (const [key, cell] of Object.entries(allCells)) {
    const match = key.match(/^([A-Z]+)(\d+)$/);
    if (!match) continue;
    const col = letterToCol(match[1]);
    const row = parseInt(match[2]) - 1;
    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, col);
    entries.push({ row, col, value: cell.value, formula: cell.formula });
  }

  // Build a 2D data array
  const data: (string | number | null)[][] = [];
  for (let r = 0; r <= maxRow + 1; r++) {
    const rowData: (string | number | null)[] = [];
    for (let c = 0; c <= maxCol + 1; c++) {
      rowData.push(null);
    }
    data.push(rowData);
  }

  // Fill in values — use formula string if present, otherwise raw value
  for (const entry of entries) {
    if (entry.formula) {
      data[entry.row][entry.col] = entry.formula;
    } else {
      data[entry.row][entry.col] = entry.value;
    }
  }

  const hf = HyperFormula.buildFromArray(data, {
    licenseKey: 'gpl-v3',
  });

  return { hf, sheetId: 0 };
}

// ---------------------------------------------------------------------------
// Batch evaluate ALL formula cells in one HyperFormula engine instance.
// Call this instead of evaluateFormula in a loop — O(1) engines not O(n).
// ---------------------------------------------------------------------------
export function evaluateAllFormulas(
  cells: Record<string, Cell>
): Record<string, number | string> {
  const formulaEntries = Object.entries(cells).filter(([, cell]) => cell.formula);
  if (formulaEntries.length === 0) return {};

  try {
    const { hf, sheetId } = buildEngine(cells);
    const results: Record<string, number | string> = {};

    for (const [key] of formulaEntries) {
      const match = key.match(/^([A-Z]+)(\d+)$/);
      if (!match) continue;
      const col = letterToCol(match[1]);
      const row = parseInt(match[2]) - 1;

      const rawResult = hf.getCellValue({ sheet: sheetId, row, col });
      if (typeof rawResult === 'number') {
        results[key] = Math.round(rawResult * 100) / 100;
      } else if (typeof rawResult === 'string') {
        results[key] = rawResult;
      } else if (rawResult === null || rawResult === undefined) {
        results[key] = 0;
      } else if (typeof rawResult === 'object') {
        // HyperFormula CellError
        results[key] = '#ERROR';
      } else {
        results[key] = Number(rawResult);
      }
    }

    hf.destroy();
    return results;
  } catch {
    // Fallback: evaluate each formula with the simple evaluator
    const results: Record<string, number | string> = {};
    for (const [key, cell] of formulaEntries) {
      if (cell.formula) {
        results[key] = simpleFallback(cell.formula, (k) => cells[k]);
      }
    }
    return results;
  }
}

// Evaluate a single formula given all cells in the sheet
export function evaluateFormula(
  formula: string,
  getCell: (key: string) => Cell | undefined,
  allCells?: Record<string, Cell>
): number | string {
  if (!formula.startsWith('=')) return formula;

  // Try HyperFormula first
  if (allCells) {
    try {
      const { hf, sheetId } = buildEngine(allCells);

      // Put the formula in a temp cell beyond current data
      const tempRow = hf.getSheetDimensions(sheetId).height;
      hf.addRows(sheetId, [tempRow, 1]);
      hf.setCellContents({ sheet: sheetId, row: tempRow, col: 0 }, formula);

      const result = hf.getCellValue({ sheet: sheetId, row: tempRow, col: 0 });
      hf.destroy();

      if (typeof result === 'number') {
        return Math.round(result * 100) / 100;
      }
      if (typeof result === 'string') {
        return result;
      }
      if (result === null || result === undefined) {
        return 0;
      }
      // CellError or other object
      if (typeof result === 'object') {
        return '#ERROR';
      }
      return Number(result);
    } catch {
      // Fall through to simple fallback
    }
  }

  // Simple fallback for basic math
  return simpleFallback(formula, getCell);
}

function letterToCol(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

function simpleFallback(
  formula: string,
  getCell: (key: string) => Cell | undefined
): number | string {
  try {
    const expr = formula.substring(1).trim().toUpperCase();

    // Handle SUM(range), AVERAGE(range), etc. manually
    const funcMatch = expr.match(/^(SUM|AVERAGE|AVG|MIN|MAX|COUNT)\((.+)\)$/);
    if (funcMatch) {
      const func = funcMatch[1];
      const numbers = resolveRange(funcMatch[2], getCell);
      switch (func) {
        case 'SUM': return numbers.reduce((a, b) => a + b, 0);
        case 'AVERAGE': case 'AVG': return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
        case 'MIN': return numbers.length ? Math.min(...numbers) : 0;
        case 'MAX': return numbers.length ? Math.max(...numbers) : 0;
        case 'COUNT': return numbers.length;
        default: return '#FUNC?';
      }
    }

    // Simple arithmetic with cell refs
    let evalExpr = expr.replace(/([A-Z]+\d+)/g, (ref) => {
      const cell = getCell(ref);
      if (!cell || cell.value === null) return '0';
      return String(typeof cell.value === 'number' ? cell.value : parseFloat(String(cell.value)) || 0);
    });

    if (!/^[\d+\-*/().eE\s]+$/.test(evalExpr)) return '#ERROR';

    const result = new Function(`return (${evalExpr})`)();
    if (typeof result === 'number' && isFinite(result)) {
      return Math.round(result * 100) / 100;
    }
    return '#ERROR';
  } catch {
    return '#ERROR';
  }
}

function resolveRange(rangeStr: string, getCell: (key: string) => Cell | undefined): number[] {
  const numbers: number[] = [];
  const parts = rangeStr.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes(':')) {
      const [startRef, endRef] = trimmed.split(':');
      const start = parseRef(startRef.trim());
      const end = parseRef(endRef.trim());
      if (!start || !end) continue;

      for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
        for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
          const colLetter = colToLetter(c);
          const cell = getCell(`${colLetter}${r + 1}`);
          if (cell && typeof cell.value === 'number') numbers.push(cell.value);
        }
      }
    } else if (/^[A-Z]+\d+$/.test(trimmed)) {
      const cell = getCell(trimmed);
      if (cell && typeof cell.value === 'number') numbers.push(cell.value);
    } else {
      const n = parseFloat(trimmed);
      if (!isNaN(n)) numbers.push(n);
    }
  }
  return numbers;
}

function parseRef(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return { col: letterToCol(match[1]), row: parseInt(match[2]) - 1 };
}

function colToLetter(col: number): string {
  let result = '';
  let c = col;
  while (c >= 0) {
    result = String.fromCharCode(65 + (c % 26)) + result;
    c = Math.floor(c / 26) - 1;
  }
  return result;
}
