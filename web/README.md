# Excel Clone Web

This web app now includes:

- a compact home page
- local browser draft autosave
- recent files for device and Apps Script sources
- Apps Script-backed spreadsheet loading
- dynamic rows per sheet starting at 50 with `Add 50 rows` and `Add 100 rows`
- a collapsible top menu area in the editor
- a pinned first spreadsheet row while scrolling

## Run

```bash
npm install
npm run dev
```

## Apps Script Setup

Create `web/.env.local` with:

```bash
VITE_APPS_SCRIPT_URL=your_apps_script_web_app_url
```

The client expects the published Apps Script web app to return JSON. Supported response shapes:

```json
{
  "title": "Ledger",
  "sheets": [
    {
      "name": "Clients",
      "rows": [
        ["Name", "Balance"],
        ["Fuad", 1000]
      ]
    }
  ]
}
```

or:

```json
{
  "workbook": {
    "title": "Ledger",
    "tabs": [
      {
        "title": "Clients",
        "values": [
          ["Name", "Balance"],
          ["Fuad", 1000]
        ]
      }
    ]
  }
}
```

The app also accepts a sheet object with a prebuilt `cells` map.

## Example Apps Script Pattern

Google documents the web app pattern with `doGet()` / `doPost()` and `ContentService.createTextOutput()` for JSON responses:

- [Apps Script web apps](https://developers.google.com/apps-script/guides/web)
- [Apps Script ContentService](https://developers.google.com/apps-script/reference/content/content-service)

## Storage Behavior

- `Save` updates the local browser draft only.
- `Save As` downloads a local `.xlsx` copy.
- `Load storage` fetches workbook data from `VITE_APPS_SCRIPT_URL`.
- `Open from device` imports a local `.xlsx`.

## Current Limitations

- Recent local files reopen directly only on browsers that support persistent file handles.
- On Safari/iPad, recent local files may still ask the user to re-select the file.
- Production build still emits a large bundle warning because `xlsx` remains in the main chunk.
