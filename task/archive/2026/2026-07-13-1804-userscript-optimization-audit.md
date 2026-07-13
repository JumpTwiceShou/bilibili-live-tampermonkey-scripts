# Bilibili Userscript Optimization Audit

## Scope

- Audit the current Bilibili Live Tampermonkey scripts for correctness, performance, resilience, maintainability, privacy, and security risks.
- Review repository documentation and lightweight validation utilities where they affect the userscripts.
- Produce evidence-backed, prioritized findings with file and line references.

## Exclusions

- No userscript behavior changes unless the user separately requests implementation.
- No public release, push, browser-profile changes, or remote system changes.
- No broad browser compatibility matrix; runtime validation is limited to what is necessary to confirm audit findings.

## Ordered Work

- [x] Read shared and project agent rules.
- [x] Inspect branch, HEAD, upstream, remotes, working tree, repository files, and active tasks.
- [x] Inventory script responsibilities and shared patterns.
- [x] Review all userscripts for correctness, performance, resilience, maintainability, privacy, and security.
- [x] Run focused static/syntax checks and any necessary read-only validation.
- [x] Re-check the scoped diff and staged files.
- [x] Record prioritized findings, residual risks, and final result.
- [x] Archive this task when the audit is complete.

## Acceptance Criteria

- Every material finding cites reproducible evidence and an exact source location.
- Findings are prioritized by impact and likelihood, with concrete remediation guidance.
- The audit distinguishes confirmed defects from optional improvements.
- All current userscripts are covered, and validation limitations are explicit.
- No script source or user-owned work is modified.

## Evidence

- 2026-07-13: Shared rules and repository `AGENTS.md` read in full.
- 2026-07-13: Repository is on `main` at `f145dbb81bf343b67c4c67335ba18fe89421374a`, tracking `origin/main`; working tree was clean before this task record was created.
- 2026-07-13: Six `*.user.js` scripts and one debug utility were identified for review.
- 2026-07-13: No pre-existing active task file was present.
- 2026-07-13: Script inventory confirmed three normal-room enhancements and three mutually exclusive special-page strategies; the two special-layout variants are 1,478 lines each and differ by only eight added/eight removed lines.
- 2026-07-13: All six userscripts and `debug-special-page.mjs` passed `node --check`.
- 2026-07-13: Static control-flow review confirmed whole-document mutation observers in the room-area, redirect, bitrate, and special-layout paths; several callbacks trigger full selector scans or layout application.
- 2026-07-13: Special-layout resize modeling confirmed the previously written inline player width becomes the next `baseVideoWidth`, so a 1920x1080-derived width of 1,999 px remains 1,999 px after shrinking to 1280x720 even though the fresh formula returns 1,187 px.
- 2026-07-13: The two runtime-injected official CSS resources returned HTTP 200 but total 924,764 raw bytes (783,959 + 140,805 bytes).
- 2026-07-13: The unauthenticated laboratory API returned code 0; the follow-list API correctly returned code -101 (not logged in). No credentials or browser state were used.
- 2026-07-13: The repository debug utility was reviewed; it covers one hard-coded keep-list page and snapshot flow, but has no responsive/no-list assertions and lacks guaranteed browser cleanup on failure.
- 2026-07-13: Final scoped-diff check found no userscript or staged changes; only this audit record was untracked before archival.

## Decisions

- Treat the request as a formal, read-only code audit.
- Keep the audit local/private; the public-release remote is out of scope.
- Rank user-visible layout correctness and mutation-driven runtime cost ahead of structural cleanup.
- Treat browser-dependent selector compatibility as residual risk rather than claiming failures without a signed-in manual browser run.

## Blockers

- None.

## Commits

- None planned.

## Device Sync

- Not applicable: no source change or push is planned.

## Final Result

- Confirmed high-priority responsive defect in both special-layout variants: `applyTopLayout` reads the width that the script previously wrote, then takes `Math.max(baseVideoWidth, freshTarget)`, preventing shrink after a narrower resize.
- Confirmed high-priority systemic performance issue: broad document/frame mutation observers remain active on live, frequently mutating DOM trees and repeatedly trigger iframe scans, header-descendant scans, or full layout recalculation.
- Confirmed medium-priority room-area race: an older asynchronous room request can update state after navigation because results are not tied to a request generation or revalidated against the current room ID.
- Confirmed medium-priority requirements mismatch: the special-page return-to-player button is always visible although the documented behavior requires it to appear after scrolling down.
- Confirmed medium-priority load opportunity: both layout variants inject 924,764 raw bytes of external application CSS and eagerly fetch sidebar data before the popup opens, then force-refresh it on every open.
- Confirmed medium-priority bitrate accuracy issue: audio bitrate is retained across sample/video resets and is not cleared when the audio row disappears or stops matching, so stale audio can be subtracted from a later mixed stream.
- Confirmed maintainability debt: the layout variants duplicate almost all 1,478 lines; embedded-frame helpers are unreachable/unused under `@noframes` and the top-frame guard; the manual debug helper does not cover responsive shrink, the no-list variant, or cleanup-on-error.
- Lower-priority hardening: replace mouse-only `div[role=button]` controls with keyboard-capable buttons and validate API-provided navigation URLs before assigning them to anchors or `window.open`.
- No userscript source was changed. No commit, push, public release, browser-profile change, or device sync was performed.
