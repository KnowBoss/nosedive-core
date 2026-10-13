import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Cape } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import type { Bridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./a01a1335480147d0686528aee80f8ee34.ts";
import { a01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "./a01a1335487e477549d84a6fc2c901bf6.ts";
import { a01a1335488937f1c8c3983dd2950028e as checkCapeSource } from "./a01a1335488937f1c8c3983dd2950028e.ts";
import { a01a133588c7971b5b116d9c8c1706e04 as capeIndex } from "./a01a133588c7971b5b116d9c8c1706e04.ts";
import { a01a1337c806075ca96d637c9ece7316e as capeId } from "./a01a1337c806075ca96d637c9ece7316e.ts";
import { a01a1337c810a7456876b831d0c873396 as capeManifest, type CapeBuild } from "./a01a1337c810a7456876b831d0c873396.ts";

const COMMIT = /^[0-9a-f]{40}$/;
const CORE_IMPORT = /import\s*\{([^}]*)\}\s*from\s*["']nosedive-core["']/g;

export async function a01a1337c81b57799820f96a757b791d0(
	bridge: Bridge,
	repo: { id: string; name: string; remote: string },
	ref: string,
	core: Cape,
): Promise<CapeBuild> {
	const dir = join(bridge.dir, ".nosedive", "capes", "src", repo.id);
	if (existsSync(dir)) git(dir, "fetch", "-q", "origin");
	else git(bridge.dir, "clone", "-q", repo.remote, dir);
	const target = COMMIT.test(ref) ? ref : `origin/${ref || trunk(dir)}`;
	const commit = git(dir, "rev-parse", `${target}^{commit}`);
	git(dir, "checkout", "-q", "--detach", commit);

	const problems = checkCapeSource(dir);
	if (problems.length > 0) throw new Error(`${repo.name} at ${commit.slice(0, 7)} does not check out:\n  ${problems.join("\n  ")}`);
	const source = describeCapeSource(dir);
	const imports = coreImports(dir, source, core, repo.name);

	const id = capeId(repo.id, commit, core.id);
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
	const shim = [
		"const core = globalThis.__nosediveCore;",
		`if (core?.id !== ${JSON.stringify(core.id)}) throw new Error(${JSON.stringify(`${repo.name} was built for core ${core.version}: run \`nosedive seed\``)});`,
		...imports.map((docId) => `export const a${docId.replace(/-/g, "")} = core.index[${JSON.stringify(namespacedUuid(docId, core.id))}];`),
	].join("\n");
	await esbuild.build({
		entryPoints: [join(buildDir, "entry.ts")],
		bundle: true,
		platform: "node",
		format: "esm",
		target: "node24",
		outfile: join(bridge.dir, ".nosedive", "capes", `${id}.js`),
		logLevel: "warning",
		plugins: [
			{
				name: "nosedive-core",
				setup(build) {
					build.onResolve({ filter: /^nosedive-core$/ }, () => ({ path: "nosedive-core", namespace: "nosedive-core" }));
					build.onLoad({ filter: /.*/, namespace: "nosedive-core" }, () => ({ contents: shim, loader: "js" }));
				},
			},
		],
	});
	rmSync(buildDir, { recursive: true, force: true });

	const build = { id, repo: repo.id, ref, commit, core: core.id, version, builtAt: new Date().toISOString() };
	capeManifest(bridge.dir, build);
	return build;
}

/** The core docs a cape imports, each checked against the running core and the cape's own links. */
function coreImports(dir: string, source: ReturnType<typeof describeCapeSource>, core: Cape, cape: string): string[] {
	const linked = Object.values(source.docs).flatMap((doc) => linksOf(doc.text));
	const ids = new Set<string>();
	for (const file of readdirSync(join(dir, "src"))) {
		const text = readFileSync(join(dir, "src", file), "utf8");
		for (const match of text.matchAll(CORE_IMPORT)) {
			for (const specifier of match[1]!.split(",")) {
				const name = specifier.trim().split(/\s+as\s+/)[0]!.trim();
				if (!name || name.startsWith("type ")) continue;
				const hex = /^a([0-9a-f]{32})$/.exec(name)?.[1];
				if (!hex) throw new Error(`${cape} src/${file} imports ${name} from nosedive-core, which is not an action id`);
				const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
				if (!core.docs[id]) throw new Error(`${cape} imports ${id}, which core ${core.version} does not have`);
				if (!linked.some((link) => link.includes(id))) throw new Error(`${cape} imports ${core.docs[id]!.name} (${id}) without linking it from its action doc`);
				ids.add(id);
			}
		}
	}
	return [...ids];
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
