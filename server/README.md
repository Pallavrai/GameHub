# GameHub multiplayer server

Authoritative WebSocket server for multiplayer Snake. Rules are in `rules.js`, rooms, reconnects and timers in `index.js`, and the global leaderboard in `stats.js`.

```bash
npm install
npm test
PORT=8787 npm start
```

The game page served from `http://localhost` (for example `python3 -m http.server 5173` in `extension/`) connects to `ws://localhost:8787`. Port 8080 on the owner's Mac belongs to another app. Off Cloud Run, the leaderboard lives in memory.

Environment overrides (tests use them): `LOBBY_MS`, `GRACE_MS` (seat kept after a drop, default 20 s), `RANKED_MS` (minimum match length for the global board, default 15 s), and `STATS_COLLECTION` (Firestore collection, default `players`).

## Live service

- GCP project `project-b323005a-fcb3-45ee-b4d` ("My First Project"). Never deploy into `pactsage`.
- Cloud Run service `gamehub-snake` in `asia-south1` (Mumbai): `wss://gamehub-snake-733095730479.asia-south1.run.app`. v1.2.0+ clients use it.
- The `us-central1` service of the same name runs v1.1.0 code for v1.1.0 clients. Delete it once nobody uses 1.1.0:
  `gcloud run services delete gamehub-snake --region us-central1 --project project-b323005a-fcb3-45ee-b4d`
- Firestore `(default)` database (Native, `asia-south1`). Collection `players/{sha256(player key)[0:32]}` holds `{ name, wins, points }`. Composite index on `players`: `wins` desc, `points` desc.
- The runtime service account `733095730479-compute@developer.gserviceaccount.com` has `roles/run.builder` (needed for source deploys) and `roles/datastore.user`.

## Deploy

```bash
gcloud run deploy gamehub-snake --source . --project project-b323005a-fcb3-45ee-b4d --region asia-south1 --allow-unauthenticated --min-instances 0 --max-instances 1 --concurrency 250 --timeout 3600 --memory 512Mi --cpu 1
```

`--max-instances 1` is required because rooms live in memory. A WebSocket stays open for at most `--timeout` (1 h); clients reconnect on their own. A deploy starts a new instance, so rooms open at that moment end.

## Testing a revision live without touching real data

```bash
gcloud run deploy gamehub-snake --source . --project project-b323005a-fcb3-45ee-b4d --region asia-south1 --no-traffic --tag e2e --update-env-vars STATS_COLLECTION=e2e-players,RANKED_MS=0
```

That revision is reachable at the `e2e---…` URL printed by the deploy and writes to `e2e-players`. Cleanup is two steps, in this order. The env vars stay in the service template, and `--no-traffic` pins traffic:

```bash
gcloud run services update gamehub-snake --project project-b323005a-fcb3-45ee-b4d --region asia-south1 --remove-env-vars STATS_COLLECTION,RANKED_MS
gcloud run services update-traffic gamehub-snake --project project-b323005a-fcb3-45ee-b4d --region asia-south1 --to-latest --remove-tags e2e
```
