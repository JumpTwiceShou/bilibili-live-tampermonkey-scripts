# Fix Special-Page Keep-List Regression

## Scope

- Restore the native full-width list layout on special Bilibili live pages.
- Make the keep-list variant default to the collapsed list exactly once per page load.
- Ensure later user-operated list toggles are never overridden by the userscript.
- Add deterministic regression coverage for list width and toggle behavior.

## Exclusions

- No public release, commit, push, or persistent browser-profile changes.
- Preserve all existing local optimization work.

## Ordered Work

- [x] Read shared/project rules and inspect the reported screenshots.
- [x] Confirm the current width and initial-collapse control paths.
- [x] Remove the width cap that changes the native list layout.
- [x] Replace retrying synthetic toggles with a single default-collapse action.
- [x] Extend the browser fixture and regenerate the no-list variant.
- [x] Run focused static and browser interaction validation.
- [x] Review the scoped diff, record the result, and archive this task.

## Acceptance Criteria

- The keep-list handle bar uses the same width as the special-page player shell instead of a 1220 px cap.
- An initially expanded list receives no more than one userscript-generated collapse click.
- An already collapsed list receives no synthetic click.
- After the user expands the list, it stays expanded and no delayed userscript retry toggles it again.
- Generated-source parity, syntax checks, and the focused browser fixture pass.

## Evidence

- 2026-07-13: User screenshots show the native six-column list becoming a narrower five-column layout after the userscript runs.
- 2026-07-13: The current layout code caps `.live-player-handle-bar` at 1220 px independently of the widened player.
- 2026-07-13: The current initial-collapse watcher retries clicks every 600–1000 ms for up to 15 seconds and treats bar height over 90 px as expanded; the site's collapsed one-row state can exceed that height.
- 2026-07-13: Live Chrome DOM inspection confirmed `expand-btn liveexpand` at 585 px when expanded and plain `expand-btn` at 65 px when collapsed; the page was restored to its original expanded state after inspection.
- 2026-07-13: Canonical version advanced to `2.2.1`; the no-list `2.2.1-no-list` variant was regenerated mechanically.
- 2026-07-13: Desktop browser fixture started expanded, received exactly one default-collapse click, then stayed expanded after one user click and a 2.2-second wait; list/player widths both measured 1576 px and the six-column fixture remained intact.
- 2026-07-13: The initially collapsed fixture received zero synthetic clicks; its initialization still completed normally.
- 2026-07-13: At a 1280 px viewport, the settled list/player widths both measured 1208 px, remained inside the 32 px viewport gutter, and default collapse still occurred exactly once.
- 2026-07-13: Browser fixture warning/error logs were empty. The live Bilibili tab met all special-page selectors but exposed no userscript install flag or style node after reload, so the enabled Tampermonkey entry was not injected into that tab during validation.
- 2026-07-13: Final `node scripts/validate-userscripts.mjs`, both focused `node --check` commands, generated parity, and `git diff --check` passed.
- 2026-07-13: Final status review found no staged files; all earlier local optimization work remains preserved.

## Decisions

- Preserve Bilibili's internal list markup and layout; only align its outer bar with the player width.
- Use the toggle button's explicit expanded state, not list height, and complete initialization before dispatching the one permitted synthetic click.

## Blockers

- Live validation of the newly edited `2.2.1` source requires updating/reloading that version in Tampermonkey; browser security policy prevented inspecting the extension options page, and no extension configuration was changed.

## Commits

- None planned.

## Device Sync

- Not required unless the user later requests a commit/push.

## Final Result

- Completed as private local development work. The keep-list variant now aligns the list bar to the player width, defaults to collapsed at most once, respects all later user toggles, and has deterministic desktop/narrow regression coverage.
- No commit, push, public release, or persistent browser-profile change was performed.
