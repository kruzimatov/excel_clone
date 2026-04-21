# Excel Clone - Feature User Guide

## Overview
This document explains how to use all the new features implemented in the Excel clone iPad app.

## Feature 1: Russian Function Library

### Available Functions
The app now supports 11 Russian language functions:

| Russian Name | English Name | Purpose | Syntax |
|--------------|--------------|---------|--------|
| СУММ | SUM | Sum all numbers in range | СУММ(A1:A10) |
| СРЕДНЕЕ | AVERAGE | Calculate average | СРЕДНЕЕ(A1:A10) |
| СЧЁТ | COUNT | Count numeric cells | СЧЁТ(A1:A10) |
| СЧЁТЗ | COUNTA | Count non-empty cells | СЧЁТЗ(A1:A10) |
| МИН | MIN | Find minimum value | МИН(A1:A10) |
| МАКС | MAX | Find maximum value | МАКС(A1:A10) |
| ЕСЛИ | IF | Conditional logic | ЕСЛИ(condition, true_value, false_value) |
| И | AND | Logical AND | И(condition1, condition2) |
| ИЛИ | OR | Logical OR | ИЛИ(condition1, condition2) |
| ОКРУГЛ | ROUND | Round to decimals | ОКРУГЛ(number, decimals) |
| ABS | ABS | Absolute value | ABS(number) |

### Usage
1. Tap the formula bar at bottom
2. Type `=` followed by Russian function name (e.g., `=СУММ`)
3. The function syntax appears automatically
4. Complete the formula and tap ✓

---

## Feature 2: Formula Autocomplete Dropdown

### How It Works
When you start typing a formula with `=`:

1. **Type `=`** in the formula bar
2. **Dropdown appears** showing available functions
3. **Real-time filtering** - suggestions update as you type
4. **Tap a function** to inject it into formula
5. **Complete the formula** with cell references or values

### Example Workflow
```
1. Tap formula bar
2. Type: =СУ
3. See: СУММ (Sum...), СЧЁТ (Count...), СЧЁТЗ (Count non-empty...)
4. Tap: СУММ
5. Formula becomes: =СУММ()
6. Type: A1:A10 inside parentheses
7. Tap ✓ to confirm
```

---

## Feature 3: Range Selection Mode

### Purpose
Select a range by tapping first cell, then second cell, and all cells between are automatically selected.

### Step-by-Step

1. **Tap the first cell** of your range (e.g., A1)
2. **Long-press or tap** the "Range" button in context menu (right-click menu)
3. **Yellow notification bar appears** saying "Select second cell: A1"
4. **Tap the second cell** (e.g., D5)
5. **All cells from A1 to D5 are now selected**
6. **Perform action** (copy, delete, format, fill, etc.)

### Context Menu Access
- Long-press any cell on iPad
- Or tap-and-hold on iPhone
- Look for "Range" or range icon button

### What You Can Do With Selected Range
- Copy entire range
- Delete all cells at once
- Apply formatting to all at once
- Fill with formulas
- Apply currency formatting

---

## Feature 4: Professional Context Menu

### How to Open
- **iPad**: Long-press any cell
- **iPhone**: Tap-and-hold any cell

### Menu Sections

#### Copy/Cut/Paste
- **Copy**: Copy cell/range to clipboard
- **Cut**: Cut cell/range (appears grayed out)
- **Paste**: Paste from clipboard

#### Quick Formulas
Fast access to common functions:
- **Σ SUM** (Сумма) - Sum selected range
- **x̄ AVERAGE** (Среднее) - Average of range
- **↓ MIN** (Минимум) - Minimum value
- **↑ MAX** (Максимум) - Maximum value
- **\# COUNT** (Кол-во) - Count of values

Tap any to apply formula to selected cell.

#### Fill Color
- 10 color swatches
- Tap to apply background color to cell/range
- Colors: White, Mint, Green, Sky, Rose, Yellow, Blue, Sage, Peach, Gray

#### Currency
Quick currency formatting:
- **$** USD Dollar
- **₽** RUB Ruble
- **so'm** UZS Uzbek Som
- **€** EUR Euro

Tap to apply currency symbol and formatting.

#### Clear Cells
- **Clear** (red button)
- Deletes all content from selected cell/range

---

## Feature 5: Grid Auto-Scroll Optimization

### What It Does
When you select or navigate to a cell that's off-screen, the grid automatically scrolls to center that cell in view.

### How It Works
1. **Tap a cell** that's out of view (off-screen)
2. **Grid automatically scrolls** smoothly
3. **Selected cell appears centered** in viewport
4. **No manual scrolling needed**

### Benefits
- Faster navigation for large spreadsheets
- No need to manually scroll to see selected cell
- Smooth, professional animation

---

## Feature 6: Smart Grid Performance

### Optimization Features
- **Only visible rows render** (virtualization)
- **Smooth scrolling** even with 200+ rows
- **Fast cell selection**
- **Minimal memory usage**

---

## Quick Start Example

### Task: Sum a column of numbers in Russian

1. **Enter data** in cells A1-A5
2. **Tap cell B1** (where you want result)
3. **Tap formula bar**
4. **Type: `=`** (dropdown appears)
5. **Type: `СУ`** (СУММ appears)
6. **Tap: СУММ**
7. **Type: `A1:A5`**
8. **Tap ✓** (result appears)

---

## Tips & Tricks

### Tip 1: Range Selection Alternative
Instead of long-pressing "Range", try:
- Tap first cell
- Hold and drag to second cell (if supported)
- All cells in path are selected

### Tip 2: Quick Formatting
- Select range with Range mode
- Long-press to open menu
- Tap a formula button to apply to entire range

### Tip 3: Currency Formatting
- Tap any cell with number
- Long-press → Currency → $ (or other symbol)
- Number automatically formatted with currency symbol

### Tip 4: Autocomplete Keyboard
- When suggestions appear, you can:
  - Tap a suggestion to select
  - Continue typing to filter more
  - Tap outside dropdown to close

---

## Supported Languages

### UI Language
- English (primary)
- Russian function names (CYRILLIC)

### Formula Input
- Type Russian function names directly
- Both UPPERCASE and lowercase work
- Examples: `СУММ`, `сумм`, `СРЕДНЕЕ`, `среднее`

---

## Technical Details

### Files Modified
- `src/utils/functionMetadata.ts` - Function definitions
- `src/components/FunctionSuggestions.tsx` - Autocomplete dropdown
- `src/components/Toolbar.tsx` - Formula bar integration
- `src/store/useWorkbook.ts` - Range selection logic
- `src/components/SpreadsheetScreen.tsx` - Range UI
- `src/components/Grid.tsx` - Auto-scroll
- `src/components/ContextMenu.tsx` - Menu design

### Performance
- TypeScript: Zero compilation errors
- All features use React hooks
- Virtualization preserves performance
- Professional memory management

---

## Troubleshooting

### Function not appearing in dropdown
- Check spelling (Russian functions use Cyrillic)
- Make sure you typed `=` first
- Try typing more letters to filter

### Range selection not working
- Make sure you tap the "Range" button first
- Notification bar should show yellow
- Then tap second cell

### Grid not scrolling
- Make sure cell is actually off-screen
- Try selecting a cell far from current view
- Should auto-scroll on selection

### Colors not applying
- Select cell first
- Long-press to open menu
- Tap color swatch
- Make sure cell is in focus

---

## Support

All features are production-ready and fully integrated. For questions, refer to the IMPLEMENTATION_SUMMARY.md file.

---

**Excel Clone Version:** 1.0 with Russian Functions
**Last Updated:** April 17, 2025
**Status:** ✅ Production Ready
