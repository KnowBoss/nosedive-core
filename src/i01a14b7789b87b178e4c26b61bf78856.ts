import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { GateCtx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a13c760de87562b4738946402010b8 as checkoutPath } from "./i01a13c760de87562b4738946402010b8.ts";
import { i01a14ac0044f7142a4623b2b7eff2eb5 as homeCopy } from "./i01a14ac0044f7142a4623b2b7eff2eb5.ts";

const BRANCHES = "+refs/heads/*:refs/remotes/origin/*";

export async function i01a14b7789b87b178e4c26b61bf78856(ctx: GateCtx): Promise<void> {
	const { bridge, doc } = ctx;
	const name = String(doc.fm.name);
	if (doc.fm.kind !== "repo") throw new Error(`${name} is a ${String(doc.fm.kind)}, not a repo`);
	const dir = checkoutPath(bridge, name);
	const shown = relative(bridge.dir, dir).replace(/\\/g, "/");
	if (existsSync(dir)) return ctx.out(`${shown}: checked out already`);

	// The cache is the bridge's own; only the workspace holds checkouts, each a worktree of it.
	// A bare repo is named <name>.git, but legacy named its caches by id alone, so one of those serves too.
	const legacy = join(bridge.dir, ".nosedive", "cache", doc.id);
	const cache = existsSync(legacy) ? legacy : `${legacy}.git`;
	if (!existsSync(cache)) {
		mkdirSync(cache, { recursive: true });
		git(cache, "init", "-q", "--bare");
	}
	const source = fetch(ctx, cache, name);

	const meta = (doc.fm.meta ?? {}) as { trunk?: unknown };
	const trunk = typeof meta.trunk === "string" ? meta.trunk : defaultBranch(source);
	if (!git(cache, "rev-parse", "--verify", "-q", `refs/remotes/origin/${trunk}`).ok) throw new Error(`${name} has no branch ${trunk} to check out`);
	const local = git(cache, "rev-parse", "--verify", "-q", `refs/heads/${trunk}`).ok;
	const added = local ? git(cache, "worktree", "add", "-q", dir, trunk) : git(cache, "worktree", "add", "-q", "--no-track", "-b", trunk, dir, `origin/${trunk}`);
	if (!added.ok) throw new Error(`cannot check ${name} out at ${shown}: ${added.text}`);
	ctx.out(`${shown}: worktree of ${trunk} at ${git(dir, "rev-parse", "--short", "HEAD").text}`);
}

/** Fetches the cache from the repo's home copy, else from its first remote; returns where it fetched from. */
function fetch(ctx: GateCtx, cache: string, name: string): string {
	const home = homeCopy(ctx.bridge, name);
	if (home) {
		const fetched = existsSync(home) ? git(cache, "fetch", "-q", "--prune", home, BRANCHES) : { ok: false, text: "it does not exist" };
		if (fetched.ok) return home;
		ctx.err(`nosedive: cannot fetch ${name} from its home copy ${home.replace(/\\/g, "/")}: ${fetched.text}; trying its first remote`);
	}
	const remotes = ((ctx.doc.fm.meta as { remotes?: Record<string, unknown> } | undefined)?.remotes ?? {}) as Record<string, unknown>;
	const first = Object.values(remotes).find((value) => typeof value === "string") as string | undefined;
	if (!first) throw new Error(`${name} has no remote to fetch from`);
	const remote = /^[a-z][a-z0-9+.-]*:\/\/|^git@/i.test(first) || isAbsolute(first) ? first : resolve(ctx.bridge.dir, first);
	const fetched = git(cache, "fetch", "-q", "--prune", remote, BRANCHES);
	if (!fetched.ok) throw new Error(`cannot fetch ${name} from ${first}: ${fetched.text}`);
	return remote;
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
