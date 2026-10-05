# QuizLink

QuizLink is a study workspace for organizing material, making flashcards, building quizzes from notes, and reviewing past attempts. It has a React/Vite client, an Express API, and a SQLite database.

## Current features

- Register, sign in, sign out, edit a profile, and change a password. Sessions persist across page reloads.
- Create public or private study sets, change the visibility of your own sets, and add flashcards.
- Signed-in users can view public sets and their own private sets, and favorite accessible sets.
- Generate a five-question multiple-choice quiz from pasted notes at easy, medium, or hard difficulty when a Gemini API key is configured.
- Submit quiz answers and review saved attempts, scores, answers, and explanations.
- Manage student and administrator roles and suspend accounts through the administrator view.

File uploads, question bookmarks, public-set search, comments, and controls for question type and count are planned for later sprints; they are not available in the current app.

## Live application

The deployed app is available at [quizlink-production.up.railway.app](https://quizlink-production.up.railway.app/). Railway runs the root `Dockerfile` and stores the SQLite database on a persistent volume. The quiz generator needs a server-side Gemini API key; account, study-set, and flashcard features work without one.

## Requirements

- Node.js 24 or newer
- npm
- A Gemini API key only if you want to generate quizzes

## Start the application

From the repository root:

```bash
npm --prefix server ci
npm --prefix client ci
npm --prefix client run build
npm --prefix server start
```

Open `http://localhost:5001`. Express serves the built client and creates `server/data/quizlink.db` on first run. It applies `server/schema.sql` automatically. The database file is ignored by Git.

For development with automatic client reload, start the server and client in separate terminals:

```bash
npm --prefix server run dev
npm --prefix client run dev
```

Open `http://localhost:5173` in this mode. Vite forwards `/api` requests to the Express server on port 5001.

## Configuration

Copy `server/.env.example` to `server/.env` to configure the server. Set `GEMINI_API_KEY` there to enable quiz generation. `PORT` changes the API port; `QUIZLINK_DB` changes the SQLite file path. The `.env` file is ignored by Git. For HTTPS deployment, set `QUIZLINK_SECURE_COOKIES=1`. On Railway, attach a volume at `/data` so the database survives redeploys; the server will refuse to start there without a volume.

For cloud hosting with persistent SQLite storage, see [Hosting QuizLink](docs/hosting.md).

## Tests

```bash
npm --prefix server test
npm --prefix client run lint
npm --prefix client run build
```

The integration test covers account sessions, study-set privacy, flashcards, favorites, quiz persistence, history access, and administrator controls. It uses an in-memory database and does not call Gemini.

## Project layout

```text
client/           React interface and Vite configuration
server/           Express API, authentication, and SQLite access
server/schema.sql SQLite table creation script
server/test/      HTTP and database integration test
docs/             Hosting instructions
Dockerfile        Production image for the client and server
```

No administrator account is created by default. The `server/admin.js` script can promote an existing registered account when administrator access is needed for a local demonstration.
