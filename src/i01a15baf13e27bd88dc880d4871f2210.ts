import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13c760de87562b4738946402010b8 as checkoutPath } from "./i01a13c760de87562b4738946402010b8.ts";
import { i01a14ac0044f7142a4623b2b7eff2eb5 as homeCopy } from "./i01a14ac0044f7142a4623b2b7eff2eb5.ts";

const BRANCHES = "+refs/heads/*:refs/remotes/origin/*";

type RepoDoc = { fm: Record<string, unknown> };
type Say = { out(text: string): void; err(text: string): void };

export function i01a15baf13e27bd88dc880d4871f2210(bridge: Bridge, doc: RepoDoc, ctx: Say): { dir: string; trunk: string } {
	const name = String(doc.fm.name);
	const dir = checkoutPath(bridge, name);
	const shown = relative(bridge.dir, dir).replace(/\\/g, "/");
	if (existsSync(dir)) {
		ctx.out(`${shown}: checked out already`);
		const meta = (doc.fm.meta ?? {}) as { trunk?: unknown };
		return { dir, trunk: typeof meta.trunk === "string" ? meta.trunk : defaultBranch(firstRemote(bridge, doc) ?? cachePath(bridge, doc)) };
	}
	const { cache, trunk } = fetchCache(bridge, doc, ctx);
	const tip = `refs/remotes/origin/${trunk}`;

	// Detached: no checkout has a branch of its own, so a bare git push has nowhere to go.
	const added = git(cache, "worktree", "add", "-q", "--detach", dir, tip);
	if (!added.ok) throw new Error(`cannot check ${name} out at ${shown}: ${added.text}`);
	// With per-worktree config on, as legacy caches have it, the cache's core.bare reaches the worktree unless it says otherwise.
	if (git(cache, "config", "--bool", "extensions.worktreeConfig").text === "true") git(dir, "config", "--worktree", "core.bare", "false");
	ctx.out(`${shown}: detached at ${trunk} ${git(dir, "rev-parse", "--short", "HEAD").text}`);
	return { dir, trunk };
}

/** The ship's cache of a repo: a bare repo named <id>.git, or by id alone where legacy left one. */
function cachePath(bridge: Bridge, doc: RepoDoc): string {
	const legacy = join(bridge.dir, ".nosedive", "cache", String(doc.fm.id));
	return existsSync(legacy) ? legacy : `${legacy}.git`;
}

/** Fetches the ship's cache of a repo, making it when there is none, without checking anything out; returns it and the repo's trunk. */
export function fetchCache(bridge: Bridge, doc: RepoDoc, ctx: Say): { cache: string; trunk: string } {
	const name = String(doc.fm.name);
	const cache = cachePath(bridge, doc);
	const meta = (doc.fm.meta ?? {}) as { trunk?: unknown };
	// The cache is the bridge's own; only the workspace holds checkouts, each a worktree of it.
	if (!existsSync(cache)) {
		mkdirSync(cache, { recursive: true });
		git(cache, "init", "-q", "--bare");
	}
	const source = fetch(bridge, doc, ctx, cache, name);

	const trunk = typeof meta.trunk === "string" ? meta.trunk : defaultBranch(source);
	const tip = `refs/remotes/origin/${trunk}`;
	if (!git(cache, "rev-parse", "--verify", "-q", tip).ok) throw new Error(`${name} has no branch ${trunk} to check out`);
	// The cache alone owns the trunk, and only ever fast-forwards it.
	const owned = `refs/heads/${trunk}`;
	if (!git(cache, "rev-parse", "--verify", "-q", owned).ok || git(cache, "merge-base", "--is-ancestor", owned, tip).ok) git(cache, "update-ref", owned, tip);
	else ctx.err(`nosedive: ${name}'s cache has a ${trunk} its remote does not, so it was left as it is`);
	// So a checkout can push, by naming its target: git push origin HEAD:<branch>.
	const remote = firstRemote(bridge, doc);
	if (remote && !git(cache, "config", "remote.origin.url").text) {
		git(cache, "config", "remote.origin.url", remote);
		git(cache, "config", "remote.origin.fetch", BRANCHES);
	}
	return { cache, trunk };
}

/** Fetches the cache from the repo's home copy, else from its first remote; returns where it fetched from. */
function fetch(bridge: Bridge, doc: RepoDoc, ctx: Say, cache: string, name: string): string {
	const home = homeCopy(bridge, name);
	if (home) {
		const fetched = existsSync(home) ? git(cache, "fetch", "-q", "--prune", home, BRANCHES) : { ok: false, text: "it does not exist" };
		if (fetched.ok) return home;
		ctx.err(`nosedive: cannot fetch ${name} from its home copy ${home.replace(/\\/g, "/")}: ${fetched.text}; trying its first remote`);
	}
	const remote = firstRemote(bridge, doc);
	if (!remote) throw new Error(`${name} has no remote to fetch from`);
	const fetched = git(cache, "fetch", "-q", "--prune", remote, BRANCHES);
	if (!fetched.ok) throw new Error(`cannot fetch ${name} from ${remote}: ${fetched.text}`);
	return remote;
}

/** The repo's first remote, a path in it resolved against the bridge. */
function firstRemote(bridge: Bridge, doc: RepoDoc): string | undefined {
	const remotes = ((doc.fm.meta as { remotes?: Record<string, unknown> } | undefined)?.remotes ?? {}) as Record<string, unknown>;
	const first = Object.values(remotes).find((value) => typeof value === "string") as string | undefined;
	if (!first) return undefined;
	return /^[a-z][a-z0-9+.-]*:\/\/|^git@/i.test(first) || isAbsolute(first) ? first : resolve(bridge.dir, first);
}

/** The branch a source's HEAD names, else main. */
function defaultBranch(source: string): string {
	const head = spawnSync("git", ["ls-remote", "--symref", source, "HEAD"], { encoding: "utf8" });
	return /^ref: refs\/heads\/(\S+)\tHEAD/m.exec(head.stdout ?? "")?.[1] ?? "main";
}

function git(cwd: string, ...args: string[]): { ok: boolean; text: string } {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	return { ok: result.status === 0, text: (result.status === 0 ? result.stdout : result.stderr || result.stdout || "").trim() };
}
