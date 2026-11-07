import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Cape, CapeDoc } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1335487e477549d84a6fc2c901bf6 as describeCapeSource, uncanonicalDocs } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { i01a1335488937f1c8c3983dd2950028e as checkCapeSource } from "./i01a1335488937f1c8c3983dd2950028e.ts";
import { i01a151913e5772088ae93b14a4a3f120 as installCapePackages } from "./i01a151913e5772088ae93b14a4a3f120.ts";
import { i01a14fb7a14b7f85b7dc8bb894d6e76b as bundleCape } from "./i01a14fb7a14b7f85b7dc8bb894d6e76b.ts";
import { i01a1337c806075ca96d637c9ece7316e as capeId } from "./i01a1337c806075ca96d637c9ece7316e.ts";
import { i01a1337c810a7456876b831d0c873396 as capeManifest, type CapeBuild } from "./i01a1337c810a7456876b831d0c873396.ts";
import { i01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./i01a1337d2c14754f9772dc22c1f2edfc.ts";
import { wornCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";
import { i01a14fb092177d36a478d40a47166c97 as gateUsage } from "./i01a14fb092177d36a478d40a47166c97.ts";

const COMMIT = /^[0-9a-f]{40}$/;
const CORE = "nosedive-core";
const BARE_IMPORT = /import\s*\{([^}]*)\}\s*from\s*["']([^"'./][^"']*)["']/g;

/** `dir` is where a local cape lies in the hero, which it is built from as a workspace checkout is. */
type Repo = { id: string; name: string; remote: string; dir?: string };
/** What a cape imports from one source: core, or another cape, with the doc ids it uses. */
type Source = { specifier: string; capeId: string; label: string; docs: Record<string, CapeDoc>; ids: Set<string>; names: Set<string> };

/** Builds the cape unless it exists already; `fresh` says which. */
export async function i01a1337c81b57799820f96a757b791d0(
	bridge: Bridge,
	repo: Repo,
	ref: string,
	core: Cape,
	building: string[] = [],
	log: (message: string) => void = () => {},
): Promise<CapeBuild & { fresh: boolean }> {
	if (building.includes(repo.name)) throw new Error(`capes import each other in a cycle: ${[...building, repo.name].join(" -> ")}`);
	const local = repo.dir ?? (bridge.workspace ? join(bridge.workspace, repo.name) : undefined);
	const workspace = local !== undefined && existsSync(local);
	const dir = workspace ? local : join(bridge.dir, ".nosedive", "capes", "src", repo.id);
	let commit: string;
	if (workspace) {
		log(`cape ${repo.name}: using ${repo.dir ? "local cape" : "workspace checkout"} ${dir}`);
		commit = git(dir, "rev-parse", "HEAD");
	} else {
		if (existsSync(dir)) {
			// The repo doc says where the cape is now; a clone keeps whatever origin it was made with.
			git(dir, "remote", "set-url", "origin", repo.remote);
			git(dir, "fetch", "-q", "origin");
		} else git(bridge.dir, "clone", "-q", repo.remote, dir);
		const target = COMMIT.test(ref) ? ref : `origin/${ref || trunk(dir)}`;
		commit = git(dir, "rev-parse", `${target}^{commit}`);
		git(dir, "checkout", "-q", "--detach", commit);
	}

	const root = findRoot(dir, "cape") ?? findRoot(dir);
	const bare = uncanonicalDocs(dir);
	if (bare > 0 || (root?.fm.kind === "cape" && root.kind !== "cape")) {
		throw new Error(`${repo.name} at ${commit.slice(0, 7)} predates canonical kinds: its ${bare} action/function docs and root do not name core; seed it with this core (the canonical-kinds migration) and push`);
	}
	if (root?.kind !== "cape") throw new Error(`${repo.name} is not a cape: ${root ? `its root is a ${root.kind}` : "it has no root"}`);
	const problems = checkCapeSource(dir);
	if (problems.length > 0) throw new Error(`${repo.name} at ${commit.slice(0, 7)} does not check out:\n  ${problems.join("\n  ")}`);
	// Its kinds are recorded with their versions, so a hero wearing it can name them in its docs.
	const source = describeCapeSource(dir, false, true);
	// A kind's durability is read from its doc's Done when now, so a kind doc still saying durable is from before that, and would be misread.
	const flagged = Object.entries(source.kinds).filter(([, declared]) => declared !== null && typeof declared === "object" && "durable" in declared).map(([name]) => name);
	if (flagged.length > 0) {
		throw new Error(`${repo.name} at ${commit.slice(0, 7)} predates durability read from Done when: its kind${flagged.length === 1 ? "" : "s"} ${flagged.join(", ")} still say${flagged.length === 1 ? "s" : ""} meta.durable; seed it with this core (the durable-from-done-when migration) and push`);
	}
	const owner = readRepoConfig(dir)?.id;
	const shortName = String(root.fm.name);

	const { sources, needs } = await capeImports(bridge, dir, repo.name, source, core, building, log);

	// A local cape lives in the hero's git, whose every commit would otherwise make it a new build.
	const hash = createHash("sha256").update(repo.dir ? "" : commit);
	if (workspace) {
		for (const file of git(dir, "ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean).sort()) {
			hash.update(`\0${file}\0`);
			if (existsSync(join(dir, file))) hash.update(readFileSync(join(dir, file)));
			else hash.update("deleted");
		}
	}
	const id = capeId(repo.id, workspace ? hash.digest("hex") : commit, core.id, Object.values(needs));
	const outfile = join(bridge.dir, ".nosedive", "capes", `${id}.js`);
	const known = capeManifest(bridge.dir).find((build) => build.id === id);
	if (known && existsSync(outfile)) {
		const selected = { ...known, ref, builtAt: new Date().toISOString() };
		capeManifest(bridge.dir, selected);
		return { ...selected, fresh: false };
	}

	const seconds = Number(git(dir, "log", "-1", "--format=%ct", commit));
	const date = new Date(seconds * 1000);
	const millis = seconds * 1000 + (Number.parseInt(commit.slice(0, 3), 16) % 1000);
	const version = workspace ? "working tree" : `${date.getUTCFullYear()}.${date.getUTCMonth() + 1}.${date.getUTCDate()}-${millis}`;

	installCapePackages(dir);
	await bundleCape(dir, source, { id, owner, shortName, name: repo.name, commit, version, core: core.id, needs }, sources, outfile);

	const actions = Object.fromEntries(
		Object.values(source.docs)
			.filter((doc) => doc.top && doc.kind === "action" && !gateUsage(doc.usages[0]?.text ?? ""))
			.map((doc) => [doc.name, doc.gist]),
	);
	const build = { id, owner, shortName, repo: repo.id, ref, commit, core: core.id, coreVersion: core.version, actions, kinds: source.kinds, needs, version, builtAt: new Date().toISOString(), ...(workspace ? { source: dir } : {}) };
	capeManifest(bridge.dir, build);
	return { ...build, fresh: true };
}

/**
 * What a cape's source, or a hero's own actions, import, ready to bundle: core with the ids and names taken, and each cape
 * imported built first at the ref this bridge uses for it; refuses an import its target lacks or its docs do not link.
 * Builds of capes and of a hero's own actions both go through it, so both take the same imports (one-build-path).
 */
export async function capeImports(
	bridge: Bridge,
	dir: string,
	name: string,
	source: { docs: Record<string, { text: string }> },
	core: Cape,
	building: string[],
	log: (text: string) => void,
): Promise<{ sources: Source[]; needs: Record<string, string> }> {
	const sources = new Map<string, Source>();
	const needs: Record<string, string> = {};
	for (const [specifier, { ids, names }] of bareImports(dir)) {
		if (specifier === CORE) {
			sources.set(specifier, { specifier, capeId: core.id, label: `core ${core.version}`, docs: core.docs, ids, names });
			continue;
		}
		const dependency = tryFindRepoDoc(bridge, specifier);
		if (!dependency) continue;
		const built = await i01a1337c81b57799820f96a757b791d0(bridge, dependency, refFor(bridge, specifier), core, [...building, name], log);
		const docs = describeCapeSource(built.source ?? join(bridge.dir, ".nosedive", "capes", "src", dependency.id)).docs;
		sources.set(specifier, { specifier, capeId: built.id, label: `${specifier} ${built.version}`, docs, ids, names });
		needs[specifier] = built.id;
	}
	const linked = Object.values(source.docs).flatMap((doc) => linksOf(doc.text));
	for (const { specifier, label, docs, ids, names } of sources.values()) {
		for (const imported of names) {
			if (specifier === CORE && core.named && !(imported in core.named)) throw new Error(`${name} imports ${imported} from ${specifier}, which ${label} does not export`);
		}
		for (const id of ids) {
			if (!docs[id]) throw new Error(`${name} imports ${id} from ${specifier}, which ${label} does not have`);
			if (!linked.some((link) => link.includes(id))) {
				throw new Error(`${name} imports ${docs[id]!.name} (${id}) without linking it from its action doc`);
			}
		}
	}
	return { sources: [...sources.values()], needs };
}

/** Every bare specifier a cape's source imports values from, with the action ids and the other names it takes. */
function bareImports(dir: string): Map<string, { ids: Set<string>; names: Set<string> }> {
	const found = new Map<string, { ids: Set<string>; names: Set<string> }>();
	// Tests sit beside the code but are never bundled, so what they import is no import of the cape's.
	for (const file of readdirSync(join(dir, "src")).filter((name) => !name.endsWith(".test.ts"))) {
		const text = readFileSync(join(dir, "src", file), "utf8");
		for (const match of text.matchAll(BARE_IMPORT)) {
			const specifier = match[2]!;
			for (const part of match[1]!.split(",")) {
				const name = part.trim().split(/\s+as\s+/)[0]!.trim();
				const hex = /^i([0-9a-f]{32})$/.exec(name)?.[1];
				if (!name || name.startsWith("type ")) continue;
				if (!found.has(specifier)) found.set(specifier, { ids: new Set(), names: new Set() });
				if (!hex) {
					// Only core hands out names besides its actions.
					if (specifier === CORE) found.get(specifier)!.names.add(name);
					continue;
				}
				found.get(specifier)!.ids.add(`${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`);
			}
		}
	}
	return found;
}

/** The ref this bridge uses for a repo: the one its base's .cape link pins, or the trunk. */
function refFor(bridge: Bridge, repo: string): string {
	return wornCapes(bridge).find((cape) => cape.name === repo)?.ref ?? "";
}

function tryFindRepoDoc(bridge: Bridge, name: string): Repo | undefined {
	try {
		return findRepoDoc(bridge, name);
	} catch {
		return undefined;
	}
}

function linksOf(text: string): string[] {
	return [...text.matchAll(/^ {2}- (\S+?):\s*$/gm)].map((match) => match[1]!);
}

function trunk(dir: string): string {
	const head = spawnSync("git", ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], { cwd: dir, encoding: "utf8" });
	return head.status === 0 ? head.stdout.trim().replace(/^origin\//, "") : "main";
}

function git(cwd: string, ...args: string[]): string {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${(result.stderr || result.stdout).trim()}`);
	return result.stdout.trim();
}
