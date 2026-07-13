# Implement Userscript Audit Optimizations

## Scope

- Implement every confirmed optimization from the 2026-07-13 userscript audit.
- Cover responsive layout correctness, mutation-observer hot paths, asynchronous room state, sidebar loading and accessibility, bitrate accuracy, duplicated layout maintenance, and browser-debug validation.
- Update versions and repository documentation for changed distributable userscripts.

## Exclusions

- No public release or push to a public remote without a separate explicit request.
- No persistent browser-profile, cookie, extension-installation, or account changes.
- Preserve the pre-existing untracked archived audit record.

## Ordered Work

- [x] Re-read current repository state, branch, HEAD, upstream, remotes, active tasks, and existing work.
- [x] Optimize the gift-panel, redirect, room-area, and bitrate scripts.
- [x] Refactor the canonical special-layout script for responsive sizing, bounded observers, lazy sidebar data, local scoped styling, accessibility, and URL hardening.
- [x] Add deterministic generation for the no-list layout variant and regenerate it.
- [x] Improve browser-debug coverage and failure cleanup.
- [x] Update userscript versions and documentation.
- [x] Run focused syntax, generation, static-behavior, and browser validation where available.
- [x] Review scoped diff and staged files.
- [x] Record private/public status, residual risk, final result, and archive this task.

## Acceptance Criteria

- Special-layout width shrinks when the viewport shrinks and is clamped to the usable viewport.
- Live DOM mutation traffic no longer causes unconditional full-document scans or full layout writes.
- Stale room requests cannot overwrite current-room state.
- Return-to-player visibility follows the documented scroll threshold.
- Sidebar CSS is self-contained; sidebar API requests are lazy, cached, parallelized, and failure-aware.
- Bitrate samples cannot subtract audio metadata from a prior video.
- Mouse-only sidebar controls become keyboard-accessible and API-provided URLs are protocol-validated.
- The no-list distributable is generated deterministically from the canonical layout script.
- All changed JavaScript passes syntax checks and focused validations.

## Evidence

- 2026-07-13: Started on `main` at `f145dbb81bf343b67c4c67335ba18fe89421374a`, tracking `origin/main`.
- 2026-07-13: The only pre-existing worktree change is the untracked archived audit record `task/archive/2026/2026-07-13-1804-userscript-optimization-audit.md`; it will be preserved.
- 2026-07-13: The two layout variants differ by only eight added/eight removed lines before implementation.
- 2026-07-13: Gift-panel close fallback now yields to native bubbling state updates and restricts synthetic close targets to interactive controls.
- 2026-07-13: Blanc redirect mutation handling now inspects only changed iframe nodes and stops after a bounded 30-second discovery window.
- 2026-07-13: Room-area requests now use abortable request generations, earlier-timer replacement, periodic freshness checks, targeted header mutation filtering, and reduced social-anchor scans.
- 2026-07-13: Bitrate samples now retain their own audio-rate metadata, reset audio on video replacement, stop the update loop when the stats panel is absent, and filter mutations to stats-related nodes.
- 2026-07-13: The four independently changed userscripts pass `node --check`.
- 2026-07-13: Special-layout sizing now caches natural metrics before style injection, clamps player plus shell to the usable viewport, and coalesces layout work without cancel/requeue starvation.
- 2026-07-13: Special-layout observers are targeted or bounded; sidebar data is lazy, cached for 60 seconds, fetched in parallel, failure-aware, and rendered with protocol-validated URLs.
- 2026-07-13: The sidebar no longer loads approximately 925 KB of versioned external Bilibili CSS; its controls are semantic buttons with dialog, expanded, busy, focus, and Escape behavior.
- 2026-07-13: The no-list distributable is generated from the canonical source; `node scripts/generate-special-layout-no-list.mjs --check` reports it current, and the only source/variant differences are the expected metadata, generated notice, runtime version, and forced mode.
- 2026-07-13: `debug-special-page.mjs` now supports environment overrides, narrow-viewport and return-button assertions, mode/accessibility assertions, and guaranteed browser/context cleanup.
- 2026-07-13: `node scripts/validate-userscripts.mjs` validates all six userscripts, five offline browser fixtures, metadata/runtime versions, generated parity, responsive bounds, and sidebar URL constraints.
- 2026-07-13: In an isolated in-app browser fixture, the keep-list layout measured 1848 px at a 1920 px viewport and shrank to 1208 px at 1280 px; its 1248 px shell preserved the configured 32 px gutter.
- 2026-07-13: The same browser fixture confirmed zero sidebar API calls before opening, two parallel calls on first open, no additional calls on cached reopen, Escape dismissal, threshold-based return-button visibility, return scroll to 40 px, and correct `2.2.0-no-list`/hidden-list behavior. Browser warning/error logs were empty.
- 2026-07-13: The bundled standalone Playwright package could not run the live-page helper because its environment lacks `playwright-core`; no persistent profile or extension configuration was changed. Live Bilibili/Tampermonkey validation remains the residual manual check.
- 2026-07-13: Final validation passed `node scripts/validate-userscripts.mjs` and `git diff --check`. The branch remains `main` at `f145dbb81bf343b67c4c67335ba18fe89421374a`; no files are staged, committed, or pushed.

## Decisions

- Keep `bilibili-live-special-layout.user.js` as the canonical distributable source and generate the no-list variant mechanically.
- Prefer targeted mutation-record inspection and bounded polling over broad hot-path rescans.
- Keep validation local/private unless the user later authorizes release work.
- Keep deterministic offline fixtures for the optimized browser behaviors so future manual or Playwright runs do not depend on account data.

## Blockers

- None.

## Commits

- None.

## Device Sync

- Not required because this work remains uncommitted and unpushed.

## Final Result

- Completed as private local development work. All confirmed audit optimizations are implemented across the six distributable userscripts, documentation and repeatable validation tooling are updated, and the no-list variant is generated deterministically.
- No public release action was taken. The remaining risk is Bilibili-side DOM/API drift that can only be ruled out by loading the changed userscripts in the appropriate real Tampermonkey profile.
