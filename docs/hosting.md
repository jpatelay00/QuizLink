# Hosting QuizLink

QuizLink's Express server serves the built React client and stores application records in SQLite. A hosted instance needs Node.js 24 or newer, HTTPS, and a persistent writable database directory. The root `Dockerfile` builds the client and starts the server in one container.

## Railway deployment

1. Create a Railway service from `jpatelay00/QuizLink` and select the intended branch or commit. Keep the service root at the repository root so Railway uses the root `Dockerfile`.
2. Attach a volume with mount path `/data`. Railway supplies `RAILWAY_VOLUME_MOUNT_PATH`; QuizLink stores `quizlink.db` on that volume unless `QUIZLINK_DB` overrides the path. The server refuses to start in a Railway environment without an attached volume.
3. Set `QUIZLINK_SECURE_COOKIES=1`. Set `GEMINI_API_KEY` on the service only if live quiz generation is needed. Railway supplies `PORT`. Do not commit credentials or put them in the client.
4. Deploy and generate an HTTPS domain through the service's networking settings. Check `/api/health` for `{"status":"ok"}`. This confirms that the server responds; it does not confirm database persistence or Gemini availability.
5. Complete the application and persistence checks below before a demonstration.

Hosting quotas, pricing, and interface labels can change. Review the service's current usage and provider settings before relying on it in class. Provider references: [volumes](https://docs.railway.com/volumes), [Dockerfiles](https://docs.railway.com/builds/dockerfiles), and [public networking](https://docs.railway.com/networking/public-networking).

## Check the deployed application

- Confirm the deployed commit matches the intended Sprint 3 code. A successful repository merge does not by itself confirm that a deployment has updated.
- Register a dedicated demonstration account. Create a public study set and a flashcard, search for the set, and post a comment. Reload and reopen the set to verify the saved data is retrieved.
- Upload a supported `.txt` file and confirm its text appears in quiz notes. PDF upload is not implemented.
- With Gemini configured, generate and complete a quiz. Check the saved attempt and answer review, bookmark a question from your generated quiz, and verify the bookmark after signing in again.
- Redeploy or restart the service and verify the study set, comment, saved attempt, and bookmark still exist. This checks persistent storage beyond a browser session.

## Local build and verification

Use the terminal commands in [the README](../README.md) to install dependencies, build the client, run backend tests and linting, and start the app without an IDE. The automated integration test uses a fixed quiz generator and does not verify live Gemini behavior.

For a hosted class demonstration, supply the deployment URL and a dedicated demo account as required by the assignment. Share only that demo account's credentials; keep personal, GitHub, hosting, and API credentials private.

## Other hosts

A different provider can run the same Dockerfile if it supports Node.js 24, HTTPS, and a persistent writable volume. Set `QUIZLINK_DB` to a file on that volume. Without persistent storage, a new container may start with an empty database. In containers, supply configuration through environment variables; the server's working directory is `/app`.
