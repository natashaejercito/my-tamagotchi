# My Tamagotchi

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

## Idea
- fix text
- train tamagotchi
- update "the meadow" with pixel friends
