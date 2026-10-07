# GameHub multiplayer server

Authoritative WebSocket server for multiplayer Snake. Rules are in `rules.js`; rooms and timers are in `index.js`.

```bash
npm install
npm test
PORT=8787 npm start
```

The game page served from `http://localhost` (for example `python3 -m http.server 5173` in `extension/`) connects to `ws://localhost:8787`.

## Deploy (GCP Cloud Run, project "My First Project")

```bash
gcloud run deploy gamehub-snake --source . --project project-b323005a-fcb3-45ee-b4d --region us-central1 --allow-unauthenticated --min-instances 0 --max-instances 1 --concurrency 250 --timeout 3600 --memory 256Mi --cpu 1
```

`--max-instances 1` is required because rooms live in memory. A WebSocket can stay open for at most `--timeout` (1 h).
