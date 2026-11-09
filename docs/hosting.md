# Hosting QuizLink

The root Dockerfile builds the React client and serves it with the Express API in one Node.js 24 container. The server reads its port from `PORT`. Set `QUIZLINK_SECURE_COOKIES=1` for an HTTPS URL and `GEMINI_API_KEY` on the server for live quiz generation and hints.

## Update the existing Render demo

The existing service is [QuizLink](https://quizlink-r3vl.onrender.com/). To publish a later app change from `main`, select **Manual Deploy → Deploy latest commit**. Confirm the revision in Render, then open the site and check [API health](https://quizlink-r3vl.onrender.com/api/health).

QuizLink migrates older SQLite databases at startup. On a host with persistent storage, take a backup before upgrading. A legacy answer that refers to the wrong quiz or question aborts the upgrade and leaves the old database intact.

## Free public demo on Render

1. Push the Sprint 4 branch to a GitHub repository you can connect to Render.
2. Create a **Web Service** on Render. Select that branch, the **Docker** runtime, and the **Free** instance type. Keep the service root at the repository root and use its Dockerfile.
3. Add `QUIZLINK_SECURE_COOKIES=1` and, for live quiz generation and hints, `GEMINI_API_KEY` as environment variables. Leave `PORT` at Render's supplied value. Set the health check path to `/api/health`.
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

## Presentation demo

Open the [live site](https://quizlink-r3vl.onrender.com/) before class so the free instance has time to start. Sign in to a demo account and create one if the database has reset.

1. In **Practice**, paste the notes below or import them from a `.txt` file.
2. Choose **Mixed**, **Medium**, and **2** questions. Build the quiz.
3. Request a hint, bookmark a question, and answer both questions.
4. Submit the quiz. Open the attempt in **Results** and the bookmark in **Saved**.

```text
Eukaryotic cells keep chromosomes in the nucleus. Ribosomes build proteins.
The cell membrane regulates movement into and out of the cell.
Mitochondria produce ATP for cell activities. Chloroplasts carry out photosynthesis in plants.
Cytoplasm is the material within the cell membrane outside the nucleus.
```

To show the database design, open `server/schema.sql`. If the local demo database is available, list its tables from the repository root:

```sh
sqlite3 -readonly server/data/quizlink-demo.db ".tables"
```

The local demo database uses the same schema as the live service and has its own data. Admin comment moderation was verified locally. Demonstrate it with a local admin account if you need to show that workflow.
