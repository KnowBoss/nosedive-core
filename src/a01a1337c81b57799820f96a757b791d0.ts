import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Cape, CapeDoc } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import type { Bridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./a01a1335480147d0686528aee80f8ee34.ts";
import { a01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "./a01a1335487e477549d84a6fc2c901bf6.ts";
import { a01a1335488937f1c8c3983dd2950028e as checkCapeSource } from "./a01a1335488937f1c8c3983dd2950028e.ts";
import { a01a133588c7971b5b116d9c8c1706e04 as capeIndex } from "./a01a133588c7971b5b116d9c8c1706e04.ts";
import { a01a1337c806075ca96d637c9ece7316e as capeId } from "./a01a1337c806075ca96d637c9ece7316e.ts";
import { a01a1337c810a7456876b831d0c873396 as capeManifest, type CapeBuild } from "./a01a1337c810a7456876b831d0c873396.ts";
import { a01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./a01a1337d2c14754f9772dc22c1f2edfc.ts";

const COMMIT = /^[0-9a-f]{40}$/;
const CORE = "nosedive-core";
const BARE_IMPORT = /import\s*\{([^}]*)\}\s*from\s*["']([^"'./][^"']*)["']/g;

type Repo = { id: string; name: string; remote: string };
/** What a cape imports from one source: core, or another cape, with the doc ids it uses. */
type Source = { specifier: string; capeId: string; label: string; docs: Record<string, CapeDoc>; ids: Set<string> };

/** Builds the cape unless it exists already; `fresh` says which. */
export async function a01a1337c81b57799820f96a757b791d0(
	bridge: Bridge,
	repo: Repo,
	ref: string,
	core: Cape,
	building: string[] = [],
): Promise<CapeBuild & { fresh: boolean }> {
	if (building.includes(repo.name)) throw new Error(`capes import each other in a cycle: ${[...building, repo.name].join(" -> ")}`);
	const dir = join(bridge.dir, ".nosedive", "capes", "src", repo.id);
	if (existsSync(dir)) git(dir, "fetch", "-q", "origin");
	else git(bridge.dir, "clone", "-q", repo.remote, dir);
	const target = COMMIT.test(ref) ? ref : `origin/${ref || trunk(dir)}`;
	const commit = git(dir, "rev-parse", `${target}^{commit}`);
	git(dir, "checkout", "-q", "--detach", commit);

	const problems = checkCapeSource(dir);
	if (problems.length > 0) throw new Error(`${repo.name} at ${commit.slice(0, 7)} does not check out:\n  ${problems.join("\n  ")}`);
	const source = describeCapeSource(dir);

	// Each cape it imports is built first, at the ref this bridge uses for it.
	const sources = new Map<string, Source>();
	const needs: Record<string, string> = {};
	for (const [specifier, ids] of bareImports(dir)) {
		if (specifier === CORE) {
			sources.set(specifier, { specifier, capeId: core.id, label: `core ${core.version}`, docs: core.docs, ids });
			continue;
		}
		const dependency = tryFindRepoDoc(bridge, specifier);
		if (!dependency) continue;
		const built = await a01a1337c81b57799820f96a757b791d0(bridge, dependency, refFor(bridge, specifier), core, [...building, repo.name]);
		const docs = describeCapeSource(join(bridge.dir, ".nosedive", "capes", "src", dependency.id)).docs;
		sources.set(specifier, { specifier, capeId: built.id, label: `${specifier} ${built.version}`, docs, ids });
		needs[specifier] = built.id;
	}
	const linked = Object.values(source.docs).flatMap((doc) => linksOf(doc.text));
	for (const { specifier, label, docs, ids } of sources.values()) {
		for (const id of ids) {
			if (!docs[id]) throw new Error(`${repo.name} imports ${id} from ${specifier}, which ${label} does not have`);
			if (!linked.some((link) => link.includes(id))) {
				throw new Error(`${repo.name} imports ${docs[id]!.name} (${id}) without linking it from its action doc`);
			}
		}
	}

	const id = capeId(repo.id, commit, core.id, Object.values(needs));
	const outfile = join(bridge.dir, ".nosedive", "capes", `${id}.js`);
	const known = capeManifest(bridge.dir).find((build) => build.id === id);
	if (known && existsSync(outfile)) return { ...known, fresh: false };

	const seconds = Number(git(dir, "log", "-1", "--format=%ct", commit));
	const date = new Date(seconds * 1000);
	const millis = seconds * 1000 + (Number.parseInt(commit.slice(0, 3), 16) % 1000);
	const version = `${date.getUTCFullYear()}.${date.getUTCMonth() + 1}.${date.getUTCDate()}-${millis}`;

	const { names, entries } = capeIndex(source, id);
	const buildDir = join(dir, ".capebuild");
	rmSync(buildDir, { recursive: true, force: true });
	mkdirSync(buildDir);
	const toEntry = (file: string) => `./${relative(buildDir, file).replace(/\\/g, "/")}`;
	writeFileSync(
		join(buildDir, "entry.ts"),
		[
			...Object.values(entries).map((entry) => `import { ${entry.name} } from ${JSON.stringify(toEntry(entry.file))};`),
			`export const id = ${JSON.stringify(id)};`,
			`export const name = ${JSON.stringify(repo.name)};`,
			`export const commit = ${JSON.stringify(commit)};`,
			`export const version = ${JSON.stringify(version)};`,
			`export const core = ${JSON.stringify(core.id)};`,
			`export const needs = ${JSON.stringify(needs)};`,
			`export const docs = ${JSON.stringify(source.docs)};`,
			"export const index = {",
			...Object.entries(names).map(([key, docId]) => `\t${JSON.stringify(key)}: ${JSON.stringify(docId)},`),
			...Object.entries(entries).map(([key, entry]) => `\t${JSON.stringify(key)}: ${entry.name},`),
			"};",
			"",
		].join("\n"),
	);

	const esbuild = await import("esbuild").catch(() => {
		throw new Error("building capes needs esbuild: install it next to nosedive (`npm install esbuild`)");
	});
	const rebuild = `${repo.name} was built against other capes than these: run \`nosedive seed\``;
	const shim = ({ specifier, capeId: from, ids }: Source) =>
		[
			specifier === CORE
				? "const from = globalThis.__nosediveCore;"
				: `const from = globalThis.__nosediveCapes?.[${JSON.stringify(from)}];`,
			`if (from?.id !== ${JSON.stringify(from)}) throw new Error(${JSON.stringify(rebuild)});`,
			...[...ids].map((docId) => `export const a${docId.replace(/-/g, "")} = from.index[${JSON.stringify(namespacedUuid(docId, from))}];`),
		].join("\n");
	await esbuild.build({
		entryPoints: [join(buildDir, "entry.ts")],
		bundle: true,
		platform: "node",
		format: "esm",
		target: "node24",
		outfile,
		logLevel: "warning",
		plugins: [
			{
				name: "nosedive-capes",
				setup(build) {
					build.onResolve({ filter: /^[^./]/ }, (args) => (sources.has(args.path) ? { path: args.path, namespace: "cape" } : undefined));
					build.onLoad({ filter: /.*/, namespace: "cape" }, (args) => ({ contents: shim(sources.get(args.path)!), loader: "js" }));
				},
			},
		],
	});
	rmSync(buildDir, { recursive: true, force: true });

	const build = { id, repo: repo.id, ref, commit, core: core.id, needs, version, builtAt: new Date().toISOString() };
	capeManifest(bridge.dir, build);
	return { ...build, fresh: true };
}

/** Every bare specifier a cape's source imports values from, with the action ids it names. */
function bareImports(dir: string): Map<string, Set<string>> {
	const found = new Map<string, Set<string>>();
	for (const file of readdirSync(join(dir, "src"))) {
		const text = readFileSync(join(dir, "src", file), "utf8");
		for (const match of text.matchAll(BARE_IMPORT)) {
			const specifier = match[2]!;
			for (const part of match[1]!.split(",")) {
				const name = part.trim().split(/\s+as\s+/)[0]!.trim();
				const hex = /^a([0-9a-f]{32})$/.exec(name)?.[1];
				if (!hex) continue;
				if (!found.has(specifier)) found.set(specifier, new Set());
				found.get(specifier)!.add(`${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`);
			}
		}
	}
	return found;
}

/** The ref this bridge uses for a repo: the one its config names, or the trunk. */
function refFor(bridge: Bridge, repo: string): string {
	const specs = Object.values((bridge.config.actions ?? {}) as Record<string, unknown>).filter(
		(spec): spec is string => typeof spec === "string" && spec.split("@")[0] === repo,
	);
	const refs = [...new Set(specs.map((spec) => spec.split("@", 2)[1] ?? ""))];
	if (refs.length > 1) throw new Error(`config names ${repo} at more than one ref: ${refs.map((ref) => ref || "trunk").join(", ")}`);
	return refs[0] ?? "";
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
