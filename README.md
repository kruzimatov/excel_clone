# Excel Clone

This repo is split into two active workspaces:

- `web` for the React/Vite spreadsheet client
- `backend` for the Express + PostgreSQL API

## Run

1. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`.
2. Optional: start Postgres with `docker compose up -d postgres`.
3. Run `npm install` at the repo root.
4. Start both apps with `npm run dev`.

The backend auto-creates the `workbooks` table on startup, and the web app uses `/api` to talk to it in development. The Docker Postgres service is published on host port `5433` to avoid conflicts with a local PostgreSQL already using `5432`.

## Docker

To run the frontend, backend, and Postgres together in one Compose stack:

```bash
docker compose up --build
```

That starts:

- the backend on `http://localhost:4000`
- the web app on `http://localhost:5173`
- Postgres on `localhost:5433`

The web container proxies `/api` requests to the backend container over the Docker network, so the browser still talks to the app through the familiar local ports.

## Save integrations

Manual `Save` stores the workbook in Postgres. If these environment variables are set, the backend also syncs the saved workbook to Google Apps Script and sends a CSV export to Telegram:

```bash
APPS_SCRIPT_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
APPS_SCRIPT_SECRET=optional-shared-secret
TELEGRAM_BOT_TOKEN=123456:bot-token
TELEGRAM_CHAT_ID=123456789
```

Autosave stays Postgres-only so Telegram does not get spammed.

Use `docs/apps-script-webhook.js` as the Apps Script web app code. In Apps Script, set the script property
`WORKBOOK_SYNC_SECRET` to the same value as `APPS_SCRIPT_SECRET`. To sync multiple workbooks into a single Google
Sheet (new tabs instead of new files), set `WORKBOOK_TARGET_SPREADSHEET_ID` to an existing spreadsheet ID (or let
the script create one once and then reuse it). Deploy it as a web app and use the `/exec` URL as
`APPS_SCRIPT_WEBHOOK_URL`.

When `AUTH_ENABLED=true`, the web app will prompt for a username/password and store it in `localStorage` so manual
Save clicks can reach the backend.
