# Hosting QuizLink

The root Dockerfile builds the React client and serves it with the Express API in one Node.js 24 container. The server reads its port from `PORT`. Set `QUIZLINK_SECURE_COOKIES=1` for an HTTPS URL and `GEMINI_API_KEY` on the server for live quiz generation and hints.

## Free public demo on Render

1. Push the Sprint 4 branch to a GitHub repository you can connect to Render.
2. Create a **Web Service** on Render. Select that branch, the **Docker** runtime, and the **Free** instance type. Keep the service root at the repository root and use its Dockerfile.
3. Add `QUIZLINK_SECURE_COOKIES=1` and, for live AI, `GEMINI_API_KEY` as environment variables. Leave `PORT` at Render's supplied value. Set the health check path to `/api/health`.
4. Deploy and open `/api/health` on the generated HTTPS URL. Confirm it returns `{"status":"ok"}`, then create a demo account and check the full workflow.

Render Free sleeps after 15 minutes without incoming traffic and clears local files when it sleeps, restarts, or redeploys. This includes SQLite accounts and attempts. Use disposable data, open the app shortly before presenting, and keep a local backup. [Render Free limitations](https://render.com/docs/free) · [Docker on Render](https://render.com/docs/docker)

## Free temporary link with local SQLite

Build QuizLink using the [README](../README.md), then start it from the repository root in one terminal. This command creates a separate file-backed database for the demo:

```sh
QUIZLINK_DB="$PWD/server/data/quizlink-demo.db" QUIZLINK_SECURE_COOKIES=1 npm --prefix server start
```

Install `cloudflared`, then run this in another terminal:

```sh
cloudflared tunnel --url http://localhost:5001
```

Open the printed HTTPS URL and register a dedicated demo account. The URL lasts while the tunnel runs and the computer stays online. The SQLite file stays on the computer. To reuse it after a restart, start QuizLink with the same database path. [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)

## Cloud hosting with persistent SQLite

Oracle Cloud offers Always Free compute and block storage in eligible home regions. If a free VM is available, build and run the Docker image there, mount persistent storage at `/data`, set `QUIZLINK_DB=/data/quizlink.db`, and serve the app over HTTPS. Free capacity varies and Oracle can reclaim idle instances. [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

On Railway, attach a volume at `/data`. QuizLink uses `RAILWAY_VOLUME_MOUNT_PATH` by default on Railway and requires a volume there. [Railway volumes](https://docs.railway.com/volumes)

## Demo checks

- Confirm the deployed revision matches the intended Sprint 4 branch. Verify `/api/health` before opening the site.
- Sign in, import a `.txt` file, choose **Mixed** with two or more questions, generate a quiz, request a hint, submit both answer formats, and reopen the attempt in **Results**.
- Verify new study sets default to private. To show moderation, open a public study set as an admin and hide or restore a comment.
- With persistent storage, restart the app and reopen a saved attempt. For an ephemeral host, be ready to recreate the demo account and data.
