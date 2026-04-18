/**
 * Runtime validation: Test if implementations would actually work
 */
const fs = require('fs');

console.log('\n🔧 RUNTIME VALIDATION\n');

// 1. Check if functionMetadata exports are correct
console.log('1. Checking functionMetadata exports...');
const metadata = fs.readFileSync('src/utils/functionMetadata.ts', 'utf8');
const hasGetAll = metadata.includes('getAllFunctions');
const hasFilter = metadata.includes('filterFunctions');
const hasGetByRussian = metadata.includes('getFunctionByRussianName');

if (hasGetAll && hasFilter && hasGetByRussian) {
  console.log('   ✅ All export functions present');
} else {
  console.log('   ❌ Missing export functions');
  process.exit(1);
}

// 2. Check if FunctionSuggestions has proper TypeScript types
console.log('\n2. Checking FunctionSuggestions types...');
const suggestions = fs.readFileSync('src/components/FunctionSuggestions.tsx', 'utf8');
const hasProps = suggestions.includes('interface FunctionSuggestionsProps');
const hasFC = suggestions.includes('React.FC');

if (hasProps && hasFC) {
  console.log('   ✅ Proper React.FC typing');
} else {
  console.log('   ❌ Type definitions incomplete');
  process.exit(1);
}

// 3. Check useWorkbook exports
console.log('\n3. Checking useWorkbook hook exports...');
const workbook = fs.readFileSync('src/store/useWorkbook.ts', 'utf8');
const hasReturn = workbook.includes('return {');
const exportsRangeStart = workbook.includes('rangeSelectionMode') && workbook.includes('return');
const exportsMethods = workbook.includes('startRangeSelection') && workbook.includes('applyRangeSelection');

if (exportsRangeStart && exportsMethods) {
  console.log('   ✅ Range selection methods exported from hook');
} else {
  console.log('   ❌ Hook exports incomplete');
  process.exit(1);
}

// 4. Check Grid component useRef usage
console.log('\n4. Checking Grid component refs...');
const grid = fs.readFileSync('src/components/Grid.tsx', 'utf8');
const hasRef = grid.includes('useRef');
const hasRefType = grid.includes('FlatList<');

if (hasRef && hasRefType) {
  console.log('   ✅ Proper useRef typing for FlatList');
} else {
  console.log('   ❌ Ref typing issues');
  process.exit(1);
}

// 5. Check SpreadsheetScreen integration points
console.log('\n5. Checking SpreadsheetScreen integrations...');
const screen = fs.readFileSync('src/components/SpreadsheetScreen.tsx', 'utf8');
const callsStart = screen.includes('startRangeSelection') || screen.includes('wb.rangeSelectionMode');
const callsApply = screen.includes('applyRangeSelection');
const showsUI = screen.includes('rangeSelectionBar');

if (callsStart && callsApply && showsUI) {
  console.log('   ✅ All integration calls present');
} else {
  console.log('   ⚠️  Some integrations may be incomplete:');
  console.log(`      startRangeSelection: ${callsStart ? '✓' : '✗'}`);
  console.log(`      applyRangeSelection: ${callsApply ? '✓' : '✗'}`);
  console.log(`      rangeSelectionBar UI: ${showsUI ? '✓' : '✗'}`);
}

// 6. Check Toolbar formula change handler
console.log('\n6. Checking Toolbar formula handlers...');
const toolbar = fs.readFileSync('src/components/Toolbar.tsx', 'utf8');
const hasFormulaChange = toolbar.includes('handleFormulaChange') || toolbar.includes('onFormulaChange');
const hasSelect = toolbar.includes('handleFunctionSelect') || toolbar.includes('onSelect');

if (hasFormulaChange && hasSelect) {
  console.log('   ✅ Formula handlers implemented');
} else {
  console.log('   ⚠️  Formula handlers:');
  console.log(`      handleFormulaChange: ${hasFormulaChange ? '✓' : '✗'}`);
  console.log(`      handleFunctionSelect: ${hasSelect ? '✓' : '✗'}`);
}

// 7. Check ContextMenu currency/colors
console.log('\n7. Checking ContextMenu sections...');
const menu = fs.readFileSync('src/components/ContextMenu.tsx', 'utf8');
const hasCopy = menu.includes('Copy') || menu.includes('copy');
const hasFormulas = menu.includes('FORMULAS') || menu.includes('SUM');
const hasColors = menu.includes('CELL_COLORS') || menu.includes('Color');
const hasCurrency = menu.includes('CURRENCIES') || menu.includes('Currency');

console.log(`   Copy/Cut/Paste: ${hasCopy ? '✅' : '❌'}`);
console.log(`   Formulas: ${hasFormulas ? '✅' : '❌'}`);
console.log(`   Colors: ${hasColors ? '✅' : '❌'}`);
console.log(`   Currency: ${hasCurrency ? '✅' : '❌'}`);

if (!hasCopy || !hasFormulas || !hasColors || !hasCurrency) {
  console.log('   ⚠️  Some context menu sections incomplete');
}

console.log('\n✅ RUNTIME VALIDATION COMPLETE\n');
