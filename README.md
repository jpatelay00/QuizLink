# QuizLink

QuizLink is a study workspace for organizing material, making flashcards, building quizzes from notes, and reviewing past attempts. The web client uses React and Vite; the API uses Express and SQLite.

## Features

- Register, sign in, sign out, edit a profile, and change a password
- Create private or public study sets and add persistent flashcards
- Favorite study sets shared by other users
- Generate a quiz from notes with Gemini when a server API key is configured
- Submit quizzes and review saved scores, answers, and explanations
- Manage user roles and account status as an administrator

## Requirements

- Node.js 24 or newer
- npm
- A Gemini API key for quiz generation only; the other features run without one

## Start the application

From the repository root:

```bash
npm --prefix server ci
npm --prefix client ci
npm --prefix client run build
npm --prefix server start
```

Open `http://localhost:5001`. The server serves the built client and creates `server/data/quizlink.db` on first run. It executes `server/schema.sql` automatically. The database file is ignored by Git.

For development with automatic client reload, start the server and client in separate terminals:

```bash
npm --prefix server run dev
npm --prefix client run dev
```

Open `http://localhost:5173` in this mode. Vite forwards `/api` requests to the Express server on port 5001.

## Configuration

Copy `server/.env.example` to `server/.env` to configure the server. Set `GEMINI_API_KEY` there to enable quiz generation. `PORT` changes the API port; `QUIZLINK_DB` changes the SQLite file path. The `.env` file is ignored by Git. For HTTPS deployment, set `QUIZLINK_SECURE_COOKIES=1`.

## Tests

```bash
npm --prefix server test
npm --prefix client run lint
npm --prefix client run build
```

The integration test covers account sessions, study set privacy, flashcards, favorites, quiz persistence, history access, and administrator controls. It uses an in-memory database and does not call Gemini.

## Project layout

```text
client/          React user interface
server/          Express API and authentication
server/schema.sql SQLite table creation script
server/test/     HTTP and database integration test
```

To promote an existing registered account for a local administrator demonstration, run `npm --prefix server run promote -- email@example.com`, then sign in again. No administrator account is created by default.
