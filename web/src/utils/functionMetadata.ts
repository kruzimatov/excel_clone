export interface FunctionMeta {
  name: string;
  russianName: string;
  description: string;
  syntax: string;
  category: string;
}

export const FUNCTION_LIBRARY: Record<string, FunctionMeta> = {
  SUM: {
    name: 'SUM',
    russianName: 'СУММ',
    description: 'Sums all numbers in a range',
    syntax: 'СУММ(range)',
    category: 'Math',
  },
  AVERAGE: {
    name: 'AVERAGE',
    russianName: 'СРЕДНЕЕ',
    description: 'Calculates the average of numbers',
    syntax: 'СРЕДНЕЕ(range)',
    category: 'Statistical',
  },
  COUNT: {
    name: 'COUNT',
    russianName: 'СЧЁТ',
    description: 'Counts cells with numbers',
    syntax: 'СЧЁТ(range)',
    category: 'Statistical',
  },
  COUNTA: {
    name: 'COUNTA',
    russianName: 'СЧЁТЗ',
    description: 'Counts non-empty cells',
    syntax: 'СЧЁТЗ(range)',
    category: 'Statistical',
  },
  MIN: {
    name: 'MIN',
    russianName: 'МИН',
    description: 'Returns minimum value',
    syntax: 'МИН(range)',
    category: 'Math',
  },
  MAX: {
    name: 'MAX',
    russianName: 'МАКС',
    description: 'Returns maximum value',
    syntax: 'МАКС(range)',
    category: 'Math',
  },
  ABS: {
    name: 'ABS',
    russianName: 'ABS',
    description: 'Returns absolute value',
    syntax: 'ABS(number)',
    category: 'Math',
  },
  ROUND: {
    name: 'ROUND',
    russianName: 'ОКРУГЛ',
    description: 'Rounds to specified decimal places',
    syntax: 'ОКРУГЛ(number, decimals)',
    category: 'Math',
  },
  IF: {
    name: 'IF',
    russianName: 'ЕСЛИ',
    description: 'Conditional logic',
    syntax: 'ЕСЛИ(condition, true_value, false_value)',
    category: 'Logical',
  },
  AND: {
    name: 'AND',
    russianName: 'И',
    description: 'Returns TRUE if all conditions are true',
    syntax: 'И(condition1, condition2, ...)',
    category: 'Logical',
  },
  OR: {
    name: 'OR',
    russianName: 'ИЛИ',
    description: 'Returns TRUE if any condition is true',
    syntax: 'ИЛИ(condition1, condition2, ...)',
    category: 'Logical',
  },
};

export function getAllFunctions(): FunctionMeta[] {
  return Object.values(FUNCTION_LIBRARY);
}

export function getFunctionByRussianName(name: string): FunctionMeta | undefined {
  return Object.values(FUNCTION_LIBRARY).find(
    (func) => func.russianName.toUpperCase() === name.toUpperCase(),
  );
}

export function getFunctionByEnglishName(name: string): FunctionMeta | undefined {
  return FUNCTION_LIBRARY[name.toUpperCase()];
}

export function filterFunctions(input: string): FunctionMeta[] {
  if (!input || input.length === 0) return getAllFunctions();
  const upper = input.toUpperCase();
  return getAllFunctions().filter(
    (func) =>
      func.russianName.toUpperCase().startsWith(upper)
      || func.name.toUpperCase().startsWith(upper),
  );
}
