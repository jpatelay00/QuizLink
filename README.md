# QuizLink

QuizLink is a study workspace for organizing material, creating flashcards, generating practice quizzes, and reviewing saved attempts. It uses a React/Vite client, a Node.js/Express API, and a SQLite database.

## Sprint 4

Open **Practice** to paste notes or import a text file, then set the question format, count, and difficulty. The workshop presents one question at a time with a progress indicator, bookmarks, and optional hints. **Results** shows the score, submitted answers, correct answers, and explanations for completed quizzes.

## Current features

- Register, sign in, sign out, edit your display name and biography, and change your password. Server-managed sessions survive page reloads.
- Create public or private study sets, change the visibility of your own sets, and add flashcards with front and back text. New sets default to private in the form and API.
- View public sets and your own private sets, and add accessible sets to your favorites.
- Search public study sets by title, topic, subject, or description. Search requires a signed-in account and a query of 1-100 characters.
- Read and post comments on public study sets. Administrators can hide and restore those comments.
- Upload a `.txt` file containing 20–20,000 trimmed characters. The browser limits the selected file to 60,000 bytes. The API checks the UTF-8 byte size of the received text before trimming, saves the size and completed status in `study_files`, and returns the notes to the workshop.
- Generate multiple-choice, fill-in-the-blank, or mixed quizzes from notes or uploaded text at easy, medium, or hard difficulty. Choose 1–20 questions, with at least two for mixed quizzes. A server-side Gemini key enables generation and on-demand hints.
- Submit an answer for every quiz question and review saved attempts, scores, submitted answers, correct answers, and explanations.
- Bookmark questions from your own generated quizzes, view them in **Saved**, and remove bookmarks. Duplicate user/question pairs are prevented.
- Administrators can manage account roles and suspend accounts through the administrator view.

## Remaining work

The Sprint 4 feature list includes plain-text uploads. PDF extraction remains future work.

Generated flashcards appear after quiz submission. Save permanent flashcards in a study set.

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

To give an existing local account admin access, run this from the repository root and enter the account email when prompted. Use the same database as the running app.

```sh
printf "Registered account email: "
read -r quizlink_admin_email
npm --prefix server run promote -- "$quizlink_admin_email"
```

## Verification

GitHub Actions runs the backend tests, client lint, and production build from the lockfiles on pushes to `main` and pull requests. The suite needs no Gemini credential.

```sh
npm --prefix server test
npm --prefix client run lint
npm --prefix client run build
```

The integration suite uses in-memory SQLite and fixed Gemini responses. It covers account and study features, upload metadata, count and format validation, grading and history, hint access and caching, bookmarks, and admin comment moderation. It also checks that SQLite rejects cross-quiz questions and cross-question options in saved answers.

At startup, the database upgrade adds upload metadata and migrates existing answers to composite foreign keys in one transaction. Existing uploads keep their extracted text and record an unknown original size as NULL. A legacy answer with inconsistent references causes the migration to roll back so the database can be inspected before retrying.

On November 9, the Render deployment at commit `4015c5f` passed text import, generation and grading in all three formats, saved results, a hint, and a bookmark. The database release at `8b1df52` passed upload metadata retrieval, mixed quiz generation, grading, and saved review. Comment moderation passed locally with an admin account.

## Hosting

The Sprint 4 demo runs on [Railway](https://quizlink.up.railway.app/). The release includes a startup migration for upload metadata and saved answer relationships.

The root Dockerfile builds the client and serves it with the Express API. The Railway service deploys from `main` and stores SQLite at `/data/quizlink.db` on a persistent volume.

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
