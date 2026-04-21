const STYLE_ELEMENT_ID = 'excel-clone-web-dynamic-styles';

const classCache = new Map<string, string>();
let classCounter = 0;

function ensureStyleSheet(): CSSStyleSheet | null {
  if (typeof document === 'undefined') return null;

  let styleElement = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = STYLE_ELEMENT_ID;
    document.head.appendChild(styleElement);
  }

  return styleElement.sheet as CSSStyleSheet | null;
}

function toKebabCase(value: string): string {
  if (value.startsWith('--')) return value;
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function serializeRules(declarations: Record<string, string | number | undefined>) {
  return Object.entries(declarations)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([property, value]) => `${toKebabCase(property)}:${String(value)}`)
    .join(';');
}

export function getDynamicClassName(
  prefix: string,
  declarations: Record<string, string | number | undefined>,
): string {
  const serialized = serializeRules(declarations);
  const cacheKey = `${prefix}:${serialized}`;
  const existing = classCache.get(cacheKey);
  if (existing) return existing;

  const className = `${prefix}-${classCounter += 1}`;
  const sheet = ensureStyleSheet();
  sheet?.insertRule(`.${className}{${serialized}}`, sheet.cssRules.length);
  classCache.set(cacheKey, className);
  return className;
}
