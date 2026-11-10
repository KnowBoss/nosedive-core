import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { parse } from "yaml";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge, type Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { scopeEntries } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import { fetchCache, remoteKey, userDir } from "./i01a15baf13e27bd88dc880d4871f2210.ts";

const QUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RepoDoc = ReturnType<typeof listKbDocs>[number];
/** One repo to dock: where, from which cache, and at what. A hero dock is on `branch`; any other is detached at `commit`. */
type Plan = { name: string; at: string; cache: string; trunk: string; branch?: string; shown: string; commit: string; note?: string };

/** Docks what `ref` finds; given `head`, every repo read-only at it. */
export async function i9dfd0b735ec95af1948f2b3311749c52(ref: string, head: string | undefined, ctx: Ctx): Promise<void> {
	const hero = findBridge(ctx.cwd);
	if (!hero?.id) throw new Error("dock runs in a hero");
	const primary = hero.roots.find((root) => root.id === hero.root);
	const docker = primary && findKbDoc(primary.dir, primary.id)?.fm.name;
	if (typeof docker !== "string" || !docker) throw new Error("the hero's primary root has no name to keep its docks under");
	const repos = hero.reposDir && existsSync(hero.reposDir) ? listKbDocs(hero.reposDir) : [];

	const found = find(hero, repos, ref);
	const wanted = found.repo ? [{ doc: found.repo, workBranch: undefined }] : scoped(found.feat!, repos);
	const plans = wanted.map(({ doc, workBranch }) => plan(hero, doc, join(userDir(), "docks", docker, String(doc.fm.name)), { head, workBranch, feat: !found.repo }, ctx));
	// Every dock is checked before any is moved, so a refusal moves none.
	const refused = plans.flatMap(refusal);
	if (refused.length > 0) throw new Error(refused.join("\n"));
	for (const each of plans) place(each, ctx);
}

/** A quid's repo doc, else its doc as a feat; then the repo doc a remote or a name finds. */
function find(hero: Bridge, repos: RepoDoc[], ref: string): { repo?: RepoDoc; feat?: ReturnType<typeof locateKbDoc> } {
	if (QUID.test(ref)) {
		const id = ref.toLowerCase();
		const repo = repos.find((doc) => doc.fm.id === id);
		if (repo) return { repo };
		const feat = locateKbDoc(hero, id);
		if (feat) return { feat };
	}
	const key = remoteKey(ref);
	const origin = (doc: RepoDoc) => (doc.fm.meta as { remotes?: { origin?: unknown } } | undefined)?.remotes?.origin;
	for (const found of [repos.filter((doc) => typeof origin(doc) === "string" && remoteKey(origin(doc) as string) === key), repos.filter((doc) => doc.fm.name === ref)]) {
		if (found.length > 1) throw new Error(`${ref} names ${found.length} repo docs, ${found.map((doc) => String(doc.fm.name)).join(" and ")}: dock one by its quid`);
		if (found.length === 1) return { repo: found[0] };
	}
	throw new Error(`no repo doc or doc of the hero's is ${ref}`);
}

/**
 * A feat's repos, by its scope entries keyed by repo doc quid. An entry for a kind's owner, keyed by a seeded id and carrying
 * `canonical`, `version`, `schema` or `meta` (kind-model), names no repo, so it is passed over.
 */
function scoped(feat: NonNullable<ReturnType<typeof locateKbDoc>>, repos: RepoDoc[]): { doc: RepoDoc; workBranch: string | undefined }[] {
	const label = `${String(feat.fm.kind)} ${String(feat.fm.name)}`;
	const wanted = [...scopeEntries(feat.fm.scopes)].flatMap(([key, entry]) => {
		const doc = repos.find((repo) => repo.fm.id === key.toLowerCase());
		if (doc) return [{ doc, workBranch: typeof entry["work-branch"] === "string" ? entry["work-branch"] : undefined }];
		if (["canonical", "version", "schema", "meta"].some((field) => field in entry)) return [];
		throw new Error(`${label} scopes ${key}, which is no repo doc of the hero's`);
	});
	if (wanted.length === 0) throw new Error(`${label} has no scopes naming a repo, so there is nothing to dock`);
	return wanted;
}

function plan(hero: Bridge, doc: RepoDoc, at: string, { head, workBranch, feat }: { head?: string; workBranch?: string; feat: boolean }, ctx: Ctx): Plan {
	const name = String(doc.fm.name);
	const { cache, trunk } = fetchCache(hero, doc, ctx);
	const commit = (rev: string) => git(cache, "rev-parse", "--verify", "-q", `${rev}^{commit}`);
	const base = { name, at, cache, trunk };
	if (head !== undefined) {
		const branch = commit(`refs/remotes/origin/${head}`);
		const rev = branch.ok ? branch : commit(head);
		if (!rev.ok) throw new Error(`${name} has no ${head} to dock`);
		return { ...base, shown: branch.ok ? `origin/${head}` : head, commit: rev.text };
	}
	let note: string | undefined;
	if (workBranch !== undefined) {
		const branch = commit(`refs/remotes/origin/${workBranch}`);
		if (branch.ok) return { ...base, shown: `origin/${workBranch}`, commit: branch.text };
		note = `dock: ${name}'s remote has no branch ${workBranch}, so it is docked at ${trunk}`;
	}
	const tip = `refs/remotes/origin/${trunk}`;
	const docked = { ...base, shown: `origin/${trunk}`, commit: commit(tip).text, note };
	// A hero in a feat's scopes is docked read-only, as the feat's work is read there (dock-read-only-detached).
	return !feat && holdsHero(cache, tip) ? { ...docked, branch: `${hero.id}/dock` } : docked;
}

/** Whether a commit's config names a primary root of kind hero: the root whose quid is its `id`, else its first. */
function holdsHero(cache: string, tip: string): boolean {
	const config = git(cache, "show", `${tip}:.nosedive/config.yaml`);
	if (!config.ok) return false;
	let parsed: { id?: unknown; roots?: unknown };
	try {
		parsed = (parse(config.text) ?? {}) as typeof parsed;
	} catch {
		return false;
	}
	const roots = (Array.isArray(parsed.roots) ? parsed.roots : []).filter((path): path is string => typeof path === "string");
	const primary = roots.find((path) => typeof parsed.id === "string" && path.toLowerCase().endsWith(`${parsed.id.toLowerCase()}.md`)) ?? roots[0];
	if (!primary) return false;
	const root = git(cache, "show", `${tip}:${posix.normalize(primary)}`);
	if (!root.ok) return false;
	try {
		const kind = readKbDoc(root.text, primary).fm.kind;
		return typeof kind === "string" && /^(?:.*:)?hero$/.test(kind);
	} catch {
		return false;
	}
}

/** Why the dock at a plan's path cannot be moved there, if it cannot. */
function refusal({ name, at, cache, branch }: Plan): string[] {
	if (!existsSync(at)) return [];
	const common = git(at, "rev-parse", "--path-format=absolute", "--git-common-dir");
	if (!common.ok || !same(common.text, cache)) return [`${at} is there already and is no dock of ${name}: move it first`];
	const on = git(at, "symbolic-ref", "-q", "--short", "HEAD");
	if (branch) return on.text === branch ? [] : [`${at} is ${on.ok ? `on ${on.text}` : "detached"}, not on ${branch} as a dock of a hero is: move it first`];
	if (on.ok) return [`${at} is on ${on.text}, not detached as a read-only dock is: move it first`];
	const files = [...git(at, "diff", "--name-only", "HEAD").text.split("\n"), ...git(at, "ls-files", "--others", "--exclude-standard").text.split("\n")].filter(Boolean);
	return files.length > 0 ? [`${at} has changed or untracked files, so it was not moved: ${[...new Set(files)].join(", ")}`] : [];
}

function place({ name, at, cache, trunk, branch, shown, commit, note }: Plan, ctx: Ctx): void {
	if (note) ctx.err(note);
	const there = existsSync(at);
	if (branch) {
		// A dock's branch is not named as trunk is, so a plain push goes to its upstream.
		git(cache, "config", "push.default", "upstream");
		const tip = `refs/remotes/origin/${trunk}`;
		if (there) {
			const ff = git(at, "merge", "-q", "--ff-only", tip);
			if (!ff.ok) ctx.err(`dock: ${at} cannot be fast-forwarded to origin/${trunk}, so it was left as it is: ${ff.text}`);
		} else {
			if (!git(cache, "rev-parse", "--verify", "-q", `refs/heads/${branch}`).ok) must(git(cache, "branch", "-q", "--no-track", branch, tip), `cannot make ${branch}`);
			git(cache, "config", `branch.${branch}.remote`, "origin");
			git(cache, "config", `branch.${branch}.merge`, `refs/heads/${trunk}`);
			add(cache, at, name, [at, branch]);
		}
		ctx.out(`${at}: on ${branch} at ${short(at)}\nnosedive seed there builds its capes`);
		return;
	}
	if (there) must(git(at, "checkout", "-q", "--detach", commit), `cannot move ${at} to ${shown}`);
	else add(cache, at, name, ["--detach", at, commit]);
	ctx.out(`${at}: detached at ${shown} ${short(at)}`);
}

/** A worktree of the cache, outside the hero, so a session at the dock reads none of its CLAUDE.md (dock-by-docker). */
function add(cache: string, at: string, name: string, args: string[]): void {
	git(cache, "worktree", "prune");
	mkdirSync(dirname(at), { recursive: true });
	must(git(cache, "worktree", "add", "-q", ...args), `cannot check ${name} out at ${at}`);
	// As hydrate does: with per-worktree config on, the cache's core.bare reaches the worktree unless it says otherwise.
	if (git(cache, "config", "--bool", "extensions.worktreeConfig").text === "true") git(at, "config", "--worktree", "core.bare", "false");
}

function short(at: string): string {
	return git(at, "rev-parse", "--short", "HEAD").text;
}

function same(a: string, b: string): boolean {
	const real = (path: string) => {
		const text = realpathSync.native(path).replace(/\\/g, "/");
		return process.platform === "win32" ? text.toLowerCase() : text;
	};
	return existsSync(a) && existsSync(b) && real(a) === real(b);
}

function must(result: { ok: boolean; text: string }, what: string): void {
	if (!result.ok) throw new Error(`${what}: ${result.text}`);
}

function git(cwd: string, ...args: string[]): { ok: boolean; text: string } {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	return { ok: result.status === 0, text: (result.status === 0 ? result.stdout : result.stderr || result.stdout || "").trim() };
}
