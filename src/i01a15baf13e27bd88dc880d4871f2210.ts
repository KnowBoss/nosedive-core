import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13c760de87562b4738946402010b8 as checkoutPath } from "./i01a13c760de87562b4738946402010b8.ts";

const BRANCHES = "+refs/heads/*:refs/remotes/origin/*";
const PACKED = "+refs/nosedive/*:refs/nosedive/*";

type RepoDoc = { fm: Record<string, unknown> };
type Say = { out(text: string): void; err(text: string): void };
export type Feat = { id: string; workBranch: string };

export function i01a15baf13e27bd88dc880d4871f2210(bridge: Bridge, doc: RepoDoc, ctx: Say, feat?: Feat): { dir: string; trunk: string } {
	const name = String(doc.fm.name);
	const dir = checkoutPath(bridge, name);
	const shown = relative(bridge.dir, dir).replace(/\\/g, "/");
	const branch = feat ? featBranch(bridge, feat.id) : undefined;
	if (existsSync(dir)) {
		const on = git(dir, "symbolic-ref", "-q", "--short", "HEAD");
		const current = on.ok ? on.text : undefined;
		if (current !== branch) throw new Error(`${shown} is ${current ? `on ${current}` : "detached"}, not ${branch ? `on ${branch}` : "detached"}: dehydrate it first`);
		ctx.out(`${shown}: checked out already`);
		return { dir, trunk: trunkOf(doc, cachePath(doc)) };
	}
	const { cache, trunk } = fetchCache(bridge, doc, ctx);

	let added;
	if (feat && branch) {
		if (!git(cache, "rev-parse", "--verify", "-q", `refs/heads/${branch}`).ok) {
			const start = [`refs/nosedive/${branch}`, `refs/remotes/origin/${feat.workBranch}`, `refs/remotes/origin/${trunk}`].find((ref) => git(cache, "rev-parse", "--verify", "-q", ref).ok)!;
			git(cache, "branch", "-q", "--no-track", branch, start);
		}
		git(cache, "config", `branch.${branch}.remote`, "origin");
		git(cache, "config", `branch.${branch}.merge`, `refs/heads/${feat.workBranch}`);
		added = git(cache, "worktree", "add", "-q", dir, branch);
	} else {
		// Detached: no branch, so nothing to push; work is done for a feat.
		added = git(cache, "worktree", "add", "-q", "--detach", dir, `refs/remotes/origin/${trunk}`);
	}
	if (!added.ok) throw new Error(`cannot check ${name} out at ${shown}: ${added.text}`);
	// With per-worktree config on, as legacy caches have it, the cache's core.bare reaches the worktree unless it says otherwise.
	if (git(cache, "config", "--bool", "extensions.worktreeConfig").text === "true") git(dir, "config", "--worktree", "core.bare", "false");
	const at = git(dir, "rev-parse", "--short", "HEAD").text;
	ctx.out(branch ? `${shown}: on ${branch} at ${at}` : `${shown}: detached at ${trunk} ${at}`);
	return { dir, trunk };
}

/** A feat's checkout is named after the ship and its branch too, so checkouts of different ships never share a branch in the user's cache. */
function featBranch(bridge: Bridge, featId: string): string {
	const on = git(bridge.dir, "symbolic-ref", "-q", "--short", "HEAD");
	if (!on.ok) throw new Error("the ship is detached, so a feat's checkout has no branch to be named after: put the ship on a branch first");
	return `${bridge.id}/${on.text}/${featId}`;
}

/** The user's cache of a repo, shared by every checkout of every ship. */
function cachePath(doc: RepoDoc): string {
	const user = process.env.NOSEDIVE_USER_DIR || join(homedir(), ".nosedive");
	return join(user, "cache", `${String(doc.fm.id)}.git`);
}

/** Fetches the user's cache of a repo from its origin, making the cache when there is none, without checking anything out; returns it and the repo's trunk. */
export function fetchCache(bridge: Bridge, doc: RepoDoc, ctx: Say): { cache: string; trunk: string } {
	const name = String(doc.fm.name);
	const cache = cachePath(doc);
	const remote = origin(bridge, doc);
	const made = !existsSync(cache);
	if (made) {
		mkdirSync(cache, { recursive: true });
		git(cache, "init", "-q", "--bare");
	}
	// So a checkout can push, by naming its target: git push origin HEAD:<ref>.
	git(cache, "config", "remote.origin.url", remote);
	git(cache, "config", "--replace-all", "remote.origin.fetch", BRANCHES);
	git(cache, "config", "--add", "remote.origin.fetch", PACKED);
	const fetched = git(cache, "fetch", "-q", "--prune", "origin");
	if (!fetched.ok) {
		if (made) {
			rmSync(cache, { recursive: true, force: true });
			throw new Error(`cannot fetch ${name} from ${remote}, and there is no cache of it: ${fetched.text}`);
		}
		ctx.err(`nosedive: cannot fetch ${name} from ${remote}, so its cache is used as it is: ${fetched.text}`);
	} else {
		const head = /^ref: refs\/heads\/(\S+)\tHEAD/m.exec(git(cache, "ls-remote", "--symref", "origin", "HEAD").text)?.[1];
		if (head) git(cache, "symbolic-ref", "refs/remotes/origin/HEAD", `refs/remotes/origin/${head}`);
	}

	const trunk = trunkOf(doc, cache);
	const tip = `refs/remotes/origin/${trunk}`;
	if (!git(cache, "rev-parse", "--verify", "-q", tip).ok) throw new Error(`${name} has no branch ${trunk} to check out`);
	// The cache alone owns the trunk, and only ever fast-forwards it.
	const owned = `refs/heads/${trunk}`;
	if (!git(cache, "rev-parse", "--verify", "-q", owned).ok || git(cache, "merge-base", "--is-ancestor", owned, tip).ok) git(cache, "update-ref", owned, tip);
	else ctx.err(`nosedive: ${name}'s cache has a ${trunk} its remote does not, so it was left as it is`);
	return { cache, trunk };
}

/** The repo's `meta.trunk`, else the branch origin's HEAD named when last fetched, else main. */
function trunkOf(doc: RepoDoc, cache: string): string {
	const meta = (doc.fm.meta ?? {}) as { trunk?: unknown };
	if (typeof meta.trunk === "string") return meta.trunk;
	return git(cache, "symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD").text.replace(/^origin\//, "") || "main";
}

/** The repo's origin, a path in it resolved against the bridge. */
function origin(bridge: Bridge, doc: RepoDoc): string {
	const remotes = ((doc.fm.meta as { remotes?: Record<string, unknown> } | undefined)?.remotes ?? {}) as Record<string, unknown>;
	const url = remotes.origin;
	if (typeof url !== "string" || !url) throw new Error(`${String(doc.fm.name)} has no meta.remotes.origin to fetch from`);
	return /^[a-z][a-z0-9+.-]*:\/\/|^git@/i.test(url) || isAbsolute(url) ? url : resolve(bridge.dir, url);
}

function git(cwd: string, ...args: string[]): { ok: boolean; text: string } {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	return { ok: result.status === 0, text: (result.status === 0 ? result.stdout : result.stderr || result.stdout || "").trim() };
}
