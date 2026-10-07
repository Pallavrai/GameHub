// Global leaderboard: most wins, then most points. Multiplayer only; single-player scores never leave the browser.
// Firestore on Cloud Run (K_SERVICE is set there); an in-memory map everywhere else (tests, local dev).
const TOP = 10;
const CACHE_MS = 30_000; // GET /leaderboard is public, so reads come from this cache, not Firestore

let store;
let cache = null;

function memoryStore() {
  const players = new Map();
  return {
    async add(rows) {
      for (const r of rows) {
        const p = players.get(r.id) ?? { wins: 0, points: 0 };
        players.set(r.id, { name: r.name, wins: p.wins + r.win, points: p.points + r.points });
      }
    },
    async top() {
      return [...players].map(([id, p]) => ({ id, ...p })).sort((a, b) => b.wins - a.wins || b.points - a.points).slice(0, TOP);
    },
  };
}

// Needs a composite index on players(wins desc, points desc); see server/README.md.
async function firestoreStore() {
  const { Firestore, FieldValue } = await import('@google-cloud/firestore');
  const db = new Firestore();
  const players = db.collection(process.env.STATS_COLLECTION || 'players'); // a test revision can write elsewhere
  return {
    async add(rows) {
      const batch = db.batch();
      for (const r of rows) {
        batch.set(players.doc(r.id), { name: r.name, wins: FieldValue.increment(r.win), points: FieldValue.increment(r.points) }, { merge: true });
      }
      await batch.commit();
    },
    async top() {
      const snap = await players.orderBy('wins', 'desc').orderBy('points', 'desc').limit(TOP).get();
      return snap.docs.map((d) => ({ id: d.id, name: d.get('name'), wins: d.get('wins'), points: d.get('points') }));
    },
  };
}

// Loaded on first use so a cold start can accept sockets before the Firestore client is ready.
const backend = () => (store ??= process.env.K_SERVICE ? firestoreStore() : Promise.resolve(memoryStore()));

// rows: [{ id: hashed player key, name, points, win: 0|1 }]
export async function recordMatch(rows) {
  if (!rows.length) return;
  await (await backend()).add(rows);
  cache = null;
}

export async function topPlayers() {
  if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), rows: await (await backend()).top() };
  return cache.rows;
}
