import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13c760de87562b4738946402010b8 as checkoutPath } from "./i01a13c760de87562b4738946402010b8.ts";

const BRANCHES = "+refs/heads/*:refs/remotes/origin/*";
const PACKED = "+refs/nosedive/*:refs/nosedive/*";
const URL_SHAPED = /^[a-z][a-z0-9+.-]*:\/\/|^git@/i;

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
		return { dir, trunk: trunkOf(doc, cacheOf(bridge, doc, ctx)) };
	}
	const { cache, trunk } = fetchCache(bridge, doc, ctx);

	let added;
	if (feat && branch) {
		if (!gitBare(cache, "rev-parse", "--verify", "-q", `refs/heads/${branch}`).ok) {
			const start = [`refs/remotes/origin/${feat.workBranch}`, `refs/remotes/origin/${trunk}`].find((ref) => gitBare(cache, "rev-parse", "--verify", "-q", ref).ok)!;
			gitBare(cache, "branch", "-q", "--no-track", branch, start);
		}
		gitBare(cache, "config", `branch.${branch}.remote`, "origin");
		gitBare(cache, "config", `branch.${branch}.merge`, `refs/heads/${feat.workBranch}`);
		added = gitBare(cache, "worktree", "add", "-q", dir, branch);
	} else {
		// Detached: no branch, so nothing to push; work is done for a feat.
		added = gitBare(cache, "worktree", "add", "-q", "--detach", dir, `refs/remotes/origin/${trunk}`);
	}
	if (!added.ok) throw new Error(`cannot check ${name} out at ${shown}: ${added.text}`);
	// With per-worktree config on, as legacy caches have it, the cache's core.bare reaches the worktree unless it says otherwise.
	if (gitBare(cache, "config", "--bool", "extensions.worktreeConfig").text === "true") git(dir, "config", "--worktree", "core.bare", "false");
	const at = git(dir, "rev-parse", "--short", "HEAD").text;
	ctx.out(branch ? `${shown}: on ${branch} at ${at}` : `${shown}: detached at ${trunk} ${at}`);
	return { dir, trunk };
}

/** A feat's checkout is named after the hero and its branch too, so checkouts of different hero repos never share a branch in the user's cache. */
function featBranch(bridge: Bridge, featId: string): string {
	const on = git(bridge.dir, "symbolic-ref", "-q", "--short", "HEAD");
	if (!on.ok) throw new Error("the hero is detached, so a feat's checkout has no branch to be named after: put the hero on a branch first");
	return `${bridge.id}/${on.text}/${featId}`;
}

/** `~/.nosedive`, or `NOSEDIVE_USER_DIR` when that is set. */
export function userDir(): string {
	return process.env.NOSEDIVE_USER_DIR || join(homedir(), ".nosedive");
}

// Azure DevOps serves one repo under four spellings; each folds to dev.azure.com/<org>/<project>/<repo>, matched exactly, so a shape not listed keys as itself.
const AZURE = [
	/^dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)$/i,
	/^ssh\.dev\.azure\.com\/v3\/([^/]+)\/([^/]+)\/([^/]+)$/i,
	/^vs-ssh\.visualstudio\.com\/v3\/([^/]+)\/([^/]+)\/([^/]+)$/i,
];
const AZURE_LEGACY = /^([^/.]+)\.visualstudio\.com\/(?:defaultcollection\/)?([^/]+)\/_git\/([^/]+)$/i;

/** A remote as a key that is the same however it is spelled: scheme, user, port, `.git` and trailing slashes gone, the host in lower case, Azure DevOps's spellings as one. */
export function remoteKey(url: string): string {
	let text = url.trim().replace(/\\/g, "/").replace(/\/+$/, "").replace(/\.git$/i, "");
	const scheme = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.*)$/i.exec(text);
	const scp = /^(?:[^@/]+@)?([^:/]{2,}):(?!\/\/)(.*)$/.exec(text);
	const parts = scheme ?? scp;
	if (parts) text = `${parts[1]!.toLowerCase()}/${parts[2]!.replace(/^\/+/, "")}`;
	const azure = AZURE.map((shape) => shape.exec(text)).find(Boolean) ?? AZURE_LEGACY.exec(text);
	// Azure DevOps names are case-insensitive.
	if (azure) text = `dev.azure.com/${azure.slice(1, 4).join("/")}`.toLowerCase();
	return text;
}

/** The key a cache is kept under: the origin's remoteKey, a local path's resolved and, on Windows, in lower case. */
function cacheKey(remote: string): string {
	if (URL_SHAPED.test(remote)) return remoteKey(remote);
	const key = remoteKey(resolve(remote));
	return process.platform === "win32" ? key.toLowerCase() : key;
}

/** Where the user's cache of an origin is kept: named by its key's hash, under its host, `_local` for a path, `_other` for a host that is no plain name. */
export function cachePath(remote: string): string {
	const key = cacheKey(remote);
	const host = key.slice(0, Math.max(key.indexOf("/"), 0));
	// No host name holds `_`, so neither group can be a host's.
	const group = !URL_SHAPED.test(remote) ? "_local" : /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host) ? host : "_other";
	return join(userDir(), "cache", group, `${createHash("sha256").update(key).digest("hex").slice(0, 16)}.git`);
}

/** The user's cache of a repo, shared by every checkout of every hero; one kept the old way, by repo doc id, is moved to its key first. */
function cacheOf(bridge: Bridge, doc: RepoDoc, ctx: Say): string {
	const name = String(doc.fm.name);
	const keyed = cachePath(origin(bridge, doc));
	const legacy = join(userDir(), "cache", `${String(doc.fm.id)}.git`);
	if (!existsSync(legacy)) return keyed;
	if (existsSync(keyed)) {
		ctx.err(`nosedive: ${name}'s old cache at ${legacy} is left as it is, as its cache is at ${keyed} now`);
		return keyed;
	}
	try {
		mkdirSync(dirname(keyed), { recursive: true });
		renameSync(legacy, keyed);
	} catch (error) {
		ctx.err(`nosedive: cannot move ${name}'s cache from ${legacy} to ${keyed}, so it is used where it is: ${error instanceof Error ? error.message : String(error)}`);
		return legacy;
	}
	const repaired = gitBare(keyed, "worktree", "repair");
	if (!repaired.ok) ctx.err(`nosedive: ${name}'s cache moved to ${keyed}, but git could not repair its checkouts, which may still point at ${legacy}: ${repaired.text}`);
	return keyed;
}

/** Fetches the user's cache of a repo from its origin, making the cache when there is none, without checking anything out; returns it and the repo's trunk. */
export function fetchCache(bridge: Bridge, doc: RepoDoc, ctx: Say): { cache: string; trunk: string } {
	const name = String(doc.fm.name);
	const cache = cacheOf(bridge, doc, ctx);
	const remote = origin(bridge, doc);
	const made = !existsSync(cache);
	if (made) {
		mkdirSync(cache, { recursive: true });
		gitBare(cache, "init", "-q", "--bare");
	}
	// A cache says whose it is, so two keys that hash alike never share one.
	const key = cacheKey(remote);
	const held = gitBare(cache, "config", "nosedive.key");
	if (held.ok && held.text !== key) throw new Error(`${name}'s cache at ${cache} holds ${held.text}, not ${key}: move it aside to cache ${name} afresh`);
	if (!held.ok) gitBare(cache, "config", "nosedive.key", key);
	// So a checkout can push, by naming its target: git push origin HEAD:<ref>.
	gitBare(cache, "config", "remote.origin.url", remote);
	gitBare(cache, "config", "--replace-all", "remote.origin.fetch", BRANCHES);
	gitBare(cache, "config", "--add", "remote.origin.fetch", PACKED);
	const fetched = gitBare(cache, "fetch", "-q", "--prune", "origin");
	if (!fetched.ok) {
		if (made) {
			rmSync(cache, { recursive: true, force: true });
			throw new Error(`cannot fetch ${name} from ${remote}, and there is no cache of it: ${fetched.text}`);
		}
		ctx.err(`nosedive: cannot fetch ${name} from ${remote}, so its cache is used as it is: ${fetched.text}`);
	} else {
		const head = /^ref: refs\/heads\/(\S+)\tHEAD/m.exec(gitBare(cache, "ls-remote", "--symref", "origin", "HEAD").text)?.[1];
		if (head) gitBare(cache, "symbolic-ref", "refs/remotes/origin/HEAD", `refs/remotes/origin/${head}`);
	}

	const trunk = trunkOf(doc, cache);
	const tip = `refs/remotes/origin/${trunk}`;
	if (!gitBare(cache, "rev-parse", "--verify", "-q", tip).ok) throw new Error(`${name} has no branch ${trunk} to check out`);
	// The cache alone owns the trunk, and only ever fast-forwards it.
	const owned = `refs/heads/${trunk}`;
	if (!gitBare(cache, "rev-parse", "--verify", "-q", owned).ok || gitBare(cache, "merge-base", "--is-ancestor", owned, tip).ok) gitBare(cache, "update-ref", owned, tip);
	else ctx.err(`nosedive: ${name}'s cache has a ${trunk} its remote does not, so it was left as it is`);
	return { cache, trunk };
}

/** The repo's `meta.trunk`, else the branch origin's HEAD named when last fetched, else main. */
function trunkOf(doc: RepoDoc, cache: string): string {
	const meta = (doc.fm.meta ?? {}) as { trunk?: unknown };
	if (typeof meta.trunk === "string") return meta.trunk;
	return gitBare(cache, "symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD").text.replace(/^origin\//, "") || "main";
}

/** The repo's origin, a path in it resolved against the bridge. */
function origin(bridge: Bridge, doc: RepoDoc): string {
	const remotes = ((doc.fm.meta as { remotes?: Record<string, unknown> } | undefined)?.remotes ?? {}) as Record<string, unknown>;
	const url = remotes.origin;
	if (typeof url !== "string" || !url) throw new Error(`${String(doc.fm.name)} has no meta.remotes.origin to fetch from`);
	return URL_SHAPED.test(url) || isAbsolute(url) ? url : resolve(bridge.dir, url);
}

function git(cwd: string, ...args: string[]): { ok: boolean; text: string } {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	return { ok: result.status === 0, text: (result.status === 0 ? result.stdout : result.stderr || result.stdout || "").trim() };
}

function gitBare(dir: string, ...args: string[]): { ok: boolean; text: string } {
	const result = spawnSync("git", ["--git-dir", dir, ...args], { cwd: dir, encoding: "utf8" });
	return { ok: result.status === 0, text: (result.status === 0 ? result.stdout : result.stderr || result.stdout || "").trim() };
}
