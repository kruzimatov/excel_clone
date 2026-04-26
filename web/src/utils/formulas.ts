import { HyperFormula } from 'hyperformula';

import type { Cell } from '../types';

interface CellBounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

const MAX_HYPERFORMULA_GRID_CELLS = 200_000;

const FUNCTION_ALIASES: Record<string, string> = {
  СУММ: 'SUM',
  СРЕДНЕЕ: 'AVERAGE',
  СЧЁТ: 'COUNT',
  СЧЕТ: 'COUNT',
  СЧЁТЗ: 'COUNTA',
  СЧЕТЗ: 'COUNTA',
  МИН: 'MIN',
  МАКС: 'MAX',
  ЕСЛИ: 'IF',
  И: 'AND',
  ИЛИ: 'OR',
  ОКРУГЛ: 'ROUND',
  АБС: 'ABS',
  AVG: 'AVERAGE',
};

export function normalizeFormula(formula: string): string {
  if (!formula.startsWith('=')) return formula;
  let expression = formula;
  for (const [alias, english] of Object.entries(FUNCTION_ALIASES)) {
    const regex = new RegExp(`${escapeRegex(alias)}\\s*\\(`, 'gi');
    expression = expression.replace(regex, `${english}(`);
  }
  return expression;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let hfLoadFailed = false;

function getHyperFormula() {
  if (hfLoadFailed) return null;
  return HyperFormula;
}

function buildEngine(allCells: Record<string, Cell>): { hf: HyperFormula; sheetId: number } | null {
  const HF = getHyperFormula();
  if (!HF) return null;

  let maxRow = 0;
  let maxCol = 0;

  const entries: { row: number; col: number; value: string | number | null; formula?: string }[] = [];

  for (const [key, cell] of Object.entries(allCells)) {
    const match = key.match(/^([A-Z]+)(\d+)$/);
    if (!match) continue;

    const col = letterToCol(match[1]);
    const row = parseInt(match[2], 10) - 1;

    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, col);
    entries.push({
      row,
      col,
      value: cell.value,
      formula: cell.formula ? normalizeFormula(cell.formula) : undefined,
    });
  }

  const estimatedGridCells = (maxRow + 2) * (maxCol + 2);
  if (estimatedGridCells > MAX_HYPERFORMULA_GRID_CELLS) {
    return null;
  }

  const data: (string | number | null)[][] = [];
  for (let row = 0; row <= maxRow + 1; row += 1) {
    const rowData: (string | number | null)[] = [];
    for (let col = 0; col <= maxCol + 1; col += 1) {
      rowData.push(null);
    }
    data.push(rowData);
  }

  for (const entry of entries) {
    data[entry.row][entry.col] = entry.formula ?? entry.value;
  }

  try {
    const hf = HF.buildFromArray(data, {
      licenseKey: 'gpl-v3',
    });
    return { hf, sheetId: 0 };
  } catch {
    hfLoadFailed = true;
    return null;
  }
}

export function evaluateAllFormulas(
  cells: Record<string, Cell>,
  formulaKeys?: string[],
): Record<string, number | string> {
  const formulaEntries = formulaKeys
    ? formulaKeys
        .map((key) => [key, cells[key]] as const)
        .filter((entry): entry is [string, Cell] => !!entry[1]?.formula)
    : Object.entries(cells).filter(([, cell]) => cell.formula);
  if (formulaEntries.length === 0) return {};

  const engine = buildEngine(cells);
  if (engine) {
    try {
      const { hf, sheetId } = engine;
      const results: Record<string, number | string> = {};

      for (const [key] of formulaEntries) {
        const match = key.match(/^([A-Z]+)(\d+)$/);
        if (!match) continue;

        const col = letterToCol(match[1]);
        const row = parseInt(match[2], 10) - 1;
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
      // Fall back to the simple evaluator below.
    }
  }

  const results: Record<string, number | string> = {};
  for (const [key, cell] of formulaEntries) {
    if (cell.formula) {
      results[key] = simpleFallback(cell.formula, (lookupKey) => cells[lookupKey]);
    }
  }
  return results;
}

export function evaluateFormula(
  formula: string,
  getCell: (key: string) => Cell | undefined,
  allCells?: Record<string, Cell>,
): number | string {
  if (!formula.startsWith('=')) return formula;

  const normalized = normalizeFormula(formula);

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
        // Fall through to the backup parser.
      }
    }
  }

  return simpleFallback(normalized, getCell);
}

export function formulaTouchesRange(formula: string, bounds: CellBounds): boolean {
  const normalized = normalizeFormula(formula).toUpperCase();
  const matches = normalized.matchAll(/([A-Z]+\d+)(?::([A-Z]+\d+))?/g);

  for (const match of matches) {
    const start = parseRef(match[1]);
    if (!start) continue;

    if (!match[2]) {
      if (
        start.row >= bounds.minRow
        && start.row <= bounds.maxRow
        && start.col >= bounds.minCol
        && start.col <= bounds.maxCol
      ) {
        return true;
      }
      continue;
    }

    const end = parseRef(match[2]);
    if (!end) continue;

    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    const rowOverlap = minRow <= bounds.maxRow && maxRow >= bounds.minRow;
    const colOverlap = minCol <= bounds.maxCol && maxCol >= bounds.minCol;
    if (rowOverlap && colOverlap) {
      return true;
    }
  }

  return false;
}

function letterToCol(letter: string): number {
  let result = 0;
  for (let index = 0; index < letter.length; index += 1) {
    result = result * 26 + (letter.charCodeAt(index) - 64);
  }
  return result - 1;
}

function simpleFallback(
  formula: string,
  getCell: (key: string) => Cell | undefined,
): number | string {
  try {
    const expression = normalizeFormula(formula).substring(1).trim().toUpperCase();

    const functionMatch = expression.match(/^(SUM|AVERAGE|AVG|MIN|MAX|COUNT|COUNTA|ROUND|ABS)\((.+)\)$/);
    if (functionMatch) {
      const func = functionMatch[1];
      const inner = functionMatch[2];

      if (func === 'ROUND') {
        const parts = inner.split(',');
        const values = resolveRange(parts[0], getCell);
        const digits = parts[1] ? parseInt(parts[1].trim(), 10) : 0;
        if (values.length > 0) {
          const factor = Math.pow(10, digits);
          return Math.round(values[0] * factor) / factor;
        }
        return 0;
      }

      if (func === 'ABS') {
        const values = resolveRange(inner, getCell);
        return values.length > 0 ? Math.abs(values[0]) : 0;
      }

      const numbers = resolveRange(inner, getCell);
      switch (func) {
        case 'SUM':
          return numbers.reduce((sum, value) => sum + value, 0);
        case 'AVERAGE':
        case 'AVG':
          return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
        case 'MIN':
          return numbers.length ? Math.min(...numbers) : 0;
        case 'MAX':
          return numbers.length ? Math.max(...numbers) : 0;
        case 'COUNT':
        case 'COUNTA':
          return numbers.length;
        default:
          return '#FUNC?';
      }
    }

    const evalExpression = expression.replace(/([A-Z]+\d+)/g, (ref) => {
      const cell = getCell(ref);
      if (!cell || cell.value === null) return '0';
      return String(typeof cell.value === 'number' ? cell.value : parseFloat(String(cell.value)) || 0);
    });

    if (!/^[\d+\-*/().eE\s]+$/.test(evalExpression)) return '#ERROR';

    const result = new Function(`return (${evalExpression})`)();
    if (typeof result === 'number' && Number.isFinite(result)) {
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

      for (let row = Math.min(start.row, end.row); row <= Math.max(start.row, end.row); row += 1) {
        for (let col = Math.min(start.col, end.col); col <= Math.max(start.col, end.col); col += 1) {
          const cell = getCell(`${colToLetter(col)}${row + 1}`);
          if (cell && typeof cell.value === 'number') numbers.push(cell.value);
        }
      }
    } else if (/^[A-Z]+\d+$/.test(trimmed)) {
      const cell = getCell(trimmed);
      if (cell && typeof cell.value === 'number') numbers.push(cell.value);
    } else {
      const parsed = parseFloat(trimmed);
      if (!Number.isNaN(parsed)) numbers.push(parsed);
    }
  }

  return numbers;
}

function parseRef(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return { col: letterToCol(match[1]), row: parseInt(match[2], 10) - 1 };
}

function colToLetter(col: number): string {
  let result = '';
  let current = col;
  while (current >= 0) {
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26) - 1;
  }
  return result;
}
