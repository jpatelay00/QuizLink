# QuizLink

QuizLink is a study workspace for organizing material, creating flashcards, generating practice quizzes, and reviewing saved attempts. It uses a React/Vite client, a Node.js/Express API, and a persistent SQLite database.

## Current features

- Register, sign in, sign out, edit your display name and biography, and change your password. Server-managed sessions survive page reloads.
- Create public or private study sets, change the visibility of your own sets, and add flashcards with front and back text. The creation form defaults to private.
- View public sets and your own private sets, and add accessible sets to your favorites.
- Search public study sets by title, topic, subject, or description. Search requires a signed-in account and a query of 1-100 characters.
- Read and post comments on public study sets. Comments must contain 1-2000 characters after trimming.
- Upload a `.txt` file containing 20-20,000 characters. The browser also limits the selected file to 60,000 bytes. The server stores its text and metadata in `study_files`, then returns the text to fill the quiz notes field.
- Generate a multiple-choice quiz from notes or uploaded text at easy, medium, or hard difficulty when a server-side Gemini API key is configured. The generation request asks for five questions with four choices each, explanations, and flashcards.
- Submit an answer for every quiz question and review saved attempts, scores, submitted answers, correct answers, and explanations.
- Bookmark questions from your own generated quizzes, view them in **Saved Questions**, and remove bookmarks. Duplicate user/question pairs are prevented.
- Administrators can manage account roles and suspend accounts through the administrator view.

## Design targets not yet implemented

The current interface does not provide PDF extraction, a hint-request flow, comment moderation, question-type selection, or a question-count control. The project design includes multiple-choice, fill-in-the-blank, and mixed quizzes with a selectable count of 1-20; the current generator requests five multiple-choice questions.

The proposed upload fields `file_size` and `processing_status`, and the proposed composite option/question foreign key, are not in the current SQL schema. Running the application creates the current tables; it does not apply these proposed schema changes. AI-generated flashcards are displayed with a generated quiz and are not automatically inserted into a study set's saved flashcards.

## Requirements

- Node.js 24 or newer
- npm
- A Gemini API key for live quiz generation; other account and study features work without one

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
| `GEMINI_API_KEY` | Server-side credential for live quiz generation. Never put it in the React client or commit it to Git. |
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

The repository's integration test covers registration, sessions, password changes, study-set privacy, flashcards, favorites, quiz persistence, answer history, bookmark creation/listing/removal and duplicate prevention, administrator controls, and foreign-key consistency. It uses an in-memory database and a fixed quiz generator, so it does not call Gemini or verify a live AI response.

## Hosting

Project deployment URL: [quizlink-production.up.railway.app](https://quizlink-production.up.railway.app/).

The root `Dockerfile` builds the React client and starts Express in a Node.js 24 container. SQLite requires persistent writable storage. On Railway, attach a volume at `/data` and set `QUIZLINK_SECURE_COOKIES=1`; add `GEMINI_API_KEY` if live generation is needed. The server refuses to start in a Railway environment without an attached volume.

Confirm that a deployment is running the intended commit before using it for a demo. See [Hosting QuizLink](docs/hosting.md) for setup and persistence checks.

## Project layout

```text
client/src/App.jsx              React screens and user interactions
client/src/api.js               Browser API requests
server/api.js                  Express routes, validation, and database operations
server/auth.js                 Password hashing, sessions, roles, and CSRF checks
server/quiz.js                 Gemini generation request and response validation
server/db.js                   SQLite connections and transactions
server/schema.sql              Current table and index definitions
server/test/integration.test.js Backend integration test
docs/hosting.md                Hosting and persistence checks
Dockerfile                     Production image
```
