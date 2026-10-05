# Hosting QuizLink

QuizLink's Express server serves the built React client and stores accounts, sessions, study sets, and attempts in SQLite. A hosted instance therefore needs both a Node.js 24 runtime and a persistent writable directory. The root `Dockerfile` builds the client and starts the server in one container.

## Railway deployment

1. In Railway, create a project from the GitHub repository `jpatelay00/QuizLink` and select the `main` branch. Keep the service root at the repository root. Railway detects the root `Dockerfile`.
2. Add a volume to that service with mount path `/data`. Railway supplies `RAILWAY_VOLUME_MOUNT_PATH` automatically; QuizLink places `quizlink.db` there. The server refuses to start on Railway without an attached volume, preventing accidental use of temporary storage.
3. Add the service variable `QUIZLINK_SECURE_COOKIES=1`. Add `GEMINI_API_KEY` only if the quiz-generation feature will be demonstrated. Do not put the key in Git or in the client. Railway supplies `PORT` automatically.
4. Deploy the service. In **Settings → Networking → Public Networking**, choose **Generate Domain**. Open the generated HTTPS URL and check `/api/health` for `{"status":"ok"}`.
5. Register a separate demo account. Create a study set and flashcard, log out and back in, then confirm the data remains after a redeploy. This verifies that SQLite is on the volume.

Railway's Free plan currently includes a small volume and monthly usage credit, but service availability depends on those limits. Check the project's usage before relying on it for a class demo. See Railway's [pricing](https://docs.railway.com/pricing/plans), [volume](https://docs.railway.com/volumes), [Dockerfile](https://docs.railway.com/builds/dockerfiles), and [public networking](https://docs.railway.com/networking/public-networking) documentation.

## Sprint report evidence

The Sprint 2 brief allows CODD or another host. If hosted, include the live URL and a **dedicated demo account** in the report's run instructions, as the brief requests. Use a password created only for that demo account; do not share a personal, GitHub, Railway, or API password. Include screenshots of the hosted pages used for the Sprint 2 demonstration. The report should still include the command-line build and run steps from the README.

## Other hosts

A different provider can run the same Dockerfile if it supports Node.js 24, HTTPS, and a persistent volume. Mount the volume and set `QUIZLINK_DB` to a file on it, or provide `RAILWAY_VOLUME_MOUNT_PATH` if using Railway. Hosts with temporary filesystems will lose the SQLite database on restart, so they are unsuitable for demonstrating persistent accounts and sessions.
