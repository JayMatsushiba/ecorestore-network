# Ecorestore Network — React UI (M6)

The presentation layer only — see the repository root `README.md` for the full operational guide (prerequisites, startup sequence, troubleshooting) and `docs/DEMO.md` for the demo walkthrough.

```bash
npm install
npm run dev      # requires the demo API server running: npm run server, from the repo root
npm run build    # production build (tsc -b && vite build)
npm test         # component tests (vitest + testing-library)
```

This app calls `server/` (a thin HTTP layer over the real M1-M5 code) via `VITE_API_BASE_URL` (see `.env.example`) — it holds no signing key and computes nothing scientific or financial itself.
