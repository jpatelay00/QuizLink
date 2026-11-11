# QuizLink

QuizLink turns course notes into practice quizzes and flashcards. Organize material in study sets, share public sets with other learners, and revisit saved questions and results.

[Live application](https://quizlink.up.railway.app/)

## Features

- **Practice quizzes.** Generate multiple-choice, fill-in-the-blank, or mixed quizzes with easy, medium, or hard difficulty. Choose 1–20 questions, with at least two for mixed quizzes.
- **Study sets.** Organize quizzes and flashcards in sets that default to private. Generate content directly inside a set or save a quiz from Practice. Public sets let other signed-in learners practice the shared material.
- **Flashcards.** Write cards manually or generate 1–20 cards from notes. Select a card to reveal its answer.
- **Review and bookmarks.** Request hints, review scores and explanations, and save individual questions. Open a saved question to practice it again. Each learner's submitted answers and results stay private.
- **Sharing.** Search public sets by title, topic, subject, or description. Favorite sets and discuss them in comments.
- **Accounts and moderation.** Manage your profile and password. Administrators can hide or restore public comments, manage roles, and suspend accounts.

Paste notes or import a `.txt` file containing 20–20,000 trimmed characters, up to 60,000 bytes. Gemini powers quiz generation, flashcard generation, and hints. Provider availability and usage limits can affect these requests.

## Tech stack

React and Vite provide the frontend. A Node.js and Express API handles authentication, Gemini requests, and SQLite persistence.

## Getting started

### Requirements

- Node.js 24 or newer
- npm
- A Gemini API key to use generation and hints

### Installation

```sh
git clone https://github.com/jpatelay00/QuizLink.git
cd QuizLink
npm --prefix server ci
npm --prefix client ci
cp server/.env.example server/.env
```

Add your Gemini key to `GEMINI_API_KEY` in `server/.env`, then build and start the application.

```sh
npm --prefix client run build
npm --prefix server start
```

Open <http://localhost:5001>. Express serves the built frontend and API. The server creates the local SQLite database and applies the schema on startup.

### Development

After installation, run the API and Vite in separate terminals.

```sh
npm --prefix server run dev
```

```sh
npm --prefix client run dev
```

Open <http://localhost:5173>. Vite proxies `/api` requests to the API on port 5001.

## Configuration

The npm server commands load `server/.env`. Git ignores this file and local database files.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server credential for quiz generation, flashcard generation, and hints. Keep it out of frontend code and source control. |
| `PORT` | Server port, defaulting to `5001`. Update the Vite proxy if you change it during development. |
| `QUIZLINK_DB` | SQLite file path. Defaults to `server/data/quizlink.db` locally, or `quizlink.db` inside Railway's mounted volume. |
| `QUIZLINK_SECURE_COOKIES` | Set to `1` when serving over HTTPS. Leave unset for local HTTP development. |

### Administrator access

Register an account first, then run the following from the repository root with the same database configuration as the running server.

```sh
printf "Registered account email: "
read -r quizlink_admin_email
npm --prefix server run promote -- "$quizlink_admin_email"
```

## Testing

```sh
npm --prefix server test
npm --prefix client run lint
npm --prefix client run build
```

The integration tests use in-memory SQLite and controlled Gemini responses. They cover authentication, access controls, study-set generation and sharing, uploads, bookmarks, grading, saved results, and comment moderation. They also check that invalid generation responses preserve stored content and that database constraints reject inconsistent answer relationships.

GitHub Actions runs the tests, lint, and production build on pushes and pull requests to `main`.

## Deployment

The root Dockerfile builds the frontend and serves it with the API in a single Node.js container. Configure environment variables on the host and attach persistent storage for SQLite.

The hosted application runs on Railway with its database at `/data/quizlink.db`. Railway requires a volume, and QuizLink uses `RAILWAY_VOLUME_MOUNT_PATH` to locate it. The health endpoint is `/api/health`.

See the [hosting guide](docs/hosting.md) for deployment instructions.

## Project structure

```text
client/src/          React screens, styles, and browser API client
server/api.js        API routes, validation, and database operations
server/auth.js       Password hashing, sessions, roles, and CSRF checks
server/quiz.js       Gemini generation and response validation
server/db.js         Database initialization and transactions
server/schema.sql    SQLite tables, indexes, and constraints
server/test/         Integration tests
Dockerfile           Production container build
docs/hosting.md      Hosting configuration
```
