# Acadex

A polished learning league for schools, available as a web app, local Node.js app, and Windows desktop build. Acadex combines quizzes, XP, leaderboards, profiles, student records, and a school calendar in one responsive interface.

**Live app:** [acadex.acadex.workers.dev](https://acadex.acadex.workers.dev)

## Run locally

Requires **Node.js 24 or later** (SQLite and TypeScript support are included in Node).

```sh
npm ci
npm run dev
```

Open **http://localhost:3000**. On first launch, create your administrator account. There are no default passwords. The admin can add student IDs and phone numbers in **Admin → DB**. Students then use the Student tab to sign in; authorized students get a profile on their first login. Google sign-in has been replaced by local accounts.

Start adding questions in **Admin → Books**, then select a subject and chapter on the Quiz page. No sample records are added automatically. Students receive up to 20 shuffled questions per round. The server awards 1 XP per correct answer and deducts up to 2 XP after 10 consecutive incorrect answers, with a minimum balance of zero. Scores and history are saved as answers arrive; reloading cannot award the same answer twice.

## Build and run

```sh
npm run build
npm start
```

Both the app and its API are served at http://localhost:3000. `npm run preview` also starts the complete built app. The server listens on this computer's loopback interface. To choose another port, set `PORT` in `.env`.

## Web edition

Build a browser-ready server package with:

```sh
npm run web:package
```

The command creates **`release/Acadex-Web-1.0.0.zip`**. Extract it on a computer with Node.js 24 or later, then run `start-web.bat` on Windows or `./start-web.sh` on Linux/macOS. Open `http://localhost:3000` on the host computer. The server also prints a network address that phones and other computers on the same network can open.

The web edition includes the compiled interface and API server, so it does not need `npm install` or Firebase. Its SQLite database is stored in the extracted package's `data` folder. Public internet hosting requires a persistent writable disk and HTTPS; it is not compatible with static-only hosting because authentication and application data are handled by the Node.js server.

## Cloudflare deployment

Acadex also includes a Cloudflare Workers edition. It serves the compiled interface through Workers Static Assets and stores accounts, records, quizzes, and sessions in a strongly consistent SQLite-backed Durable Object. This cloud database is separate from the desktop and downloadable web editions.

```sh
npx wrangler login
npm run cloudflare:deploy
```

The first visit opens the administrator setup screen. Create the administrator immediately and keep its credentials private. Subsequent deployments update the application without replacing its Durable Object data. The manual record tools work normally; optional Gemini document imports are disabled in the Cloudflare Worker until a cloud secret and Worker-compatible AI handler are configured.

- `cloudflare/worker.ts`: Cloudflare API routes and static asset routing.
- `cloudflare/store.ts`: Durable Object SQLite persistence and authorization.
- `wrangler.jsonc`: Worker, asset, and Durable Object configuration.

## Local data and backups

All application data is saved in **`data/acadex.sqlite`**, including accounts, sessions, images, questions, events, and attempts. It persists across browser refreshes and server restarts. Browser storage is not the database. Other browsers on the same computer share the same records and have separate login sessions.

To back up or move the app, **stop the server** and copy the entire `data` folder. Restore that folder before starting the server again. Set `ACADEX_DATA_DIR` in `.env` to use a different data folder. Keep this folder private because it contains student information. Admin passwords are salted and hashed; student login checks the phone number in the admin's student registry.

This edition starts with a new local database. Existing cloud records are not downloaded or migrated automatically.

## Optional AI imports

Manual entry and all core features work without an API key. To enable AI extraction of questions, students, and calendar events, copy `.env.example` to `.env`, set `GEMINI_API_KEY`, and restart the server. AI imports send the selected document to Gemini and require internet access. The key stays on the server and is never included in the browser build. `GEMINI_MODEL` can override the configured model.

## Development

```sh
npm run lint
npm test
```

- `server/store.ts`: SQLite persistence, authentication, permissions, and quiz scoring.
- `server/index.ts`: local HTTP API and development/production serving.
- `server/ai.ts`: optional server-side AI integration.
- `src/lib/local.ts`: browser API client and subscriptions (refresh every 3 seconds).
- `src/components`: existing screens, now connected to the local API.

The API checks permissions on every request. Students cannot edit roles or XP, access the private student registry, or retrieve correct answers before answering a quiz question. Admin changes are transactional, and the last active administrator cannot be deleted, demoted, or banned.
