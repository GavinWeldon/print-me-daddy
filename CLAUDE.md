# Print Me Daddy: notes for Claude

Electron + React + TypeScript + Vite (electron-vite) Windows app. Owner is a beginner: explain changes in plain English, work in phases (see README roadmap), stop after each phase for testing, commit at the end of every phase.

## Layout
- `src/main/`: main process (windows, tray, global hotkey, settings JSON in userData, chat state, host personality lines).
- `src/main/print/`: printing. `printers.ts` (list via PowerShell Win32_Printer), `documents.ts` (file kinds, page counts, images → A4 PDF), `runner.ts` (pdf-to-printer/SumatraPDF, page ranges, cancel via Remove-PrintJob), `desk.ts` (job cards: drop → job, update, print, cancel, test page), `testPage.ts`.
- `src/preload/`: the only bridge; exposes `window.pmd` (typed by `PmdApi` in `src/shared/types.ts`).
- `src/renderer/`: React UI. `#quick` hash renders the pop-up quick bar instead of the full window.
- `assets/host/`: swappable host artwork (`idle|thinking|printing|error` + any image extension; missing moods fall back to idle). `assets/brand/logo.webp` is the logo. `assets/icon/` is resized from `art/source/app-icon.webp` by `npm run icons`.

## Look and feel (agreed with the owner)
- Styling comes from the owner's AI-generated mockups in `art/source/`: black + hot pink/magenta/purple neon, crowns and hearts, pink script "Paige" name tag (Pacifico), neon dialog frame with corner brackets, glowing pink pill buttons (crown + chevron).
- Layout: Paige full-body standing large on the left (bleeds off the bottom), logo top-right, chat dialog below it.
- **Use the owner's images exactly as they are.** Don't redraw, recreate or "fix" artwork in code; only resize/convert formats where needed (e.g. icons). Ask the owner for new art instead.
- Known issue in the owner's art: the logo reads "DADDDY" (extra D). Owner decides whether to regenerate it.

## Hard rules
- **No API keys, tokens or credentials anywhere** in code, config, CI or the installer.
- The smart path calls the local `claude` CLI headless and must use **the account signed in on the PC running the app**. Never bundle anything from `~/.claude`, never hardcode user paths, find `claude` on PATH, show the signed-in account in the UI, and fall back to the fast path when it's missing or signed out.
- Host personality: confident, flirty, cheeky, funny, always helpful, never explicit. All lines live in `src/main/host/personality.ts`.
- Nothing tied to one printer brand.

## Gotchas
- Don't use pdf-to-printer's `getPrinters()`/`getDefaultPrinter()`: they crash on some virtual printers (OneNote). Use `src/main/print/printers.ts`.
- SumatraPDF must stay unpacked from the asar (`build.asarUnpack` in package.json).
- Printing logic can be tested without paper by bundling a harness with esbuild (`--external:electron`) and running it with `npx electron`.
- The owner's Desktop and Start menu shortcuts point at `release/win-unpacked/Print Me Daddy.exe` (made with `npm run pack`). After a phase, quit the app from the tray and re-run `npm run pack` so the shortcuts open the latest version. The real installer comes in Phase 7.
- Electron 44 doesn't download its binary on install by itself; the root `postinstall` runs `install-electron`.
- electron-vite 5 supports Vite up to 7, so don't bump Vite to 8 until electron-vite supports it.
