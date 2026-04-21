import { Cell } from '../types';

// Map Russian (and common aliases) → English function names
const FUNCTION_ALIASES: Record<string, string> = {
  'СУММ': 'SUM',
  'СРЕДНЕЕ': 'AVERAGE',
  'СЧЁТ': 'COUNT',
  'СЧЕТ': 'COUNT',
  'СЧЁТЗ': 'COUNTA',
  'СЧЕТЗ': 'COUNTA',
  'МИН': 'MIN',
  'МАКС': 'MAX',
  'ЕСЛИ': 'IF',
  'И': 'AND',
  'ИЛИ': 'OR',
  'ОКРУГЛ': 'ROUND',
  'АБС': 'ABS',
  'AVG': 'AVERAGE',
};

// Normalize formula: translate Russian/alias function names → English
function normalizeFormula(formula: string): string {
  if (!formula.startsWith('=')) return formula;
  let expr = formula;
  for (const [alias, english] of Object.entries(FUNCTION_ALIASES)) {
    // Replace all occurrences of alias followed by '(' (case-insensitive)
    const regex = new RegExp(escapeRegex(alias) + '\\s*\\(', 'gi');
    expr = expr.replace(regex, english + '(');
  }
  return expr;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let HyperFormula: any = null;
let hfLoadFailed = false;

function getHyperFormula(): any {
  if (hfLoadFailed) return null;
  if (HyperFormula) return HyperFormula;
  try {
    HyperFormula = require('hyperformula').HyperFormula;
    return HyperFormula;
  } catch {
    hfLoadFailed = true;
    return null;
  }
}

// Create a fresh HyperFormula engine with cell data loaded
function buildEngine(allCells: Record<string, Cell>): { hf: any; sheetId: number } | null {
  const HF = getHyperFormula();
  if (!HF) return null;

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
    entries.push({ row, col, value: cell.value, formula: cell.formula ? normalizeFormula(cell.formula) : undefined });
  }

  const data: (string | number | null)[][] = [];
  for (let r = 0; r <= maxRow + 1; r++) {
    const rowData: (string | number | null)[] = [];
    for (let c = 0; c <= maxCol + 1; c++) {
      rowData.push(null);
    }
    data.push(rowData);
  }

  for (const entry of entries) {
    if (entry.formula) {
      data[entry.row][entry.col] = entry.formula;
    } else {
      data[entry.row][entry.col] = entry.value;
    }
  }

  try {
    const hf = HF.buildFromArray(data, {
      licenseKey: 'gpl-v3',
    });
    return { hf, sheetId: 0 };
  } catch {
    return null;
  }
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

  const engine = buildEngine(cells);
  if (engine) {
    try {
      const { hf, sheetId } = engine;
      const results: Record<string, number | string> = {};

      for (const [key] of formulaEntries) {
        const m = key.match(/^([A-Z]+)(\d+)$/);
        if (!m) continue;
        const col = letterToCol(m[1]);
        const row = parseInt(m[2]) - 1;

        const rawResult = hf.getCellValue({ sheet: sheetId, row, col });
        if (typeof rawResult === 'number') {
          results[key] = Math.round(rawResult * 100) / 100;
        } else if (typeof rawResult === 'string') {
          results[key] = rawResult;
        } else if (rawResult === null || rawResult === undefined) {
          results[key] = 0;
        } else if (typeof rawResult === 'object') {
          results[key] = '#ERROR';
        } else {
          results[key] = Number(rawResult);
        }
      }

      hf.destroy();
      return results;
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback: evaluate each formula with the simple evaluator
  const results: Record<string, number | string> = {};
  for (const [key, cell] of formulaEntries) {
    if (cell.formula) {
      results[key] = simpleFallback(cell.formula, (k) => cells[k]);
    }
  }
  return results;
}

// Evaluate a single formula given all cells in the sheet
export function evaluateFormula(
  formula: string,
  getCell: (key: string) => Cell | undefined,
  allCells?: Record<string, Cell>
): number | string {
  if (!formula.startsWith('=')) return formula;

  const normalized = normalizeFormula(formula);

  // Try HyperFormula first
  if (allCells) {
    const engine = buildEngine(allCells);
    if (engine) {
      try {
        const { hf, sheetId } = engine;
        const tempRow = hf.getSheetDimensions(sheetId).height;
        hf.addRows(sheetId, [tempRow, 1]);
        hf.setCellContents({ sheet: sheetId, row: tempRow, col: 0 }, normalized);

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
        if (typeof result === 'object') {
          return '#ERROR';
        }
        return Number(result);
      } catch {
        // Fall through to simple fallback
      }
    }
  }

  return simpleFallback(normalized, getCell);
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
    // normalizeFormula already translated Russian → English
    const expr = normalizeFormula(formula).substring(1).trim().toUpperCase();

    const funcMatch = expr.match(/^(SUM|AVERAGE|AVG|MIN|MAX|COUNT|COUNTA|ROUND|ABS)\((.+)\)$/);
    if (funcMatch) {
      const func = funcMatch[1];
      const inner = funcMatch[2];

      if (func === 'ROUND') {
        const parts = inner.split(',');
        const val = resolveRange(parts[0], getCell);
        const digits = parts[1] ? parseInt(parts[1].trim()) : 0;
        if (val.length > 0) {
          const factor = Math.pow(10, digits);
          return Math.round(val[0] * factor) / factor;
        }
        return 0;
      }
      if (func === 'ABS') {
        const val = resolveRange(inner, getCell);
        return val.length > 0 ? Math.abs(val[0]) : 0;
      }

      const numbers = resolveRange(inner, getCell);
      switch (func) {
        case 'SUM': return numbers.reduce((a, b) => a + b, 0);
        case 'AVERAGE': case 'AVG': return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
        case 'MIN': return numbers.length ? Math.min(...numbers) : 0;
        case 'MAX': return numbers.length ? Math.max(...numbers) : 0;
        case 'COUNT': return numbers.length;
        case 'COUNTA': return numbers.length;
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
