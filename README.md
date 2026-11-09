# QuizLink

QuizLink is a study workspace for organizing material, creating flashcards, generating practice quizzes, and reviewing saved attempts. It uses a React/Vite client, a Node.js/Express API, and a persistent SQLite database.

## Sprint 4

Open **Practice** to paste notes or import a text file, then set the question format, count, and difficulty. The workshop presents one question at a time with a progress indicator, bookmarks, and optional hints. **Results** shows the score, submitted answers, correct answers, and explanations for completed quizzes.

## Current features

- Register, sign in, sign out, edit your display name and biography, and change your password. Server-managed sessions survive page reloads.
- Create public or private study sets, change the visibility of your own sets, and add flashcards with front and back text. New sets default to private in the form and API.
- View public sets and your own private sets, and add accessible sets to your favorites.
- Search public study sets by title, topic, subject, or description. Search requires a signed-in account and a query of 1-100 characters.
- Read and post comments on public study sets. Administrators can hide and restore those comments.
- Upload a `.txt` file containing 20-20,000 characters. The browser also limits the selected file to 60,000 bytes. The server stores its text and metadata in `study_files`, then returns the text to fill the quiz notes field.
- Generate multiple-choice, fill-in-the-blank, or mixed quizzes from notes or uploaded text at easy, medium, or hard difficulty. Choose 1–20 questions, with at least two for mixed quizzes. A server-side Gemini key enables generation and on-demand hints.
- Submit an answer for every quiz question and review saved attempts, scores, submitted answers, correct answers, and explanations.
- Bookmark questions from your own generated quizzes, view them in **Saved**, and remove bookmarks. Duplicate user/question pairs are prevented.
- Administrators can manage account roles and suspend accounts through the administrator view.

## Design targets not yet implemented

Uploads support plain text. PDF extraction is still a design target.

Open database work includes upload size and processing status, plus database-level checks that tie each answer to the correct question and quiz. Generated flashcards appear after quiz submission. Save permanent flashcards separately in a study set.

## Requirements

- Node.js 24 or newer
- npm
- A Gemini API key for live quiz generation and hints; other account and study features work without one

## Start the application

From the repository root:

```sh
npm --prefix server ci
npm --prefix client ci
npm --prefix client run build
npm --prefix server start
```

Open `http://localhost:5001`. Express serves the built client and API. On first run, it creates `server/data/quizlink.db` and applies `server/schema.sql`. The database file is ignored by Git.

For development, install the dependencies above, then start the server and client in separate terminals:

```sh
npm --prefix server run dev
```

```sh
npm --prefix client run dev
```

Open `http://localhost:5173`. Vite forwards `/api` requests to the Express server on port 5001.

## Configuration

For local configuration, copy `server/.env.example` to `server/.env`. The npm server commands run from the `server` directory and load that file. Both the `.env` file and local database files are ignored by Git.

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Server-side credential for live quiz generation and hints. Never put it in the React client or commit it to Git. |
| `PORT` | API/server port; defaults to `5001`. Update the Vite proxy if you change this during development. |
| `QUIZLINK_DB` | Optional writable SQLite file path. Defaults to `server/data/quizlink.db` locally. |
| `QUIZLINK_SECURE_COOKIES` | Set to `1` for HTTPS hosting; leave unset for local HTTP development. |

No administrator account is created by default. Register an account, then promote that account on the same database using its actual email address:

```sh
npm --prefix server run promote -- your-registered-email
```

## Verification

```sh
npm --prefix server test
npm --prefix client run lint
npm --prefix client run build
```

The integration suite exercises quiz format and count validation, mixed-format scoring and history, cached hints and access checks, private defaults, and administrator comment moderation alongside the existing account and study features. It uses in-memory SQLite and fixed AI responses. Check live Gemini generation and hints separately using your configured key.

## Hosting

The root Dockerfile builds the client and serves it with the Express API. For a free public demo, deploy the Sprint 4 branch as a Docker Web Service on Render Free and use disposable demo data. Render Free resets local SQLite data after spin-down, restart, or redeploy. A Cloudflare Quick Tunnel can also share your local demo over HTTPS while keeping SQLite on your computer.

See [Hosting QuizLink](docs/hosting.md) for setup, persistence options, and demo checks.

## Project layout

```text
client/src/App.jsx              React screens and user interactions
client/src/api.js               Browser API requests
server/api.js                  Express routes, validation, and database operations
server/auth.js                 Password hashing, sessions, roles, and CSRF checks
server/quiz.js                 Gemini requests, response validation, and answer normalization
server/db.js                   SQLite connections and transactions
server/schema.sql              Current table and index definitions
server/test/integration.test.js Backend integration test
docs/hosting.md                Hosting and persistence checks
Dockerfile                     Production image
```
