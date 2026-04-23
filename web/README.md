# Excel Clone Web

The web workspace is the spreadsheet client. It now saves workbook sessions through the backend API instead of browser-only draft storage.

## Run

```bash
npm install
npm run dev
```

## Storage Behavior

- `Open from device` imports a local `.xlsx`.
- `Save` writes the current workbook snapshot to Express/Postgres.
- `Save As` downloads a local `.xlsx` export.
- Recent sessions are loaded from the backend on the home screen.

## Development Notes

- Vite proxies `/api` to `http://localhost:4000` by default.
- The backend creates the `workbooks` table automatically.
- Production builds still include a larger `xlsx` bundle because workbook import/export remains client-side.
