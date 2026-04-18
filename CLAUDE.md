# Project Context — iPad Excel Clone

## Overview

Building a native iPadOS app that functions as an Excel-like spreadsheet, intended as a better-feeling alternative to Microsoft Excel for iPad. The client uses Excel daily on his MacBook for financial/ledger tracking, but finds the iPad version frustrating to use (touch targets too small, feels ported from desktop, awkward gestures). The goal is an iPad-first app that opens his existing `.xlsx` files and feels native to touch.

## Client Background

- Works primarily on MacBook with real Microsoft Excel
- Uses Excel for financial ledgers (tracking people, dates, income/expense, balances)
- Real files contain Cyrillic text (Russian/Uzbek) — names like "Mansur aka", "Shavkat hoji", "Suhrob", "Elmurod", "Fuad aka"
- Each person typically has their own sheet tab in the workbook
- Already has Excel for iPad installed but it's not working well for his workflow
- Wants something that feels right on iPad while still working with his existing `.xlsx` files

## Scope

The client framed this as "build a clone of Excel." The realistic interpretation: build a touch-optimized iPad spreadsheet app that handles his actual workflow well — opening, editing, and saving `.xlsx` files with the features he uses (cell editing, formulas, formatting, multiple sheets, totals). Not a 1:1 reimplementation of every Excel feature.

## Tech Stack

- **Language:** Swift
- **UI Framework:** SwiftUI
- **Target:** iPadOS (native, App Store distribution)
- **IDE:** Xcode (free, on macOS)
- **`.xlsx` library:** [CoreXLSX](https://github.com/CoreOffice/CoreXLSX) — open source, MIT licensed, for reading `.xlsx` files in Swift
- **File access:** SwiftUI's `fileImporter` / `UIDocumentPickerViewController` for the iOS Files app integration
- **Cost:** All tools free except Apple Developer Program ($99/year for App Store publishing)

### Why Swift over alternatives

- Best touch feel on iPad (the client's core complaint is that Excel for iPad feels bad)
- Native performance for large spreadsheets
- Free Apple tooling, no paid dependencies
- Best Files app and iCloud integration
- React Native / Flutter would need paid grid libraries (Syncfusion, Handsontable Pro, AG Grid Enterprise) and would feel less native
- React + Univer + Capacitor was considered as fallback but rejected because a wrapped web app would feel like exactly the kind of "ported" experience the client is unhappy with

## Developer Background

- Knows PHP and Python (backend developer)
- Does not know Swift, SwiftUI, React Native, or React
- Will rely heavily on AI assistance (Claude Code) for the actual implementation
- Working on macOS with an iPad available for testing

## Design Direction

Two screens have been mocked up (in HTML, screenshots saved for client meeting):

### 1. Main spreadsheet view
- Excel-familiar layout: green header bar, ribbon tabs (Home, Insert, Draw, Formulas, Data, Review, View), formula bar with cell name + `fx` + input
- Touch-optimized: 36px toolbar buttons (vs Excel iPad's cramped 28px), taller formula bar, bigger sheet tabs
- Toolbar has real icons (undo/redo, font color, highlight, borders, alignment, AutoSum, currency, percent, chart)
- Selected cell shows bold green outline with selection handle dot (iPad-style)
- Sheet tabs at bottom named after people (matching client's actual file structure)
- Sample data: Date / Name / Type (Income green, Expense red) / Amount / Balance columns

### 2. Home / file browser screen
- Closer to Apple/iPad design language than Excel's home (which feels Windows-ported)
- "Create new" templates row at top: Blank, Budget, Invoice, Ledger, Task list — each with a tiny preview thumbnail
- Pill-shaped tabs: Recent / Favorites / Shared
- Recent files grouped by time (Today / Yesterday / Last week)
- Floating green "+ New spreadsheet" button bottom-right
- Excel green branding maintained for familiarity

## Key Features to Build (Priority Order)

1. **File handling** — open `.xlsx` from Files app, save back to `.xlsx`, preserve formatting and Cyrillic text
2. **Grid rendering** — display cells, columns, rows with proper headers (A/B/C, 1/2/3), scrolling, selection
3. **Cell editing** — tap to select, double-tap or formula bar to edit, iPad keyboard handling
4. **Formula bar** — show selected cell reference, allow formula entry with `=` prefix
5. **Basic formula evaluation** — start with SUM, AVERAGE, simple arithmetic (`+`, `-`, `*`, `/`), expand from there
6. **Multiple sheets** — sheet tabs at bottom, switch between sheets, add/rename/delete
7. **Cell formatting** — bold, italic, underline, font color, fill color, borders, alignment, number formats (currency, percent)
8. **Touch polish** — large tap targets, selection handles, proper gesture handling, smooth scrolling on large files

## Constraints

- Must handle Cyrillic (Russian/Uzbek) text correctly
- Must open and save real `.xlsx` files without breaking the client's existing files
- Must feel noticeably better on touch than Excel for iPad
- No paid third-party libraries
- Solo developer + AI assistance

## Realistic Timeline

Roughly 2 months part-time, assuming AI assistance throughout:
- Week 1: Swift/SwiftUI ramp-up, project setup, basic grid rendering
- Week 2: CoreXLSX integration, open client's real file, display data
- Week 3: Cell selection, editing, formula bar
- Week 4: Basic formula evaluation, multiple sheets
- Week 5: Cell formatting (bold, colors, borders)
- Week 6: Saving back to `.xlsx`, file picker integration
- Week 7: Touch polish, toolbar refinement, test with real files
- Week 8: Bug fixes, App Store submission prep

## Open Questions to Confirm with Client

1. Which specific Excel for iPad pain points is he hitting? (Should watch him use it on his real file)
2. Does the file need to round-trip cleanly between his Mac Excel and the new app?
3. Does he need pivot tables, charts, or advanced features — or just clean data entry + formulas + totals?
4. iPad only, or also iPhone?
5. Just for him, or will other people (employees, accountant) use it too?

## Notes for Claude Code

- Start with a basic SwiftUI app skeleton, then build the grid view
- For the grid, consider `LazyVGrid` for smaller sheets or a custom `Canvas`/`UICollectionView` wrapper for performance with large sheets
- CoreXLSX handles reading; for writing back to `.xlsx`, may need to manipulate the underlying XML (xlsx is a zip of XML files) or find another library
- Test with the client's real file early — Cyrillic + his specific formatting will surface bugs faster than synthetic test data
- The client's design preference is "close to real Excel (familiar)" — don't over-redesign, keep the green Excel branding and ribbon-style toolbar
