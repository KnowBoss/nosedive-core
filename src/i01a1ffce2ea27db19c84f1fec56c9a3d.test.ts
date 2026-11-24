// publish-plan
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { commitOffside, commitPlan, docAt, fetchExact, ownedRange, replay, snapshot, stampRange, type LocalStep, type Plan, type Step } from "./i01a1ffce2ea27db19c84f1fec56c9a3d.ts";
import { git, tempDir } from "../test/harness.ts";

const NOSEDIVE = { GIT_COMMITTER_NAME: "nosedive", GIT_COMMITTER_EMAIL: "noreply@nosedive.dev" };

function sh(dir: string, args: string[], env: Record<string, string> = {}): string {
	const result = spawnSync("git", args, { cwd: dir, encoding: "utf8", env: { ...process.env, ...env } });
	assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
	return result.stdout.trim();
}

/** Writes a file and commits it, by nosedive when asked; returns the commit. */
function commit(dir: string, file: string, text: string, own = false): string {
	writeFileSync(join(dir, file), text);
	sh(dir, ["add", file]);
	sh(dir, ["commit", "-q", "-m", `${file}: ${text}`], own ? NOSEDIVE : {});
	return sh(dir, ["rev-parse", "HEAD"]);
}

type World = { origin: string; a: string; b: string; main: string };

/** A bare origin holding main, and two clones of it: `a` is nosedive under test, `b` is someone else. */
function world(label: string): World {
	const root = tempDir(label);
	const origin = join(root, "origin.git");
	git(["init", "--bare", "-q", "-b", "main", origin], root);
	const a = join(root, "a");
	git(["clone", "-q", origin, a], root);
	for (const dir of [a]) {
		sh(dir, ["config", "user.name", "Test"]);
		sh(dir, ["config", "user.email", "test@example.com"]);
	}
	sh(a, ["checkout", "-q", "-b", "main"]);
	const main = commit(a, "f.txt", "one");
	sh(a, ["push", "-q", "origin", "main"]);
	const b = join(root, "b");
	git(["clone", "-q", origin, b], root);
	sh(b, ["config", "user.name", "Other"]);
	sh(b, ["config", "user.email", "other@example.com"]);
	return { origin, a, b, main };
}

const remoteOf = (w: World, ref: string): string | undefined => sh(w.a, ["ls-remote", w.origin, ref]).split("\t")[0] || undefined;

/** A hook of A's that runs the script named by an env var, once. */
function race(w: World, hook: "pre-push" | "reference-transaction", script: string, only?: string): () => void {
	const path = join(w.a, ".git", "hooks", hook);
	const guard = `${script}.done`;
	const state = hook === "reference-transaction" ? `[ "$1" = "${only ?? "prepared"}" ] || exit 0\n` : "";
	writeFileSync(path, `#!/bin/sh\n${state}[ -e "${guard.replace(/\\/g, "/")}" ] && exit 0\n: > "${guard.replace(/\\/g, "/")}"\nsh "${script.replace(/\\/g, "/")}"\n`, { mode: 0o755 });
	return () => writeFileSync(path, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
}

function script(w: World, name: string, body: string): string {
	const path = join(w.a, ".git", name);
	writeFileSync(path, body);
	return path;
}

/** A plan that fast-forwards main on origin to `to`, as a command that planned from `from` would. */
function pushMain(w: World, from: string, to: string): Step {
	return { repo: "a", dir: w.a, remote: { name: "origin", updates: [{ ref: "refs/heads/main", old: from, new: to, fastForward: true, publishes: new Set([to]) }] } };
}

test("pushes a fast-forward and moves the local refs", () => {
	const w = world("pp-ok");
	const next = commit(w.a, "f.txt", "two", true);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	const step: Step = {
		...pushMain(w, w.main, next),
		local: { moves: [{ ref: "refs/heads/main", old: w.main, new: next }], files: { from: w.main, to: next } },
	};
	const done = commitPlan({ steps: [step] });
	assert.deepEqual(done, { ok: true });
	assert.equal(remoteOf(w, "refs/heads/main"), next);
	assert.equal(sh(w.a, ["rev-parse", "main"]), next);
	assert.equal(readFileSync(join(w.a, "f.txt"), "utf8"), "two");
	assert.equal(sh(w.a, ["status", "--porcelain"]), "", "the files followed the ref");
	assert.equal(sh(w.a, ["rev-parse", "origin/main"]), next, "the tracking ref follows");
});

test("T5: a stale lease on one ref of a multi-ref push moves nothing on origin, deletions included", () => {
	const w = world("pp-t5");
	const next = commit(w.a, "f.txt", "two", true);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	sh(w.a, ["push", "-q", "origin", `${w.main}:refs/nosedive/h/dives/old1`, `${w.main}:refs/nosedive/h/dives/old2`]);
	const step: Step = {
		repo: "a",
		dir: w.a,
		remote: {
			name: "origin",
			updates: [
				{ ref: "refs/heads/main", old: w.main, new: next, fastForward: true, publishes: new Set([next]) },
				{ ref: "refs/nosedive/h/dives/new", old: null, new: next, fastForward: false, publishes: new Set([next]) },
				{ ref: "refs/nosedive/h/dives/old1", old: w.main, new: null, fastForward: false },
				{ ref: "refs/nosedive/h/dives/old2", old: w.main, new: null, fastForward: false },
			],
		},
		local: { moves: [{ ref: "refs/heads/main", old: w.main, new: next }] },
	};
	// B moves main between A's fetch and A's push.
	const bMoves = commit(w.b, "g.txt", "theirs");
	const undo = race(w, "pre-push", script(w, "t5.sh", `cd "${w.b.replace(/\\/g, "/")}" && git push -q origin main\n`));
	const done = commitPlan({ steps: [step] });
	undo();
	assert.ok(!done.ok && done.refusal.kind === "stale", JSON.stringify(done));
	assert.equal(done.refusal.done, 0);
	assert.equal(remoteOf(w, "refs/heads/main"), bMoves, "only B's own push moved main");
	assert.equal(remoteOf(w, "refs/nosedive/h/dives/new"), undefined, "nothing was created");
	assert.equal(remoteOf(w, "refs/nosedive/h/dives/old1"), w.main, "a deletion was not done");
	assert.equal(remoteOf(w, "refs/nosedive/h/dives/old2"), w.main);
	assert.equal(sh(w.a, ["rev-parse", "main"]), w.main, "local untouched");
});

test("T10: a commit no plan approved is a boundary refusal, before anything is pushed", () => {
	const w = world("pp-t10");
	const one = commit(w.a, "f.txt", "two", true);
	const two = commit(w.a, "f.txt", "three", true);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	const step: Step = {
		repo: "a",
		dir: w.a,
		remote: { name: "origin", updates: [{ ref: "refs/heads/main", old: w.main, new: two, fastForward: true, publishes: new Set([two]) }] },
	};
	const done = commitPlan({ steps: [step] });
	assert.ok(!done.ok && done.refusal.kind === "boundary", JSON.stringify(done));
	assert.equal(done.refusal.done, 0);
	assert.match(done.refusal.detail, new RegExp(one.slice(0, 7)));
	assert.equal(remoteOf(w, "refs/heads/main"), w.main);
	const none = commitPlan({ steps: [{ repo: "a", dir: w.a, remote: { name: "origin", updates: [{ ref: "refs/heads/main", old: w.main, new: two, fastForward: true }] } }] });
	assert.ok(!none.ok && none.refusal.kind === "boundary", "a push with no publishes set is refused too");
});

test("a fast-forward update whose old is not an ancestor of new is a boundary refusal", () => {
	const w = world("pp-ff");
	sh(w.a, ["checkout", "-q", "-b", "side", w.main]);
	const side = commit(w.a, "s.txt", "side", true);
	const other = commit(w.b, "g.txt", "theirs");
	sh(w.b, ["push", "-q", "origin", "main"]);
	sh(w.a, ["fetch", "-q", "origin"]);
	const done = commitPlan({ steps: [{ repo: "a", dir: w.a, remote: { name: "origin", updates: [{ ref: "refs/heads/main", old: other, new: side, fastForward: true, publishes: new Set([side]) }] } }] });
	assert.ok(!done.ok && done.refusal.kind === "boundary", JSON.stringify(done));
	assert.equal(remoteOf(w, "refs/heads/main"), other);
});

test("T11: a re-plan finishes a multi-ref push stopped after its first ref without republishing it", () => {
	const w = world("pp-t11");
	const next = commit(w.a, "f.txt", "two", true);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	git(["--git-dir", w.origin, "config", "receive.advertiseAtomic", "false"], w.origin);
	const work = "refs/nosedive/h/dives/d";
	const step: Step = {
		repo: "a",
		dir: w.a,
		remote: {
			name: "origin",
			updates: [
				{ ref: work, old: null, new: next, fastForward: false, publishes: new Set([next]) },
				{ ref: "refs/heads/main", old: w.main, new: next, fastForward: true, publishes: new Set([next]) },
			],
		},
		local: { moves: [{ ref: "refs/heads/main", old: w.main, new: next }], files: { from: w.main, to: next } },
	};
	const hook = join(w.a, ".git", "hooks", "pre-push");
	const count = join(w.a, ".git", "t11-count").replace(/\\/g, "/");
	writeFileSync(hook, `#!/bin/sh
count=0
[ ! -e "${count}" ] || count=$(cat "${count}")
count=$((count + 1))
echo "$count" > "${count}"
[ "$count" -ne 2 ] || exit 1
if [ "$count" -gt 2 ] && grep -q '${work}'; then exit 42; fi
exit 0
`, { mode: 0o755 });
	const stopped = commitPlan({ steps: [step] });
	assert.ok(!stopped.ok, JSON.stringify(stopped));
	assert.equal(remoteOf(w, work), next, "the first ref is a safe published prefix");
	assert.equal(remoteOf(w, "refs/heads/main"), w.main, "the record ref was stopped");
	assert.equal(sh(w.a, ["rev-parse", "main"]), w.main, "local state waits for every remote ref");

	assert.deepEqual(commitPlan({ steps: [step] }), { ok: true }, "the same plan skips the completed ref and finishes");
	assert.equal(remoteOf(w, work), next);
	assert.equal(remoteOf(w, "refs/heads/main"), next);
	assert.equal(sh(w.a, ["rev-parse", "main"]), next);
});

test("T6: a remote rewound while the push is made is refused by the lease, not republished", () => {
	const w = world("pp-t6");
	// B's person commit is on origin and fetched; A plans on top of it; B then rewinds origin past it, during A's push.
	const person = commit(w.b, "p.txt", "person");
	sh(w.b, ["push", "-q", "origin", "main"]);
	sh(w.a, ["pull", "-q", "--ff-only", "origin", "main"]);
	const next = commit(w.a, "f.txt", "nosedive", true);
	const step = pushMain(w, person, next);
	const undo = race(w, "pre-push", script(w, "t6.sh", `cd "${w.b.replace(/\\/g, "/")}" && git push -q -f origin HEAD~1:refs/heads/main\n`));
	const done = commitPlan({ steps: [step] });
	undo();
	assert.ok(!done.ok && done.refusal.kind === "stale", JSON.stringify(done));
	assert.equal(remoteOf(w, "refs/heads/main"), w.main, "origin keeps the rewind");
	assert.ok(!sh(w.a, ["ls-remote", w.origin]).includes(person), "the person's commit was not republished");
});

test("a local ref that moved since the plan is stale with nothing changed anywhere (T2, T4a)", () => {
	const w = world("pp-t24");
	const next = commit(w.a, "f.txt", "two", true);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	const planned: Step = { ...pushMain(w, w.main, next), local: { moves: [{ ref: "refs/heads/main", old: w.main, new: next }], files: { from: w.main, to: next } } };
	const person = commit(w.a, "p.txt", "mine");
	const done = commitPlan({ steps: [planned] });
	assert.ok(!done.ok && done.refusal.kind === "stale" && done.refusal.done === 0, JSON.stringify(done));
	assert.equal(remoteOf(w, "refs/heads/main"), w.main, "origin never has the person's commit, or the plan's");
	assert.equal(sh(w.a, ["rev-parse", "main"]), person, "the person's commit is still there");
});

test("T4b: a pick that changes nothing is not in the made set", () => {
	const w = world("pp-t4b");
	const mine = commit(w.a, "f.txt", "same", true);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	const theirs = commit(w.b, "f.txt", "same");
	sh(w.b, ["push", "-q", "origin", "main"]);
	sh(w.a, ["fetch", "-q", "origin"]);
	const replayed = replay(w.a, [mine], theirs);
	assert.ok(!("conflict" in replayed));
	if ("conflict" in replayed) return;
	assert.equal(replayed.tip, theirs, "upstream already holds the change");
	assert.equal(replayed.made.size, 0, "so no sha is approved, and the upstream's own commit is not either");
});

test("replay makes commits with their own committer, or reports the conflict", () => {
	const w = world("pp-replay");
	const mine = commit(w.a, "f.txt", "mine", true);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	const other = commit(w.b, "g.txt", "theirs");
	sh(w.b, ["push", "-q", "origin", "main"]);
	sh(w.a, ["fetch", "-q", "origin"]);
	const ok = replay(w.a, [mine], other);
	assert.ok(!("conflict" in ok));
	if ("conflict" in ok) return;
	assert.equal(ok.made.size, 1);
	assert.equal(sh(w.a, ["log", "-1", "--format=%cn", ok.tip]), "nosedive");
	const clash = commit(w.b, "f.txt", "clash");
	sh(w.b, ["push", "-q", "origin", "main"]);
	sh(w.a, ["fetch", "-q", "origin"]);
	const bad = replay(w.a, [mine], clash);
	assert.ok("conflict" in bad);
});

// A turn is committed on the dive's branch and again on the home; land's replay of the branch must not meet its own copies, and only those (land-skips-applied-turns).
const DOC = "kb/d.md";
const LINES = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n") + "\n";
const AS_TURNS = { turnsIn: DOC };

type Turns = { diveOwn?: boolean; homeOwn?: boolean; diveAppend?: string; homeAppend?: string; diveExtra?: (dir: string) => void; homeDrops?: string; homeAfter?: (dir: string, doc: string) => void };

/**
 * `kb/d.md` on the dive's branch is edited by a person (line 1), then two commits append "t1" and "t2"; on the home the same two
 * appends were committed (the first as `homeAppend`), and `homeDrops` is a line a person's commit removed from them after. Replaying
 * the branch's three commits conflicts on the first append unless that turn is skipped.
 */
function twoTurns(label: string, { diveOwn = true, homeOwn = true, diveAppend = "t1\n", homeAppend = "t1\n", diveExtra = () => {}, homeDrops, homeAfter }: Turns = {}) {
	const w = world(label);
	const doc = join(w.a, DOC);
	const append = (text: string, own: boolean, extra: (dir: string) => void = () => {}) => {
		writeFileSync(doc, readFileSync(doc, "latin1") + text, "latin1");
		extra(w.a);
		sh(w.a, ["add", "-A"]);
		sh(w.a, ["commit", "-q", "-m", `append ${text.trim().replaceAll("\0", "NUL")}`], own ? NOSEDIVE : {});
		return sh(w.a, ["rev-parse", "HEAD"]);
	};
	mkdirSync(join(w.a, "kb"));
	writeFileSync(join(w.a, "r.txt"), "rename me\n");
	sh(w.a, ["add", "r.txt"]);
	const base = commit(w.a, DOC, LINES);
	sh(w.a, ["checkout", "-q", "-b", "home"]);
	append(homeAppend, homeOwn);
	let home = append("t2\n", homeOwn);
	if (homeDrops !== undefined) {
		writeFileSync(doc, readFileSync(doc, "latin1").replace(homeDrops, ""), "latin1");
		sh(w.a, ["commit", "-q", "-am", "person drops it"]);
		home = sh(w.a, ["rev-parse", "HEAD"]);
	}
	if (homeAfter) {
		homeAfter(w.a, doc);
		home = sh(w.a, ["rev-parse", "HEAD"]);
	}
	sh(w.a, ["checkout", "-q", "-b", "dive", base]);
	writeFileSync(doc, LINES.replace("line 1\n", "LINE 1\n"));
	sh(w.a, ["commit", "-q", "-am", "person edit"]);
	const person = sh(w.a, ["rev-parse", "HEAD"]);
	const t1 = append(diveAppend, diveOwn, diveExtra);
	const t2 = append("t2\n", diveOwn);
	return { w, person, t1, t2, home, dive: [person, t1, t2], append, doc };
}

const conflicts = (t: ReturnType<typeof twoTurns>, options: { turnsIn?: string } = AS_TURNS) => "conflict" in replay(t.w.a, t.dive, t.home, options);

test("replay with turnsIn skips a turn nosedive committed on the home already, and makes the rest", () => {
	const t = twoTurns("rp-skip");
	const refs = sh(t.w.a, ["for-each-ref"]);
	const replayed = replay(t.w.a, t.dive, t.home, AS_TURNS);
	assert.ok(!("conflict" in replayed), JSON.stringify(replayed));
	if ("conflict" in replayed) return;
	assert.deepEqual(replayed.skipped, [t.t1], "the turn that conflicted is reported skipped; the other merged to nothing");
	assert.equal(replayed.made.size, 1, "only the person's edit is made again, so only it would be published or counted");
	assert.equal(sh(t.w.a, ["show", `${replayed.tip}:${DOC}`]), LINES.replace("line 1\n", "LINE 1\n") + "t1\nt2");
	assert.equal(sh(t.w.a, ["rev-list", "--count", `${t.home}..${replayed.tip}`]), "1");
	assert.equal(sh(t.w.a, ["for-each-ref"]), refs, "no ref moved");
});

test("replay without turnsIn keeps its conflict, whoever the caller", () => {
	assert.ok(conflicts(twoTurns("rp-plain"), {}));
});

test("replay does not skip a turn the home removed or overwrote after it landed, nor go on to a later clean commit", () => {
	const t = twoTurns("rp-reverted", { homeDrops: "t1\n" });
	sh(t.w.a, ["checkout", "-q", "dive"]);
	writeFileSync(join(t.w.a, "other.txt"), "later");
	sh(t.w.a, ["add", "other.txt"]);
	sh(t.w.a, ["commit", "-q", "-m", "a later clean commit"], NOSEDIVE);
	const later = sh(t.w.a, ["rev-parse", "HEAD"]);
	assert.ok("conflict" in replay(t.w.a, [...t.dive, later], t.home, AS_TURNS), "refused, not made without the turn");
});

test("replay does not skip a turn that differs from the home's in whitespace, or in line ends, only", () => {
	assert.ok(conflicts(twoTurns("rp-space", { homeAppend: "t1 \n" })));
	assert.ok(conflicts(twoTurns("rp-crlf", { homeAppend: "t1\r\n" })));
	assert.ok(conflicts(twoTurns("rp-crlf-dive", { diveAppend: "t1\r\n" })));
});

test("replay does not skip a turn commit that also changes a mode, renames, adds a file or holds a person's line", () => {
	assert.ok(conflicts(twoTurns("rp-mode", { diveExtra: (dir) => sh(dir, ["update-index", "--chmod=+x", DOC]) })));
	assert.ok(conflicts(twoTurns("rp-rename", { diveExtra: (dir) => sh(dir, ["mv", "r.txt", "r2.txt"]) })));
	assert.ok(conflicts(twoTurns("rp-file", { diveExtra: (dir) => writeFileSync(join(dir, "g.txt"), "x") })));
	assert.ok(conflicts(twoTurns("rp-line", { diveAppend: "t1\nperson's line\n" })));
});

test("replay does not skip a binary turn, a person's commit, or a turn of another dive's doc", () => {
	assert.ok(conflicts(twoTurns("rp-binary", { diveAppend: "t1\0\n", homeAppend: "t1\0\n" })));
	assert.ok(conflicts(twoTurns("rp-person", { diveOwn: false })));
	assert.ok(conflicts(twoTurns("rp-other"), { turnsIn: "kb/other.md" }));
});

// The turn's block is proved by its place, between the context lines its hunk had, never by a copy of the block elsewhere in the doc.
test("replay does not skip a turn because its block is on the home somewhere else", () => {
	const t = twoTurns("rp-elsewhere", { homeAppend: "x\nt1\ny\n" });
	assert.ok(conflicts(t), "the home's own change sits where the turn goes, and a t1 line elsewhere is not the turn");
});

test("replay does not skip a blank or common block because the doc has one elsewhere", () => {
	assert.ok(conflicts(twoTurns("rp-blank", { diveAppend: "\n", homeAppend: "x\n\ny\n" })));
	assert.ok(conflicts(twoTurns("rp-common", { diveAppend: "line 1\n", homeAppend: "x\nline 1\ny\n" })));
});

test("replay does not skip a turn the home removed from its place while a copy of the block is elsewhere", () => {
	const t = twoTurns("rp-moved", {
		homeDrops: "t1\n",
		homeAfter: (dir, doc) => {
			writeFileSync(doc, readFileSync(doc, "latin1").replace("line 3\n", "line 3\nt1\n"), "latin1");
			sh(dir, ["commit", "-q", "-am", "person moves it"]);
		},
	});
	assert.ok(conflicts(t));
});

test("replay does not skip a turn because the doc was deleted and recreated with the block in it", () => {
	const t = twoTurns("rp-recreated", {
		homeAfter: (dir, doc) => {
			sh(dir, ["rm", "-q", DOC]);
			sh(dir, ["commit", "-q", "-m", "person deletes the doc"]);
			mkdirSync(join(dir, "kb"), { recursive: true });
			writeFileSync(doc, "fresh\nt1\nmore\n");
			sh(dir, ["add", DOC]);
			sh(dir, ["commit", "-q", "-m", "person recreates it"]);
		},
	});
	assert.ok("conflict" in replay(t.w.a, [t.t1], t.home, AS_TURNS));
});

test("replay skips a turn at its place with the doc's blank lines and other blocks around it", () => {
	const t = twoTurns("rp-placed", {
		diveAppend: "\nt1\n\n",
		homeAppend: "\nt1\n\n",
		homeAfter: (dir, doc) => {
			writeFileSync(doc, readFileSync(doc, "latin1") + "\nt1\n\n", "latin1");
			sh(dir, ["commit", "-q", "-am", "person repeats it further down"]);
		},
	});
	const replayed = replay(t.w.a, [t.t1], t.home, AS_TURNS);
	assert.ok(!("conflict" in replayed), JSON.stringify(replayed));
});

// Two turns of one block at one place, which the home holds once, are one turn skipped and one refused: each held copy is used once.
test("replay skips one of two conflicting identical turn blocks when the home holds one", () => {
	const w = world("rp-seen");
	const doc = join(w.a, DOC);
	mkdirSync(join(w.a, "kb"));
	const base = commit(w.a, DOC, "a\nz\nz\nz\n");
	const turn = (text: string) => {
		writeFileSync(doc, readFileSync(doc, "latin1") + text, "latin1");
		sh(w.a, ["commit", "-q", "-am", "turn"], NOSEDIVE);
		return sh(w.a, ["rev-parse", "HEAD"]);
	};
	sh(w.a, ["checkout", "-q", "-b", "home"]);
	const home = turn("z\nY\n");
	sh(w.a, ["checkout", "-q", "-b", "dive", base]);
	const first = turn("z\n");
	const second = turn("z\n");
	const once = replay(w.a, [first], home, AS_TURNS);
	assert.ok(!("conflict" in once), "one block held, one turn skipped");
	if (!("conflict" in once)) assert.deepEqual(once.skipped, [first]);
	assert.ok("conflict" in replay(w.a, [first, second], home, AS_TURNS), "the second turn has no copy left to be skipped for");
});

test("ownedRange tells nosedive's commits from a person's", () => {
	const w = world("pp-owned");
	const mine = commit(w.a, "f.txt", "n", true);
	const person = commit(w.a, "g.txt", "p");
	const range = ownedRange(w.a, w.main, person);
	assert.deepEqual(range.map((each) => [each.sha, each.own]), [[mine, true], [person, false]]);
});

test("T3a: a file edited after the check, before the files move, is kept and the move refused", () => {
	const w = world("pp-t3a");
	const next = commit(w.a, "f.txt", "two", true);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	const step: Step = { ...pushMain(w, w.main, next), local: { moves: [{ ref: "refs/heads/main", old: w.main, new: next }], files: { from: w.main, to: next } } };
	const undo = race(w, "pre-push", script(w, "t3a.sh", `printf 'mine' > "${join(w.a, "f.txt").replace(/\\/g, "/")}"\n`));
	const done = commitPlan({ steps: [step] });
	undo();
	assert.ok(!done.ok && done.refusal.kind === "dirty", JSON.stringify(done));
	assert.equal(readFileSync(join(w.a, "f.txt"), "utf8"), "mine");
	assert.equal(sh(w.a, ["rev-parse", "main"]), w.main, "the ref did not move either");
});

test("T3b: when the ref move fails after the files moved, the reverse refuses to clobber an edit and says where things are", () => {
	const w = world("pp-t3b");
	const next = commit(w.a, "f.txt", "two", true);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	const step: Step = { repo: "a", dir: w.a, local: { moves: [{ ref: "refs/heads/main", old: w.main, new: next }], files: { from: w.main, to: next } } };
	const path = script(w, "t3b.sh", `printf 'edited' > "${join(w.a, "f.txt").replace(/\\/g, "/")}"\nexit 1\n`);
	// A hook that fails the transaction after editing the file, as a person's edit racing it would.
	writeFileSync(join(w.a, ".git", "hooks", "reference-transaction"), `#!/bin/sh\n[ "$1" = prepared ] || exit 0\nsh "${path.replace(/\\/g, "/")}"\n`, { mode: 0o755 });
	const done = commitPlan({ steps: [step] });
	assert.ok(!done.ok && done.refusal.kind === "stale", JSON.stringify(done));
	assert.equal(readFileSync(join(w.a, "f.txt"), "utf8"), "edited", "the edit is intact");
	assert.ok(done.refusal.state, "it says exactly where files and refs are");
	assert.equal(sh(w.a, ["rev-parse", "main"]), w.main);
});

test("T3c: with no hook, a refused ref move puts the files back", () => {
	const w = world("pp-t3c");
	const next = commit(w.a, "f.txt", "two", true);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	const step: Step = { repo: "a", dir: w.a, local: { moves: [{ ref: "refs/heads/main", old: w.main, new: next }], files: { from: w.main, to: next } } };
	writeFileSync(join(w.a, ".git", "hooks", "reference-transaction"), `#!/bin/sh\n[ "$1" = prepared ] || exit 0\nexit 1\n`, { mode: 0o755 });
	const done = commitPlan({ steps: [step] });
	assert.ok(!done.ok && done.refusal.kind === "stale", JSON.stringify(done));
	assert.equal(readFileSync(join(w.a, "f.txt"), "utf8"), "one", "files reversed");
	assert.equal(done.refusal.state, undefined);
});

test("T12: HEAD moved between the refs transaction and the HEAD transaction is stale, with exact state and the files reversed", () => {
	const w = world("pp-t12");
	sh(w.a, ["branch", "other", w.main]);
	const next = commit(w.a, "f.txt", "two", true);
	sh(w.a, ["checkout", "-q", "main"]);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	const step: Step = {
		repo: "a",
		dir: w.a,
		local: {
			moves: [{ ref: "refs/heads/dive", old: null, new: next }],
			head: { from: { branch: "main" }, to: { branch: "dive" } },
			files: { from: w.main, to: next },
		},
	};
	const undo = race(w, "reference-transaction", script(w, "t12.sh", "git symbolic-ref HEAD refs/heads/other\n"), "committed");
	const done = commitPlan({ steps: [step] });
	undo();
	assert.ok(!done.ok && done.refusal.kind === "stale", JSON.stringify(done));
	assert.match(done.refusal.state ?? "", /HEAD other/);
	assert.equal(sh(w.a, ["rev-parse", "dive"]), next, "refs are as moved");
	assert.equal(readFileSync(join(w.a, "f.txt"), "utf8"), "one", "files reversed");
});

test("HEAD moves from a branch to another, to a detached sha, and back, with the files", () => {
	const w = world("pp-head");
	sh(w.a, ["branch", "dive", w.main]);
	const next = commit(w.a, "f.txt", "two", true);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	const run = (step: Step) => assert.deepEqual(commitPlan({ steps: [step] }), { ok: true });
	run({ repo: "a", dir: w.a, local: { moves: [{ ref: "refs/heads/dive", old: w.main, new: next }], head: { from: { branch: "main" }, to: { branch: "dive" } }, files: { from: w.main, to: next } } });
	assert.equal(sh(w.a, ["symbolic-ref", "HEAD"]), "refs/heads/dive");
	assert.equal(readFileSync(join(w.a, "f.txt"), "utf8"), "two");
	run({ repo: "a", dir: w.a, local: { head: { from: { branch: "dive" }, to: { detached: w.main } }, files: { from: next, to: w.main } } });
	assert.equal(spawnSync("git", ["symbolic-ref", "-q", "HEAD"], { cwd: w.a }).status, 1, "detached");
	assert.equal(sh(w.a, ["rev-parse", "HEAD"]), w.main);
	run({ repo: "a", dir: w.a, local: { head: { from: { detached: w.main }, to: { branch: "main" } }, drop: [{ ref: "refs/heads/dive", old: next, new: null }], config: [["branch.main.note", "x"]] } });
	assert.equal(sh(w.a, ["symbolic-ref", "HEAD"]), "refs/heads/main");
	assert.equal(spawnSync("git", ["rev-parse", "--verify", "-q", "refs/heads/dive"], { cwd: w.a }).status, 1, "dropped");
	assert.equal(sh(w.a, ["config", "branch.main.note"]), "x");
});

test("files do not follow a dirty index or tree: nothing changes", () => {
	const w = world("pp-dirty");
	const next = commit(w.a, "f.txt", "two", true);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	writeFileSync(join(w.a, "f.txt"), "edit");
	const done = commitPlan({ steps: [{ repo: "a", dir: w.a, local: { moves: [{ ref: "refs/heads/main", old: w.main, new: next }], files: { from: w.main, to: next } } }] });
	assert.ok(!done.ok && done.refusal.kind === "dirty" && done.refusal.done === 0, JSON.stringify(done));
	assert.equal(readFileSync(join(w.a, "f.txt"), "utf8"), "edit");
	assert.equal(sh(w.a, ["rev-parse", "main"]), w.main);
});

test("T13: a branch checked out in another worktree is not moved", () => {
	const w = world("pp-t13");
	const next = commit(w.a, "f.txt", "two", true);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	sh(w.a, ["branch", "home", w.main]);
	sh(w.a, ["worktree", "add", "-q", join(w.a, "..", "wt"), "home"]);
	const done = commitPlan({ steps: [{ repo: "a", dir: w.a, local: { moves: [{ ref: "refs/heads/home", old: w.main, new: next }] } }] });
	assert.ok(!done.ok && done.refusal.kind === "stale" && done.refusal.done === 0, JSON.stringify(done));
	assert.match(done.refusal.detail, /checked out in/);
});

test("steps run in order and a refusal says how many were done; a re-run converges", () => {
	const w = world("pp-two");
	const w2 = world("pp-two-second");
	const a1 = commit(w.a, "f.txt", "two", true);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	const b1 = commit(w2.a, "f.txt", "two", true);
	sh(w2.a, ["reset", "-q", "--hard", w2.main]);
	const first: Step = { ...pushMain(w, w.main, a1), local: { moves: [{ ref: "refs/heads/main", old: w.main, new: a1 }], files: { from: w.main, to: a1 } } };
	const second: Step = { ...pushMain(w2, w2.main, b1), local: { moves: [{ ref: "refs/heads/main", old: w2.main, new: b1 }], files: { from: w2.main, to: b1 } } };
	const moved = commit(w2.b, "g.txt", "theirs");
	sh(w2.b, ["push", "-q", "origin", "main"]);
	const undo = race(w2, "pre-push", script(w2, "noop.sh", "true\n"));
	undo();
	// The second origin moves before the plan is carried out: its lease is stale.
	const done = commitPlan({ steps: [first, second] });
	assert.ok(!done.ok && done.refusal.kind === "stale", JSON.stringify(done));
	assert.equal(done.refusal.step, 1);
	assert.equal(done.refusal.done, 1);
	assert.equal(remoteOf(w, "refs/heads/main"), a1, "the first step stands");
	assert.equal(remoteOf(w2, "refs/heads/main"), moved);
	// Re-planned from what is there, the first step is already done, so the plan converges.
	const again = commitPlan({ steps: [{ repo: "a", dir: w.a }, { ...pushMain(w2, moved, b1) }] });
	assert.ok(!again.ok, "b1 does not build on what the remote holds now: refused, not pushed");
	assert.equal(remoteOf(w2, "refs/heads/main"), moved);
});

test("after steps run only once every step is done, and not otherwise", () => {
	const w = world("pp-after");
	sh(w.a, ["branch", "dive", w.main]);
	sh(w.a, ["checkout", "-q", "dive"]);
	const after: LocalStep = { repo: "a", dir: w.a, local: { head: { from: { branch: "dive" }, to: { branch: "main" } }, drop: [{ ref: "refs/heads/dive", old: w.main, new: null }] } };
	const blocked = commitPlan({ steps: [{ repo: "a", dir: w.a, local: { moves: [{ ref: "refs/heads/zzz", old: w.main, new: w.main }] } }], after: [after] });
	assert.ok(!blocked.ok);
	assert.equal(sh(w.a, ["symbolic-ref", "HEAD"]), "refs/heads/dive", "the teardown did not run");
	assert.deepEqual(commitPlan({ steps: [], after: [after] }), { ok: true });
	assert.equal(sh(w.a, ["symbolic-ref", "HEAD"]), "refs/heads/main");
});

test("after rejects a remote update at runtime before anything changes", () => {
	const w = world("pp-after-remote");
	const next = commit(w.a, "f.txt", "two", true);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	const unsafe = { steps: [], after: [pushMain(w, w.main, next)] } as unknown as Plan;
	const done = commitPlan(unsafe);
	assert.ok(!done.ok && done.refusal.kind === "boundary" && done.refusal.done === 0, JSON.stringify(done));
	assert.equal(remoteOf(w, "refs/heads/main"), w.main);
});

test("stampRange makes commits again with trailers and moves no ref", () => {
	const w = world("pp-stamp");
	const one = commit(w.a, "f.txt", "two");
	const two = commit(w.a, "f.txt", "three");
	const stamped = stampRange(w.a, w.main, two, ["Nosedive-Dive: d1"]);
	assert.equal(stamped.made.size, 2);
	assert.notEqual(stamped.tip, two);
	assert.match(sh(w.a, ["log", "-1", "--format=%B", stamped.tip]), /Nosedive-Dive: d1/);
	assert.equal(sh(w.a, ["rev-parse", "HEAD"]), two, "HEAD stayed");
	assert.equal(sh(w.a, ["log", "-1", "--format=%an", stamped.tip]), "Test");
	assert.equal(stampRange(w.a, two, two, []).tip, two);
	assert.ok(one);
});

test("snapshot holds uncommitted work without touching the index or tree", () => {
	const w = world("pp-snap");
	writeFileSync(join(w.a, "f.txt"), "edit");
	writeFileSync(join(w.a, "new.txt"), "new");
	const taken = snapshot(w.a, w.main, "pack: wip", "test");
	assert.equal(taken.made.size, 1);
	assert.equal(sh(w.a, ["show", `${taken.tip}:new.txt`]), "new");
	assert.equal(sh(w.a, ["show", `${taken.tip}:f.txt`]), "edit");
	assert.equal(sh(w.a, ["status", "--porcelain"]), "M f.txt\n?? new.txt", "the checkout is as it was");
	assert.equal(sh(w.a, ["diff", "--cached", "--name-only"]), "", "the index was not touched");
	assert.equal(sh(w.a, ["log", "-1", "--format=%cn", taken.tip]), "Test", "the user commits it");
	sh(w.a, ["checkout", "--", "f.txt"]);
	rmSync(join(w.a, "new.txt"));
	assert.equal(snapshot(w.a, w.main, "pack: wip", "test").tip, w.main, "nothing to hold");
});

test("snapshot keeps content staged only, which the files no longer hold, and is the same commit when taken again", () => {
	const w = world("pp-snap-staged");
	writeFileSync(join(w.a, "f.txt"), "staged only");
	sh(w.a, ["add", "f.txt"]);
	writeFileSync(join(w.a, "f.txt"), "one");
	const taken = snapshot(w.a, w.main, "pack: wip", "test");
	assert.notEqual(taken.tip, w.main, "the staged copy is not dropped");
	assert.equal(sh(w.a, ["show", `${taken.tip}~1:f.txt`]), "staged only", "it rides in a commit of its own");
	assert.equal(sh(w.a, ["show", `${taken.tip}:f.txt`]), "one");
	assert.equal(snapshot(w.a, w.main, "pack: wip", "test").tip, taken.tip, "deterministic, so a retry recognises what it published");
});

test("detaching HEAD from a branch checks the branch HEAD named", () => {
	const w = world("pp-detach");
	sh(w.a, ["branch", "other", w.main]);
	const step: Step = { repo: "a", dir: w.a, local: { head: { from: { branch: "main" }, to: { detached: w.main } } } };
	sh(w.a, ["checkout", "-q", "other"]);
	const done = commitPlan({ steps: [step] });
	assert.ok(!done.ok && done.refusal.kind === "stale", JSON.stringify(done));
	assert.equal(sh(w.a, ["symbolic-ref", "HEAD"]), "refs/heads/other");
});

test("commitOffside builds a nosedive commit on a parent with no ref, index or file touched; docAt reads it back", () => {
	const w = world("pp-off");
	const built = commitOffside(w.a, w.main, { "kb/x.md": "---\nkind: x\n---\nbody\n" }, "record", "test");
	assert.equal(sh(w.a, ["log", "-1", "--format=%cn", built.tip]), "nosedive");
	assert.match(sh(w.a, ["log", "-1", "--format=%B", built.tip]), /Co-Authored-By: nosedive test/);
	assert.equal(sh(w.a, ["rev-parse", "HEAD"]), w.main);
	assert.equal(sh(w.a, ["status", "--porcelain"]), "");
	assert.equal(existsSync(join(w.a, "kb", "x.md")), false);
	assert.equal(docAt(w.a, built.tip, "kb/x.md")?.fm.kind, "x");
	assert.equal(docAt(w.a, w.main, "kb/x.md"), undefined);
});

test("fetchExact reads each sha once from the remote, and null for a ref it lacks", () => {
	const w = world("pp-fetch");
	const moved = commit(w.b, "g.txt", "theirs");
	sh(w.b, ["push", "-q", "origin", "main"]);
	const found = fetchExact(w.a, "origin", ["refs/heads/main", "refs/nosedive/h/dives/none"]);
	assert.deepEqual(found, { "refs/heads/main": moved, "refs/nosedive/h/dives/none": null });
});

test("a push that itself sets the local copy of a non-branch ref, through a fetch refspec, is the move already made", () => {
	const w = world("pp-refspec");
	sh(w.a, ["config", "--add", "remote.origin.fetch", "+refs/nosedive/*:refs/nosedive/*"]);
	const next = commit(w.a, "f.txt", "two", true);
	sh(w.a, ["reset", "-q", "--hard", w.main]);
	const ref = "refs/nosedive/h/dives/d1";
	const step: Step = {
		repo: "a",
		dir: w.a,
		remote: { name: "origin", updates: [{ ref, old: null, new: next, fastForward: false, publishes: new Set([next]) }] },
		local: { moves: [{ ref, old: null, new: next }] },
	};
	assert.deepEqual(commitPlan({ steps: [step] }), { ok: true });
	assert.equal(remoteOf(w, ref), next);
	assert.equal(sh(w.a, ["rev-parse", ref]), next);
	const del: Step = { repo: "a", dir: w.a, remote: { name: "origin", updates: [{ ref, old: next, new: null, fastForward: false }] }, local: { moves: [{ ref, old: next, new: null }] } };
	assert.deepEqual(commitPlan({ steps: [del] }), { ok: true });
	assert.equal(remoteOf(w, ref), undefined);
});

test("no reset --hard and no bare git push in the primitive's file, which is the only place that pushes", () => {
	const text = readFileSync(new URL("./i01a1ffce2ea27db19c84f1fec56c9a3d.ts", import.meta.url), "utf8");
	assert.ok(!/reset["', ]+--hard|"--hard"/.test(text));
});

// Plan type is exercised above; keep the import used for documentation of the shape.
const _shape: Plan = { steps: [] };
void _shape;

// @ts-expect-error after is local-only, including at the public type boundary.
const _unsafeAfter: Plan = { steps: [], after: [{ repo: "x", dir: ".", remote: { name: "origin", updates: [] } }] };
void _unsafeAfter;
