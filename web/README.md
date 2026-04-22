# Excel Clone Web

This web app now includes:

- a Google Sheets-style home page
- local browser draft autosave
- recent files for device and Google Drive
- Google Drive save/open support using one dedicated app folder
- dynamic rows per sheet starting at 50 with `Add 50 rows` and `Add 100 rows`

## Run

```bash
npm install
npm run dev
```

## Google Drive Setup

The Drive integration uses Google Identity Services in the browser and the Google Drive REST API.

Create `web/.env.local` with:

```bash
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
VITE_GOOGLE_DRIVE_FOLDER_NAME=Excel Clone Files
```

Notes:

- `VITE_GOOGLE_CLIENT_ID` is required for Google Drive features
- `VITE_GOOGLE_DRIVE_FOLDER_NAME` is optional; if omitted, the app uses `Excel Clone Files`
- the app only creates, opens, lists, and updates files inside that dedicated folder
- the app does **not** delete Drive files

## Recommended Google Cloud Config

1. Create or use a Google Cloud project.
2. Enable the Google Drive API.
3. Create an OAuth 2.0 Client ID for a web application.
4. Add your local dev origin, for example `http://localhost:5173`, to Authorized JavaScript origins.
5. Put that client ID into `VITE_GOOGLE_CLIENT_ID`.

## Storage Behavior

- `Save` updates the local browser draft only.
- `Save As` downloads a local `.xlsx` copy.
- `Save to Drive` uploads or updates the workbook in the dedicated Google Drive folder.
- `Open from device` imports a local `.xlsx`.
- `Open from Google Drive` uses files from the dedicated app folder.

## Current Limitations

- Recent Google Drive files can be reopened directly.
- Recent device files are remembered in the home screen, but browsers do not let the app silently reopen the original local file later, so the user may need to pick it again.
- Production build currently emits a large bundle warning because `xlsx` is still bundled into the main chunk.
