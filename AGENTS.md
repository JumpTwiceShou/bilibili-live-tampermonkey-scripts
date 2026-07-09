# AGENTS.md - bilibili

## Scope

This repository contains Bilibili live Tampermonkey scripts.

## Canonical Paths

- Current Windows repo: `D:\dev\repos\bilibili`
- Current Windows worktrees: `D:\dev\worktrees\bilibili\<branch-name>`
- Windows VM102 repo: `C:\dev\repos\bilibili`
- Windows VM102 worktrees: `C:\dev\worktrees\bilibili\<branch-name>`
- Ubuntu VM101 repo: `~/src/repos/bilibili`
- Ubuntu VM101 worktrees: `~/src/worktrees/bilibili/<branch-name>`
- Old path `E:\Bilibili\BIlibili` is a compatibility junction only.

## Development Rules

- Do not develop directly on `main`.
- Use one branch per task and one worktree per Codex session.
- Current Windows PC is migration control/fallback only; primary development moves to Ubuntu VM101 and Windows VM102.
- Code sync uses Git. Real env values, if added later, must use Infisical.
- Do not commit `.env`, `.env.local`, tokens, private keys, certificates, generated secret caches, browser profiles, cookies, or local bootstrap files.

## Remote Policy

- Public release remote: `origin https://github.com/JumpTwiceShou/bilibili-live-tampermonkey-scripts.git`.
- Existing private remote currently named `legacy-bilibili`: `https://github.com/shoukounan0227/BIlibili.git`.
- Planned development remote name: `sync`, using the private repository after explicit approval/rename.
- Default development push target after Phase 6: private `sync`.
- Release/publish target: public `origin`, only after explicit user approval.
- Do not push to public `origin` for ordinary private development.

## Env Policy

- Infisical project: `dev-secrets` (`cc4ee95f-8c4f-406e-832e-f65cdeb73739`).
- Project path: `/projects/bilibili`.
- Shared path: `/shared/common`.
- Local env output file: `.env.local`, gitignored.
- `sync-all-projects` is remote-to-local only.
- New env keys must be documented in `.env.example` and `docs/env.md`, then written with `push-project-env` dry-run and explicit apply.

## Commands

- Setup: no package manager detected.
- Lint/test/build: not detected at Phase 3.
- Manual validation: load the userscript in a browser/Tampermonkey test profile and verify target Bilibili pages.

## Completion Checks

Before finishing a task, show the diff, confirm no env values are staged, and state whether work is private-only or intended for public release.

## Worktree Details
See `docs/worktree.md` for this project's exact worktree commands. Do not create a worktree or branch until the user confirms the task scope.
