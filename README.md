# Print Me Daddy 💋🖨️

A cheeky little Windows app for printing things fast. Open it, tell **Paige** what you want, and it prints.

> "print my CV twice, double-sided"
> "print all mechanics of machines tutorials, in order, with the solution after each one, as one PDF"

Or just drag files onto the window.

## Features

- **Chat to print**: type what you want in plain English.
- **Quick bar from anywhere**: press **Ctrl+Shift+P** (changeable) and a small chat bar pops up over whatever you're doing.
- **Lives in the tray**: close the window and it keeps running quietly. Optional start with Windows.
- **Paige, your host**: confident, cheeky, helpful. Her name and artwork are yours to change.
- **No API keys**: simple requests are understood locally. Harder ones use [Claude Code](https://claude.com/claude-code) if it's installed on *your* PC (see below).

## Smart mode uses your own Claude account

Print Me Daddy contains **no API keys and no accounts**. For tricky requests it runs the `claude` command on the computer it's installed on, which uses **whoever is signed in to Claude Code on that PC**. Nothing is shared with the person who built or gave you the app.

- Don't have Claude Code? The app still works; Paige just handles the simpler requests herself.
- Want smart mode? Install Claude Code, then run `claude auth login` once.

## Swap Paige's artwork

Pictures live in [`assets/host`](assets/host): `idle`, `thinking`, `printing` and `error`, as `.svg`, `.png`, `.gif`, `.webp` or `.jpg` (portrait, 3:4). Replace a file with your own picture (same name), then click back into the app. No code changes needed. Type `/mood thinking` (or `idle`, `printing`, `error`) in the chat to preview each one.

Want a realistic painted Paige? See [docs/paige-art-prompts.md](docs/paige-art-prompts.md) for ready-made image-generator prompts.

## Artwork scripts

The placeholder artwork is drawn by code, so it can be tweaked and regenerated:

```bash
npm run paige    # assets/host/*.svg   (scripts/make-paige.mjs)
npm run logo     # assets/brand/logo.svg (scripts/make-logo.mjs, uses the free Knewave font)
npm run icons    # assets/icon/*.png   (scripts/make-icons.mjs)
```

## Development

You need [Node.js](https://nodejs.org) 22.12 or newer.

```bash
npm install      # first time only; also downloads Electron
npm run dev      # run the app with live reload
npm run typecheck
npm run build
npm run pack      # build a standalone copy in release/win-unpacked (quit the app first)
```

## Roadmap

- [x] 0. Setup check
- [x] 1. Skeleton: chat UI with Paige, tray icon, hotkey, settings
- [ ] 2. Printer selection, drag and drop printing, job cards, test page
- [ ] 3. Folder indexing and the fast path
- [ ] 4. Smart path through Claude Code
- [ ] 5. Merging, ordering, Office files
- [ ] 6. First-run wizard and polish
- [ ] 7. Installer, GitHub release workflow, auto-update

Built with Electron, React, TypeScript and Vite.
