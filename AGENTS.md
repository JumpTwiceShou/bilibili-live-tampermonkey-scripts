# AGENTS.md - bilibili

## Startup

Read `~/.codex/SHARED_AGENT_RULES.md` and the active file under `task/` when the work requires one.

## Scope

This repository contains Bilibili live Tampermonkey scripts.

## Canonical Paths

- Current Windows: `D:\dev\repos\bilibili`.
- Windows VM102: `C:\dev\repos\bilibili`.
- Ubuntu VM101: `~/src/repos/bilibili`.
- The old `E:` path is a compatibility junction only.

Direct work on `main` is allowed. Use focused syntax checks and manual browser validation only for affected userscript behavior.

## Remote And Env

- Private development remote: `sync` → `JumpTwiceShou/BIlibili`.
- Public release remote: `origin` → `JumpTwiceShou/bilibili-live-tampermonkey-scripts`.
- Ordinary development pushes to `sync`; `origin` is only for explicitly approved public releases.
- Env paths: `/shared/common` and `/projects/bilibili`; local output is ignored `.env.local`.
- Never commit env values, tokens, keys, certificates, browser profiles, cookies, or bootstrap files.

## Validation

No package-based test/build system is established. Load only the changed userscript in an appropriate browser/Tampermonkey profile when real browser validation is necessary.

## Completion

Check the scoped diff and staged files, state whether work is private or public-release work, update the task, and archive it when complete.
