# Scaffold Stacks feedback

Notes from building Handoff with `stacksdapp` 0.2.2 on Ubuntu (Linux x64), Rust 1.98, Node 24, Clarinet 3.24.1.

**Time to ship:** _fill in_

> Replace the notes below with your own experience. They are here as a starting
> point — the bounty asks for honest feedback, so keep what you actually hit and
> cut what you didn't.

## What worked well

- **`stacksdapp new` to a running app was one command each.** Scaffolding, adding a contract, generating bindings and deploying are each a single step, and `stacksdapp add` wrote the correct `clarity_version` and `epoch` for Clarity 6 without being asked.
- **Codegen keeps up.** After every contract change, `stacksdapp generate` refreshed the hooks and the debug UI, so new functions showed up in the frontend immediately.
- **Transaction lifecycle is handled for you.** The generated hooks poll for confirmation and expose `txStatus` and `explorerUrl`, so the UI could show pending/success/failure without writing any polling code.
- **The debug panel is genuinely useful** for exercising functions before the real UI exists.
- **The bundled agent skill** documents the read-only `cvToValue` pitfall, which is the single most confusing part of the frontend integration.

## Problems, with fixes I'd suggest

1. **`cargo install stacksdapp` fails on a fresh Ubuntu install.** `openssl-sys` needs `pkg-config` and `libssl-dev`, neither of which is in the prerequisites page. Suggest adding `sudo apt install pkg-config libssl-dev`, or switching to `rustls` so no system OpenSSL is needed.
2. **No Linux install path for Clarinet.** The prerequisites page only shows `brew install clarinet`. The Linux binary has to be found on the `stx-labs/clarinet` releases page.
3. **Read-only results lose `ok`/`err`, and optionals nest one level deeper than expected.** `cvToValue` strips the response wrapper, so `(err u100)` arrives looking like ordinary data, and `(some u880)` arrives as `{ type: "(optional uint)", value: { type: "uint", value: "880" } }`. Parsing that as a number gives `NaN`. A frontend unit test caught it; without one it would have shipped as a blank countdown. Suggest returning `{ success, value }` or exposing the raw `ClarityValue` next to `data`.
4. **Hooks can't send post-conditions.** `call(args)` always passes `[]`, and `contracts.ts` hardcodes `postConditionMode: 'allow'`. For a contract that moves other people's money, `call(args, postConditions)` with `deny` mode would be much safer.
5. **Vercel builds default to devnet.** `.env.local` is gitignored and `scaffold.config.ts` falls back to `devnet`, so a deploy without `NEXT_PUBLIC_NETWORK` points the live site at `localhost:3999`. Committing a `frontend/.env.production` fixes it, but the deploy command could write that file, or the docs could warn about it.
6. **`as-max-len?` needs a literal, and the error message is baffling.** Passing a `define-constant` instead of a literal produces `expecting expression of type 'uint', found 'uint'`, which gives no hint about what's wrong.
7. **No `stacksdapp remove`.** Replacing the template `counter` contract meant hand-editing `Clarinet.toml` and deleting two files.
8. **The skill is only auto-discovered by Cursor** (`.cursor/skills/`). Other agents only find it via `AGENTS.md`. A `CLAUDE.md` pointer or a `.claude/skills/` copy would make it automatic.
9. **The frontend has no test setup.** `npm test` runs vitest with `--passWithNoTests` but there is no config, so `@/` imports fail until you add one. Given how easy the `cvToValue` shapes are to get wrong, shipping a working frontend vitest config would encourage people to test that layer.
10. **Smaller items:**
    - `stacksdapp check` surfaces Clarinet's interactive `Overwrite? [Y/n]` prompt for the simnet plan.
    - `npm run typecheck` fails on a fresh project (`Cannot find module '@/public/logo.png'`) until `next build` has generated `next-env.d.ts`.
    - Vitest warns that the clarinet environment uses the deprecated `transformMode`.
