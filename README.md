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
