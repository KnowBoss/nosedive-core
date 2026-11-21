---
kind: function
id: 01a1ffce-2ea2-7db1-9c84-f1fec56c9a3d
name: publish-plan
gist: "The one place nosedive pushes, deletes a remote ref or moves a ref: a plan of steps carried out after everything is verified, one atomic leased push per repo, then compare-and-swap of the local refs"
links:
  - kb/01a13354-8942-73b1-be25-3424511ba82c.md:
      rel: parent.feat
---

# Publish plan

Commands plan, then call `commitPlan` once. Planning writes objects only (`fetchExact`, `ownedRange`, `replay`, `stampRange`, `snapshot`, `commitOffside`, `docAt`); no ref, index or file is touched until the commit.

`commitPlan` first verifies every step and changes nothing: each pushed commit is in its update's `publishes` set, a fast-forward update builds on its `old`, each local ref holds its planned old sha and is not checked out in another worktree, HEAD is where the plan found it, and where files follow the index and tree are clean. Then each step runs in order: one `git push --atomic` with an exact-sha `--force-with-lease` per ref (a stale lease rejects every ref in the push), then the local refs in one `update-ref --stdin` transaction with old values, HEAD in a transaction of its own (git refuses one that updates HEAD and its referent), files by `read-tree -m -u` only on a clean index and tree, the index, drops and config last. `after` steps are local-only and run once every step is done.

It never retries and never undoes a push. A refusal has a kind (`stale`, `dirty`, `boundary`, `unsupported`, `failed`), the step, how many steps were done before it (`done`, 0 meaning nothing changed anywhere), git's words, and, after a partial local failure, `state`: where refs, HEAD and files are. A command re-plans from a fresh fetch on `stale`, at most 3 times. Cross-repo is not atomic: steps are ordered so a re-plan sees each as already done.

`replay`'s `made` holds only shas commit-tree returned, so a pick that changes nothing never approves an upstream commit. Moving HEAD needs git 2.46 or later.

## Code

- Function: [src/i01a1ffce2ea27db19c84f1fec56c9a3d.ts](../src/i01a1ffce2ea27db19c84f1fec56c9a3d.ts)
- Tests: [src/i01a1ffce2ea27db19c84f1fec56c9a3d.test.ts](../src/i01a1ffce2ea27db19c84f1fec56c9a3d.test.ts)
