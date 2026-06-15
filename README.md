# Companion

A cozy pixel-art Tamagotchi companion. Draw your own 32×32 pixel creature, name
it, and bring it to life. It bobs around a warm little screen, reacts to your
care, chats back, and can wander "the meadow" among other pixel friends.

## Getting started

```bash
npm install
npm run dev      # start the dev server (Vite)
```

Then open the printed local URL (usually http://localhost:5173).

### Other scripts

```bash
npm run build    # production build into dist/
npm run preview  # serve the production build locally
```

## Project layout

```
companion/
├─ index.html              # app entry HTML
├─ vite.config.js          # Vite + React config
├─ src/
│  ├─ main.jsx             # React entry — mounts <Companion/>
│  ├─ index.css            # base/reset styles
│  ├─ components/
│  │  ├─ Companion.jsx     # main app: draw / live / meadow screens
│  │  └─ HeartIcon.jsx     # reusable heart glyph
│  └─ lib/
│     ├─ constants.js      # palettes, friend names, storage key
│     ├─ random.js         # seeded RNG (mulberry32)
│     ├─ creature.js       # procedural pixel-creature generator
│     ├─ mood.js           # stat clamping + mood derivation
│     └─ storage.js        # best-effort persistence helpers
```

## Chat (Claude API)

The chat in the "live" screen calls the Claude API directly from the browser.
That call needs auth and CORS handling that a bare browser `fetch` won't have on
its own, so chat gracefully falls back to canned replies when the request
fails — the rest of the app works fully offline. To enable real replies, route
the request through a small backend or proxy that attaches your Anthropic API
key (never ship the key in client-side code).
