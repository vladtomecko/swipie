# Swipie

Swipe through head-to-head matchups until a tournament algorithm crowns a winner. The first swipie type is games, with data from [RAWG](https://rawg.io/apidocs).

1. **Import:** search RAWG, paste a list, or upload a file. A sample JSON is available to download. Pick an algorithm.
2. **Swipe:** tap, swipe, or use ← / → to pick, and Z or Backspace to undo. Progress is saved in localStorage.
3. **Results:** the winner, a full ranking and a round-by-round timeline.

## Import formats

- JSON: `{"version":1,"games":[{"name":"Hades"},{"name":"Portal 2","rawgId":4200}]}` or `["Hades","Celeste"]`
- Text: one name per line. Blank lines and `# comments` are ignored.

## Algorithms

- **Dropout:** pairs are shuffled each round, and a game that loses once is out. With an odd count, a random game gets a bye, and never twice in a row.
- **Double elimination:** each round pairs games with the same number of losses, and a game is out after two losses.

## Development

```sh
npm install
npm test          # vitest
VITE_RAWG_KEY=... npm run dev
npm run build
```

Without `VITE_RAWG_KEY`, the app works offline: games are added by name only.

## Deploy (GitHub Pages)

1. Settings → Pages → Source: **GitHub Actions**.
2. Settings → Secrets and variables → Actions: add `RAWG_KEY`. Get a free key at https://rawg.io/apidocs.
3. Push to `main`.
