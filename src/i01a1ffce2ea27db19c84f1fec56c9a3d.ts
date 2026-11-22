import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc, type KbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a19005c31172b68871d4842563d310 as coAuthored, isCoAuthor, hasCoAuthor } from "./i01a19005c31172b68871d4842563d310.ts";

export type Sha = string;

/** One remote ref change. `old` null: the ref must not exist; `new` null: delete it. */
export type RemoteUpdate = {
	/** Full name: `refs/heads/main`, `refs/nosedive/<hero>/dives/<id>`. */
	ref: string;
	/** The exact sha the plan was computed from. */
	old: Sha | null;
	new: Sha | null;
	/** A branch: `old` must be an ancestor of `new`. */
	fastForward: boolean;
	/** Required when `new` is set: every sha in `rev-list new ^old` must be in it. */
	publishes?: ReadonlySet<Sha>;
};

/** One local ref change, never HEAD. `old` null: the ref must not exist; `new` null: delete it. */
export type LocalMove = { ref: string; old: Sha | null; new: Sha | null };

/** What HEAD points at. */
export type Head = { branch: string } | { detached: Sha };
type Files = { from: Sha; to: Sha; index?: Sha; afterMoves?: boolean };

export type Step = {
	/** Display name. */
	repo: string;
	dir: string;
	/** Ordered per-ref pushes. Every prefix must be a safe state. */
	remote?: { name: string; updates: RemoteUpdate[] };
	local?: {
		/** One `update-ref` transaction. */
		moves?: LocalMove[];
		/** A transaction of its own: git refuses one that updates HEAD and its referent. */
		head?: { from: Head; to: Head };
		/** The checkout follows with `read-tree -m -u`; `index` leaves the index at that tree after, which undoes a work-in-progress commit. `afterMoves` keeps committed refs when git refuses a racing worktree edit. */
		files?: Files;
		/** Written last. */
		config?: [key: string, value: string][];
		/** Deletes, after HEAD moved off them. */
		drop?: LocalMove[];
	};
};

/** A teardown step can only change local state. */
export type LocalStep = Omit<Step, "remote"> & { remote?: never };

/** `after` is local-only teardown, run once every step is done. */
export type Plan = { steps: Step[]; after?: LocalStep[] };

export type Refusal = {
	/** `stale`: a lease or a compare-and-swap found a ref moved, so re-plan. `dirty`: the index or tree is not clean where files must follow. `boundary`: a plan invariant failed, a planner bug, never retried. `failed`: git said no for another reason. */
	kind: "stale" | "dirty" | "boundary" | "failed";
	repo: string;
	/** Index into `steps`, then `after`. */
	step: number;
	/** Steps fully committed before this one; 0 means nothing changed anywhere. */
	done: number;
	/** Git's words, trimmed. */
	detail: string;
	/** After a partial local failure: where refs, HEAD and files are. */
	state?: string;
};

export type Outcome = { ok: true } | { ok: false; refusal: Refusal };

type Run = { ok: boolean; out: string; err: string };

function git(dir: string, args: string[], options: { input?: string; env?: Record<string, string> } = {}): Run {
	const result = spawnSync("git", args, { cwd: dir, encoding: "utf8", input: options.input, env: options.env ? { ...process.env, ...options.env } : process.env, maxBuffer: 1 << 28 });
	return { ok: result.status === 0, out: (result.stdout ?? "").trim(), err: (result.stderr || result.error?.message || "").trim() };
}

/** What git said, without its hints and remote lines. */
function trimmed(text: string): string {
	return text.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("hint:") && !line.startsWith("To ")).slice(0, 4).join("; ");
}

/** The committer of every commit nosedive makes by itself, which is how a commit is told to be its own. */
export const NOSEDIVE_COMMITTER = { GIT_COMMITTER_NAME: "nosedive", GIT_COMMITTER_EMAIL: "noreply@nosedive.dev" };

function sha(dir: string, rev: string): Sha | null {
	const result = git(dir, ["rev-parse", "--verify", "-q", `${rev}^{commit}`]);
	return result.ok ? result.out : null;
}

function refValue(dir: string, ref: string): Sha | null {
	const result = git(dir, ["rev-parse", "--verify", "-q", ref]);
	return result.ok ? result.out : null;
}

function headOf(dir: string): Head {
	const symbolic = git(dir, ["symbolic-ref", "-q", "HEAD"]);
	if (symbolic.ok) return { branch: symbolic.out.replace(/^refs\/heads\//, "") };
	return { detached: git(dir, ["rev-parse", "HEAD"]).out };
}

function sameHead(a: Head, b: Head): boolean {
	return "branch" in a ? "branch" in b && a.branch === b.branch : "detached" in b && a.detached === b.detached;
}

function describeHead(head: Head): string {
	return "branch" in head ? head.branch : `detached ${head.detached.slice(0, 7)}`;
}

function same(a: string, b: string): boolean {
	return a.replace(/\\/g, "/").toLowerCase() === b.replace(/\\/g, "/").toLowerCase();
}

/** The worktree, other than this one, that has a branch checked out. */
function checkedOutElsewhere(dir: string, ref: string): string | undefined {
	const here = git(dir, ["rev-parse", "--show-toplevel"]).out;
	let path = "";
	for (const line of git(dir, ["worktree", "list", "--porcelain"]).out.split("\n")) {
		if (line.startsWith("worktree ")) path = line.slice("worktree ".length).trim();
		else if (line.trim() === `branch ${ref}` && !same(path, here)) return path;
	}
	return undefined;
}

/** The git version as numbers, read once. */
let gitVersion: number[] | undefined;
function supportsSymrefUpdate(): boolean {
	gitVersion ??= (/(\d+)\.(\d+)/.exec(spawnSync("git", ["--version"], { encoding: "utf8" }).stdout) ?? []).slice(1).map(Number);
	const [major = 0, minor = 0] = gitVersion;
	return major > 2 || (major === 2 && minor >= 46);
}

function pushOutcome(text: string): "stale" | "failed" {
	if (/stale info|rejected|fetch first|cannot lock ref|but expected|failed to update ref|failed to push/i.test(text) && !/Could not resolve|unable to access|Connection|Permission denied|Authentication|not appear to be a git repository|does not exist/i.test(text)) return "stale";
	return "failed";
}

/** What a step's own checks find wrong with it, before or while it is applied. */
function verifyLocal(step: Step, local: NonNullable<Step["local"]>): Pick<Refusal, "kind" | "detail"> | undefined {
	for (const move of [...(local.moves ?? []), ...(local.drop ?? [])]) {
		const current = refValue(step.dir, move.ref);
		if (current !== move.old) return { kind: "stale", detail: `${move.ref} is at ${current?.slice(0, 7) ?? "nothing"}, not ${move.old?.slice(0, 7) ?? "nothing"} as planned` };
		if (move.ref.startsWith("refs/heads/")) {
			const elsewhere = checkedOutElsewhere(step.dir, move.ref);
			if (elsewhere) return { kind: "stale", detail: `${move.ref.slice("refs/heads/".length)} is checked out in ${elsewhere}, which a moved branch would leave confused` };
		}
	}
	if (local.head) {
		const now = headOf(step.dir);
		if (!sameHead(now, local.head.from)) return { kind: "stale", detail: `HEAD is on ${describeHead(now)}, not ${describeHead(local.head.from)} as planned` };
		if (!supportsSymrefUpdate()) return { kind: "failed", detail: "moving HEAD needs git 2.46 or later" };
	}
	const files = local.files;
	if (files && files.from !== files.to && !files.afterMoves) {
		git(step.dir, ["update-index", "-q", "--refresh"]);
		const staged = git(step.dir, ["diff-index", "--cached", "--name-only", "--ignore-submodules=all", files.from]);
		if (!staged.ok || staged.out) return { kind: "dirty", detail: `the index of ${step.dir} is not at ${files.from.slice(0, 7)}, so its files are left alone: ${staged.out.split("\n").slice(0, 3).join(", ")}` };
		const changed = git(step.dir, ["diff-files", "--name-only", "--ignore-submodules=all"]);
		if (!changed.ok || changed.out) return { kind: "dirty", detail: `${step.dir} has uncommitted changes, which moving its files would risk: ${changed.out.split("\n").slice(0, 3).join(", ")}` };
	}
	return undefined;
}

function verifyRemote(remote: NonNullable<Step["remote"]>, dir: string): Pick<Refusal, "kind" | "detail"> | undefined {
	for (const update of remote.updates) {
		if (update.new === null) continue;
		if (!update.publishes) return { kind: "boundary", detail: `${update.ref} publishes commits with no set that approves them` };
		if (update.fastForward && update.old !== null && !git(dir, ["merge-base", "--is-ancestor", update.old, update.new]).ok) {
			return { kind: "boundary", detail: `${update.new.slice(0, 7)} does not build on ${update.old.slice(0, 7)}, which ${update.ref} holds` };
		}
		const range = update.old !== null ? [update.new, "--not", update.old] : [update.new, "--not", `--remotes=${remote.name}`];
		const listed = git(dir, ["rev-list", ...range]);
		if (!listed.ok) return { kind: "failed", detail: `cannot list what ${update.ref} would publish: ${trimmed(listed.err)}` };
		const strays = listed.out.split("\n").filter(Boolean).filter((each) => !update.publishes!.has(each));
		if (strays.length > 0) return { kind: "boundary", detail: `${update.ref} would publish ${strays.length} commit${strays.length === 1 ? "" : "s"} no plan approved: ${strays.map((each) => each.slice(0, 7)).join(", ")}` };
	}
	return undefined;
}

function transaction(dir: string, lines: string[], message: string, noDeref = false): Run {
	return git(dir, ["update-ref", ...(noDeref ? ["--no-deref"] : []), "--stdin", "-m", message], { input: `${["start", ...lines, "prepare", "commit"].join("\n")}\n` });
}

function moveLines(moves: LocalMove[]): string[] {
	return moves.filter((move) => move.old !== null || move.new !== null).map((move) => {
		if (move.new === null) return move.old === null ? `delete ${move.ref}` : `delete ${move.ref} ${move.old}`;
		return move.old === null ? `create ${move.ref} ${move.new}` : `update ${move.ref} ${move.new} ${move.old}`;
	});
}

/** Where refs, HEAD and files are, for a refusal that cannot undo what it did. */
function stateOf(step: Step): string {
	const local = step.local;
	const refs = [...(local?.moves ?? []), ...(local?.drop ?? [])].map((move) => `${move.ref} ${refValue(step.dir, move.ref)?.slice(0, 7) ?? "absent"}`);
	return `in ${step.dir}: HEAD ${describeHead(headOf(step.dir))}${refs.length > 0 ? `; ${refs.join("; ")}` : ""}${local?.files ? `; files read from ${local.files.from.slice(0, 7)} to ${local.files.to.slice(0, 7)}` : ""}`;
}

function apply(step: Step, command: string, tracking: boolean): Pick<Refusal, "kind" | "detail" | "state"> | undefined {
	const { remote } = step;
	let local = step.local;
	if (remote && remote.updates.length > 0) {
		for (const [index, update] of remote.updates.entries()) {
			// A previous attempt may have completed this exact ref. Seeing the planned value makes it done, not stale.
			const observed = git(step.dir, ["ls-remote", remote.name, update.ref]);
			if (!observed.ok) return { kind: "failed", detail: `cannot check ${update.ref} before pushing it: ${trimmed(observed.err)}` };
			const current = observed.out.split("\t")[0] || null;
			if (current !== update.new) {
				const args = ["push", "--porcelain", remote.name, `--force-with-lease=${update.ref}:${update.old ?? ""}`, `${update.new ?? ""}:${update.ref}`];
				const pushed = git(step.dir, args);
				if (!pushed.ok) {
					const detail = trimmed(`${pushed.err}\n${pushed.out}`) || "git push failed";
					return { kind: pushOutcome(`${pushed.err}\n${pushed.out}`), detail: `${update.ref} was not pushed after ${index} ref${index === 1 ? "" : "s"} in this step: ${detail}` };
				}
			}
			// A tracking ref is a cache, so a failure to update it is no refusal.
			if (tracking && update.ref.startsWith("refs/heads/")) {
				const tracked = `refs/remotes/${remote.name}/${update.ref.slice("refs/heads/".length)}`;
				if (update.new === null) git(step.dir, ["update-ref", "-d", tracked]);
				else {
					const trackedOld = refValue(step.dir, tracked);
					git(step.dir, trackedOld === null ? ["update-ref", tracked, update.new] : ["update-ref", tracked, update.new, trackedOld]);
				}
			}
		}
	}
	if (!local) return undefined;
	// A push may itself move a local copy of a ref that is not a branch (a fetch refspec that maps it): that is the move already made, not a race.
	const pushed = (moves: LocalMove[] | undefined) =>
		moves?.map((move) => {
			const update = remote?.updates.find((each) => each.ref === move.ref && !each.ref.startsWith("refs/heads/"));
			return update && refValue(step.dir, move.ref) === update.new ? { ...move, old: update.new } : move;
		});
	local = { ...local, ...(local.moves ? { moves: pushed(local.moves)! } : {}), ...(local.drop ? { drop: pushed(local.drop)! } : {}) };
	const checked = verifyLocal(step, local);
	if (checked) return checked;
	const files = local.files;
	const moving = files !== undefined && files.from !== files.to;
	const afterMoves = moving && files.afterMoves === true;
	if (moving && !afterMoves) {
		const read = git(step.dir, ["read-tree", "-m", "-u", files.from, files.to]);
		if (!read.ok) return { kind: "dirty", detail: `files were not moved: ${trimmed(read.err)}` };
	}
	if (local.moves && local.moves.length > 0) {
		const moved = transaction(step.dir, moveLines(local.moves), `nosedive ${command}`);
		if (!moved.ok) {
			let state: string | undefined;
			if (moving && !afterMoves) {
				const back = !git(step.dir, ["diff-index", "--cached", "--quiet", "--ignore-submodules=all", files.to]).ok || !git(step.dir, ["diff-files", "--quiet", "--ignore-submodules=all"]).ok ? { ok: false } : git(step.dir, ["read-tree", "-m", "-u", files.to, files.from]);
				if (!back.ok) state = stateOf(step);
			}
			return { kind: "stale", detail: `refs were not moved: ${trimmed(moved.err)}`, ...(state ? { state } : {}) };
		}
	}
	if (local.head) {
		const { from, to } = local.head;
		let line: string;
		if ("branch" in to) line = `symref-update HEAD refs/heads/${to.branch} ${"branch" in from ? `ref refs/heads/${from.branch}` : `oid ${from.detached}`}`;
		else line = "branch" in from ? `update HEAD ${to.detached}` : `update HEAD ${to.detached} ${from.detached}`;
		// Detaching from a branch cannot carry its own old value (git refuses two updates of HEAD in one transaction), so HEAD's symbolic target is verified by a transaction of its own first.
		const verified = "branch" in from && "detached" in to ? transaction(step.dir, [`symref-verify HEAD refs/heads/${from.branch}`], `nosedive ${command}`, true) : { ok: true, out: "", err: "" };
		const moved = verified.ok ? transaction(step.dir, [line], `nosedive ${command}`, true) : verified;
		if (!moved.ok) {
			let state: string | undefined;
			if (moving && !afterMoves) {
				const back = !git(step.dir, ["diff-index", "--cached", "--quiet", "--ignore-submodules=all", files.to]).ok || !git(step.dir, ["diff-files", "--quiet", "--ignore-submodules=all"]).ok ? { ok: false } : git(step.dir, ["read-tree", "-m", "-u", files.to, files.from]);
				if (!back.ok) state = stateOf(step);
			}
			return { kind: "stale", detail: `HEAD was not moved: ${trimmed(moved.err)}; refs are as published`, state: state ?? stateOf(step) };
		}
	}
	if (afterMoves) {
		const read = git(step.dir, ["read-tree", "-m", "-u", files.from, files.to]);
		if (!read.ok) {
			// Git refused, as it does when an affected entry or file differs from `from`, mode included: nothing more is changed, the
			// index and files stay as the user has them, and the commit stands.
			const detail = `the commit stands, but the index and files were left as they are: ${trimmed(read.err)}`;
			return { kind: "dirty", detail, state: stateOf(step) };
		}
	}
	if (files?.index) {
		const read = git(step.dir, ["read-tree", files.index]);
		if (!read.ok) return { kind: "failed", detail: `the index was not set: ${trimmed(read.err)}`, state: stateOf(step) };
	}
	if (local.drop && local.drop.length > 0) {
		const dropped = transaction(step.dir, moveLines(local.drop.map((move) => ({ ...move, new: null }))), `nosedive ${command}`);
		if (!dropped.ok) return { kind: "failed", detail: `refs were not dropped: ${trimmed(dropped.err)}`, state: stateOf(step) };
	}
	for (const [key, value] of local.config ?? []) {
		const set = git(step.dir, ["config", key, value]);
		if (!set.ok) return { kind: "failed", detail: `${key} was not set: ${trimmed(set.err)}`, state: stateOf(step) };
	}
	return undefined;
}

/**
 * The only place a plan is carried out. Everything is verified first, changing nothing; then each step runs in order: one
 * one push per remote ref in the safe order the plan declares, with an exact-sha lease, then the local refs by compare-and-swap, HEAD in a transaction of its own, and
 * files only where the index and tree are clean. It never retries and never undoes a push: a refusal says how many steps
 * were done (`done`), and a command re-plans from a fresh fetch on `stale`.
 */
export function commitPlan(plan: Plan, command = "commit"): Outcome {
	const all = [...plan.steps, ...(plan.after ?? [])];
	const refuse = (index: number, found: Pick<Refusal, "kind" | "detail" | "state">): Outcome => ({ ok: false, refusal: { kind: found.kind, repo: all[index]!.repo, step: index, done: index, detail: found.detail, ...(found.state ? { state: found.state } : {}) } });
	for (const [offset, step] of (plan.after ?? []).entries()) {
		if ((step as Step).remote) return { ok: false, refusal: { kind: "boundary", repo: step.repo, step: plan.steps.length + offset, done: 0, detail: "after is local-only and cannot contain a remote update" } };
	}
	for (const [index, step] of plan.steps.entries()) {
		const found = (step.remote && verifyRemote(step.remote, step.dir)) || (step.local && verifyLocal(step, step.local));
		if (found) return { ok: false, refusal: { kind: found.kind, repo: step.repo, step: index, done: 0, detail: found.detail } };
	}
	for (const [index, step] of all.entries()) {
		const found = apply(step, command, index < plan.steps.length);
		if (found) return refuse(index, found);
	}
	return { ok: true };
}

/** One line for a person: what was refused and what is left. */
export function describeRefusal(refusal: Refusal): string {
	const done = refusal.done === 0 ? "nothing was changed" : `${refusal.done} step${refusal.done === 1 ? "" : "s"} done before it`;
	return `${refusal.kind} in ${refusal.repo}: ${refusal.detail}; ${done}${refusal.state ? `; ${refusal.state}` : ""}`;
}

/** Fetches refs from a remote and reads each sha once, which is what the plan and its leases are built on; null when the remote has none. */
export function fetchExact(dir: string, remote: string, refs: string[]): Record<string, Sha | null> {
	const asked = git(dir, ["ls-remote", remote, ...refs]);
	if (!asked.ok) throw new Error(`cannot reach ${remote}, so nothing was changed (offline?): ${trimmed(asked.err)}`);
	const present = new Set(asked.out.split("\n").filter(Boolean).map((line) => line.split("\t")[1]));
	const found: Record<string, Sha | null> = {};
	for (const ref of refs) {
		if (!present.has(ref)) {
			found[ref] = null;
			continue;
		}
		const into = ref.startsWith("refs/heads/") ? `refs/remotes/${remote}/${ref.slice("refs/heads/".length)}` : ref;
		const fetched = git(dir, ["fetch", "-q", remote, `+${ref}:${into}`]);
		if (!fetched.ok) throw new Error(`cannot fetch ${remote} ${ref}, so nothing was changed (offline, or the ref moved?): ${trimmed(fetched.err)}`);
		found[ref] = refValue(dir, into);
	}
	return found;
}

/** The commits in `base..tip`, oldest first, with whether nosedive committed each. */
export function ownedRange(dir: string, base: Sha | null, tip: Sha): { sha: Sha; subject: string; own: boolean; merge: boolean }[] {
	const listed = git(dir, ["log", "--reverse", "--format=%H%x00%cn%x00%ce%x00%s%x00%P", ...(base ? [tip, "--not", base] : [tip])]);
	if (!listed.ok) throw new Error(`git log failed in ${dir}: ${trimmed(listed.err)}`);
	return listed.out.split("\n").filter(Boolean).map((line) => {
		const [commit, name, email, subject, parents] = line.split("\0") as [string, string, string, string, string];
		return { sha: commit, subject, own: name === NOSEDIVE_COMMITTER.GIT_COMMITTER_NAME && email === NOSEDIVE_COMMITTER.GIT_COMMITTER_EMAIL, merge: parents.split(" ").filter(Boolean).length > 1 };
	});
}

/**
 * Makes `commit`'s change on `onto` without a checkout: `merge-tree` for the merged tree, a commit from it with the commit's
 * message, author, committer and dates, and `onto` itself when it holds the change already.
 */
function pick(dir: string, commit: Sha, onto: Sha): { sha: Sha } | { conflict: string } {
	const merged = spawnSync("git", ["merge-tree", "--write-tree", `--merge-base=${commit}^`, onto, commit], { cwd: dir, encoding: "utf8" });
	if (merged.status !== 0) return { conflict: trimmed(merged.stdout.split("\n").filter((line) => /conflict/i.test(line)).join("\n") || merged.stderr || "merge-tree failed") };
	const tree = merged.stdout.split("\n")[0]!.trim();
	if (tree === git(dir, ["rev-parse", `${onto}^{tree}`]).out) return { sha: onto };
	const [an, ae, ad, cn, ce, cd] = git(dir, ["log", "-1", "--format=%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI", commit]).out.split("\0") as string[];
	const raw = spawnSync("git", ["cat-file", "commit", commit], { cwd: dir, encoding: "utf8" }).stdout;
	const message = raw.slice(raw.indexOf("\n\n") + 2);
	const env = { ...process.env, GIT_AUTHOR_NAME: an, GIT_AUTHOR_EMAIL: ae, GIT_AUTHOR_DATE: ad, GIT_COMMITTER_NAME: cn, GIT_COMMITTER_EMAIL: ce, GIT_COMMITTER_DATE: cd };
	const made = spawnSync("git", ["commit-tree", tree, "-p", onto], { cwd: dir, encoding: "utf8", input: message, env });
	if (made.status !== 0) return { conflict: `commit-tree failed: ${made.stderr.trim()}` };
	return { sha: made.stdout.trim() };
}

/** `shas` made again, in order, on `onto`: the new tip and exactly the shas commit-tree returned, a pick that changes nothing adding none; or the conflict. */
export function replay(dir: string, shas: Sha[], onto: Sha): { tip: Sha; made: Set<Sha> } | { conflict: string } {
	let tip = onto;
	const made = new Set<Sha>();
	for (const commit of shas) {
		const next = pick(dir, commit, tip);
		if ("conflict" in next) return next;
		if (next.sha !== tip) made.add(next.sha);
		tip = next.sha;
	}
	return { tip, made };
}

/**
 * The commits in `base..tip` made again, each with the same tree, author and committer and its message given the trailers;
 * plumbing, so no hook runs and no ref moves. `base` is an exact sha. The tip is `tip` when nothing is in range.
 */
export function stampRange(dir: string, base: Sha | null, tip: Sha, trailers: string[]): { tip: Sha; made: Set<Sha> } {
	const listed = git(dir, ["rev-list", "--reverse", "--topo-order", tip, ...(base ? ["--not", base] : [])]);
	if (!listed.ok) throw new Error(`git rev-list failed in ${dir}: ${trimmed(listed.err)}`);
	const shas = listed.out.split("\n").filter(Boolean);
	const mapped = new Map<Sha, Sha>();
	for (const commit of shas) {
		const [an, ae, ad, cn, ce, cd, parents, tree] = git(dir, ["log", "-1", "--format=%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%P%x00%T", commit]).out.split("\0") as string[];
		const message = spawnSync("git", ["log", "-1", "--format=%B", commit], { cwd: dir, encoding: "utf8" }).stdout;
		// A trailer already there is left alone, except that a co-author is told by its value: another's does not stand in for nosedive's.
		const given = trailers.flatMap((trailer) => (isCoAuthor(trailer) ? (hasCoAuthor(message) ? [] : ["--if-exists", "add", "--trailer", trailer]) : ["--if-exists", "doNothing", "--trailer", trailer]));
		const stamped = spawnSync("git", ["interpret-trailers", ...given], { cwd: dir, encoding: "utf8", input: message }).stdout;
		const env = { ...process.env, GIT_AUTHOR_NAME: an, GIT_AUTHOR_EMAIL: ae, GIT_AUTHOR_DATE: ad, GIT_COMMITTER_NAME: cn, GIT_COMMITTER_EMAIL: ce, GIT_COMMITTER_DATE: cd };
		const parentArgs = (parents ?? "").split(" ").filter(Boolean).flatMap((parent) => ["-p", mapped.get(parent) ?? parent]);
		const result = spawnSync("git", ["commit-tree", tree!, ...parentArgs], { cwd: dir, encoding: "utf8", input: stamped, env });
		if (result.status !== 0) throw new Error(`cannot stamp ${commit.slice(0, 7)} in ${dir}: ${result.stderr.trim()}`);
		mapped.set(commit, result.stdout.trim());
	}
	const last = shas.at(-1);
	return { tip: last ? mapped.get(last)! : tip, made: new Set(mapped.values()) };
}

/** Runs `work` with a temporary index in a directory of its own, so the repo's real index and tree are never touched. */
function offside<T>(dir: string, parent: Sha, work: (env: Record<string, string>) => T): T {
	const scratch = mkdtempSync(join(tmpdir(), "nosedive-index-"));
	try {
		const env = { GIT_INDEX_FILE: join(scratch, "index") };
		const read = git(dir, ["read-tree", parent], { env });
		if (!read.ok) throw new Error(`cannot read ${parent.slice(0, 7)} in ${dir}: ${trimmed(read.err)}`);
		return work(env);
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
}

function commitTree(dir: string, tree: string, parent: Sha, message: string, env: Record<string, string>): Sha {
	const made = git(dir, ["commit-tree", tree, "-p", parent, "-m", message], { env });
	if (!made.ok) throw new Error(`git commit-tree failed in ${dir}: ${trimmed(made.err)}`);
	return made.out;
}

/**
 * What is uncommitted in the checkout, held in commits on `parent` committed by the user as pack's was, built through a
 * temporary index so the real index and tree are untouched. Content staged that the files no longer hold rides in a commit
 * of its own beneath the files' commit, so no staged copy is lost. The commits take the parent's date, so the same state
 * on the same parent is the same commit: a retry recognises what an earlier attempt published. `parent` itself when there is nothing to hold.
 */
export function snapshot(dir: string, parent: Sha, message: string, version: string): { tip: Sha; made: Set<Sha> } {
	const date = git(dir, ["log", "-1", "--format=%cI", parent]).out;
	const dated = { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
	const parentTree = git(dir, ["rev-parse", `${parent}^{tree}`]).out;
	const live = git(dir, ["write-tree"]);
	const staged = live.ok ? live.out : parentTree;
	return offside(dir, parent, (env) => {
		const added = git(dir, ["add", "-A"], { env });
		if (!added.ok) throw new Error(`git add failed in ${dir}: ${trimmed(added.err)}`);
		const tree = git(dir, ["write-tree"], { env });
		if (!tree.ok) throw new Error(`git write-tree failed in ${dir}: ${trimmed(tree.err)}`);
		const text = coAuthored(message, version);
		const made = new Set<Sha>();
		let tip = parent;
		if (staged !== parentTree && staged !== tree.out) {
			tip = commitTree(dir, staged, tip, text, { ...env, ...dated });
			made.add(tip);
		}
		if (tree.out !== (tip === parent ? parentTree : staged)) {
			tip = commitTree(dir, tree.out, tip, text, { ...env, ...dated });
			made.add(tip);
		}
		return { tip, made };
	});
}

/**
 * A commit on `parent` that sets the given files (repo-relative path to text), committed by nosedive with its co-author
 * trailer, built through a temporary index: no ref, real index or file is touched.
 */
export function commitOffside(dir: string, parent: Sha, files: Record<string, string>, message: string, version: string): { tip: Sha; made: Set<Sha> } {
	return offside(dir, parent, (env) => {
		for (const [path, text] of Object.entries(files)) {
			const blob = git(dir, ["hash-object", "-w", "--stdin"], { input: text, env });
			if (!blob.ok) throw new Error(`git hash-object failed in ${dir}: ${trimmed(blob.err)}`);
			const set = git(dir, ["update-index", "--add", "--cacheinfo", `100644,${blob.out},${path.replace(/\\/g, "/")}`], { env });
			if (!set.ok) throw new Error(`git update-index failed in ${dir}: ${trimmed(set.err)}`);
		}
		const tree = git(dir, ["write-tree"], { env });
		if (!tree.ok) throw new Error(`git write-tree failed in ${dir}: ${trimmed(tree.err)}`);
		const tip = commitTree(dir, tree.out, parent, coAuthored(message, version), { ...env, ...NOSEDIVE_COMMITTER });
		return { tip, made: new Set([tip]) };
	});
}

/** The primitive's own id, as every code file exports one. */
export const i01a1ffce2ea27db19c84f1fec56c9a3d = commitPlan;

/** A kb doc as of a commit, read from git rather than from the checkout; undefined when the commit has no such file. */
export function docAt(dir: string, commit: Sha, path: string): (KbDoc & { text: string }) | undefined {
	const shown = spawnSync("git", ["show", `${commit}:${path.replace(/\\/g, "/")}`], { cwd: dir, encoding: "utf8", maxBuffer: 1 << 28 });
	if (shown.status !== 0) return undefined;
	return { ...readKbDoc(shown.stdout, path), text: shown.stdout };
}
