---
kind: function
id: 01a1ffce-2ea2-7db1-9c84-f1fec56c9a3d
name: publish-plan
gist: "The one place nosedive pushes, deletes a remote ref or moves a ref: a plan verified whole, then ordered per-ref leased pushes and compare-and-swap local changes"
links:
  - kb/01a13354-8942-73b1-be25-3424511ba82c.md:
      rel: parent.feat
---

# Publish plan

Commands plan, then call `commitPlan` once. Planning writes objects only (`fetchExact`, `ownedRange`, `replay`, `stampRange`, `snapshot`, `commitOffside`, `docAt`); no ref, index or file is touched until the commit.

`commitPlan` first verifies every step and changes nothing: each pushed commit is in its update's `publishes` set, a fast-forward update builds on its `old`, each local ref holds its planned old sha and is not checked out in another worktree, HEAD is where the plan found it, and where files follow the index and tree are clean. Then each step runs in order. Its remote updates are individual `git push` calls, each with an exact-sha `--force-with-lease`, in the safe order the planner declares: new refs and work first, deletions next, and the record last. Locally it re-verifies, moves files by `read-tree -m -u`, moves local refs in one `update-ref --stdin` transaction with old values, moves HEAD in its own transaction, then sets the index, drops refs and writes config. `after` steps are local-only by type and runtime check, and run once every main step is done.

It never retries and never undoes a push. A refusal has a kind (`stale`, `dirty`, `boundary`, `failed`), the step, how many whole steps were done before it, git's words, and, after a partial local failure, `state`: where refs, HEAD and files are. A push can stop between refs: that recoverable intermediate state contains only the safe prefix already published, while local state and later refs are untouched. A re-plan sees any ref already at its planned sha as done and continues without republishing it. Commands re-plan from a fresh fetch on `stale`, at most 3 times; the same convergence rule covers both partial steps and partial progress across repositories.

`replay`'s `made` holds only shas commit-tree returned, so a pick that changes nothing never approves an upstream commit. A commit whose clean pick changes nothing, the tip holding its change already, is put in `skipped`, as is a turn conflict recognised as already on the tip (with `turnsIn`): `skipped` is what the home holds already. A conflict is never skipped except as that turn; otherwise `replay` returns `{ conflict }`. Moving HEAD needs git 2.46 or later.

## Code

- Function: [src/i01a1ffce2ea27db19c84f1fec56c9a3d.ts](../src/i01a1ffce2ea27db19c84f1fec56c9a3d.ts)
- Tests: [src/i01a1ffce2ea27db19c84f1fec56c9a3d.test.ts](../src/i01a1ffce2ea27db19c84f1fec56c9a3d.test.ts)
