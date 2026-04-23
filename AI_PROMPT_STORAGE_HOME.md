## AI Prompt: Storage, Home Page, Google Drive, Dynamic Rows

You are working on the **web app** in this project, not the mobile app.

Project root:
`/Users/xayrullorozimatov/Desktop/HyperCodes/freelance/Excel_clone`

Important folders:
- `web/src/components`
- `web/src/store`
- `web/src/utils`
- `web/src/types`

Current app facts you must respect:
- The web app currently opens and saves `.xlsx` files in `web/src/components/SpreadsheetScreen.tsx`
- Local draft persistence already exists in `web/src/utils/localStorage.ts`
- Copy / cut / paste / undo / redo keyboard shortcuts already exist in the web app
- The grid is currently limited to **200 rows** in `web/src/components/Grid.tsx`
- Do **not** touch or delete any Google Drive files or spreadsheets that already exist
- Do **not** implement any delete action for Google Drive files in this task

## Goal

Implement a better file-storage flow for the web spreadsheet app with:

1. A homepage similar to **Google Sheets home**
2. File management from both **device storage** and **Google Drive**
3. Safe saving to **one dedicated app folder in Google Drive**
4. Dynamic row loading:
   - every sheet initially shows **50 rows**
   - user can add more rows in increments such as **+50** or **+100**
5. Spreadsheet shortcuts similar to Google Sheets / desktop editors

## Product decisions to implement

Use these UX decisions unless the existing code strongly requires a nearby variation:

### Storage model
- Keep a **local browser draft/autosave** for safety
- Add explicit cloud actions instead of silently overwriting Drive all the time
- The main save flow should be:
  - `Save` = save/update local draft and current in-app state
  - `Save to Google Drive` = upload or update the file in the app’s Drive folder
  - `Save As` = let the user choose a new local `.xlsx` filename
  - `Open from Device` = import local `.xlsx`
  - `Open from Google Drive` = pick from files inside the dedicated app folder or recently opened Drive files handled by this app

### Google Drive safety rules
- Create exactly **one dedicated folder** for this app, for example `Excel Clone Files`
- If the folder already exists, reuse it
- Only create, read, update, and list files inside that folder for this feature
- Never delete files
- Never modify unrelated user spreadsheets outside the app folder
- If Drive auth is missing or expires, show a friendly reconnect state

### Home page behavior
- Build a home screen inspired by Google Sheets home
- Show:
  - top actions for `Blank spreadsheet`, `Open from device`, `Open from Google Drive`
  - recent files section
  - source filters such as `All`, `Device`, `Google Drive`
  - file cards/list with filename, source, modified time, and quick actions
- Opening a file should route into the spreadsheet editor
- Saving from the editor should keep the home page file list in sync

### Rows behavior
- Remove the fixed UX assumption that all sheets always show 200 rows
- Every sheet should start by showing **50 visible rows**
- Add a control near the bottom-right or bottom area of the sheet:
  - `Add 50 rows`
  - `Add 100 rows`
- This should work for:
  - imported sheets
  - existing sheets
  - newly created sheets
- The data model should allow more rows without breaking selection, editing, formulas, paste, or navigation
- If a workbook has data below row 50, automatically show enough rows to include existing data, but never fewer than 50

### Keyboard shortcuts
- Keep existing shortcuts working:
  - `Ctrl/Cmd+C`
  - `Ctrl/Cmd+X`
  - `Ctrl/Cmd+V`
  - `Ctrl/Cmd+Z`
  - `Ctrl/Cmd+Shift+Z`
  - `Ctrl/Cmd+Y`
- Add or improve common desktop spreadsheet shortcuts where reasonable:
  - `Ctrl/Cmd+S` for Save
  - `Delete` / `Backspace` to clear cells
  - `Enter` to commit and move down
  - arrow keys to move selection
- Do not break editing inputs or native text entry behavior

## Technical implementation guidance

### Architecture
- Introduce a lightweight app-shell flow for:
  - `home`
  - `editor`
- Avoid a huge monolithic component if possible
- Extract reusable storage logic instead of putting everything into one file

Suggested areas:
- `web/src/App.tsx`
- `web/src/components/HomeScreen.tsx`
- `web/src/components/SpreadsheetScreen.tsx`
- `web/src/components/Grid.tsx`
- `web/src/store/useWorkbook.ts`
- `web/src/utils/localStorage.ts`
- new utility/service modules for Google Drive integration and recent file metadata

### Data model additions
- Add enough metadata to support:
  - file source: `device` or `google-drive`
  - file id for Drive
  - folder id for the app folder if needed
  - last opened / last modified
  - visible row count per sheet
- Keep TypeScript types clean and explicit

### Google Drive integration
- Use the Google Drive API in a safe way for web
- Support:
  - sign in / auth state
  - find-or-create app folder
  - list files from app folder
  - upload new workbook
  - update existing workbook
  - open/download workbook from Drive
- The implementation must be non-destructive
- If credentials/config are required, isolate them clearly and document setup

### XLSX behavior
- Continue using the current `.xlsx` import/export logic as the base
- When saving to Drive, upload the generated `.xlsx` blob
- Preserve current workbook sheet names and cell data

### Row rendering
- Replace hardcoded row constants with per-sheet or derived visible row counts
- Keep performance acceptable
- Selection, scrolling, editing, and formula behavior must still work after adding rows

## Acceptance criteria

1. App opens to a home page instead of jumping directly into the editor
2. User can create a blank spreadsheet from the home page
3. User can open `.xlsx` files from device storage
4. User can connect to Google Drive safely
5. App creates or reuses one dedicated Drive folder for this app
6. User can save spreadsheets to Google Drive without deleting anything
7. User can reopen spreadsheets from Google Drive
8. Recent files are shown on the home page with source labels
9. Each sheet shows 50 rows by default
10. User can add 50 or 100 more rows on demand
11. Existing shortcuts still work and `Ctrl/Cmd+S` triggers save behavior
12. No destructive Drive operations are present

## Implementation notes

- Prefer incremental, maintainable changes over hacks
- Keep the current spreadsheet editor behavior intact where possible
- Add friendly empty/loading/error states
- If needed, add a small “unsaved changes” indicator
- If a decision is unclear, favor the safest storage behavior

## Deliverables

1. Implement the feature
2. Add any new components/types/utils needed
3. Document required Google Drive setup
4. Summarize what changed
5. Mention any limitations or next steps

## Do not do

- Do not delete any user files
- Do not add Drive delete actions
- Do not rewrite the whole app unnecessarily
- Do not remove existing working shortcuts
- Do not keep the old fixed 200-row UX
