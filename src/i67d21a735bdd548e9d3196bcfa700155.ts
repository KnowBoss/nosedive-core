import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { Document, parseDocument } from "yaml";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./i01a1337d2c14754f9772dc22c1f2edfc.ts";
import { i01a1337c81b57799820f96a757b791d0 as buildCape } from "./i01a1337c81b57799820f96a757b791d0.ts";
import { versionOf } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { CORE_OWNER } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a141f869c07c4da8288927a559c8ae as mintKbDoc } from "./i01a141f869c07c4da8288927a559c8ae.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import { i01a1337c810a7456876b831d0c873396 as capeManifest } from "./i01a1337c810a7456876b831d0c873396.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a175dbf4517dafa3a9048ecd98ab84 as runMigrations, MIGRATIONS } from "./i01a175dbf4517dafa3a9048ecd98ab84.ts";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";
import { i01a14a5504467ef08586b828ebabc148 as renderTree } from "./i01a14a5504467ef08586b828ebabc148.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./i01a1335483aa776cb84df698b04adc06.ts";

/** Relative to .nosedive/: built capes, and what this checkout remembers for itself. */
const NOSEDIVE_IGNORES = ["cache/", "capes/", "local/"];
const LOCKFILE = "!package-lock.json";

/**
 * Makes the hero's workspace, which ignores everything in it, itself included, so nothing checked
 * out there is ever committed. A workspace whose path changed since the last seed is moved, clones
 * and all, rather than left behind.
 */
function placeWorkspace(dir: string, workspace: string): void {
	const record = join(dir, ".nosedive", "local", "workspace");
	const previous = existsSync(record) ? resolve(dir, readFileSync(record, "utf8").trim()) : undefined;
	if (previous && previous !== workspace && existsSync(previous) && !existsSync(workspace)) {
		mkdirSync(dirname(workspace), { recursive: true });
		renameSync(previous, workspace);
	}
	mkdirSync(workspace, { recursive: true });
	if (!existsSync(join(workspace, ".gitignore"))) writeFileSync(join(workspace, ".gitignore"), "*\n");
	mkdirSync(dirname(record), { recursive: true });
	writeFileSync(record, `${relative(dir, workspace).replace(/\\/g, "/")}\n`);
}

export async function i67d21a735bdd548e9d3196bcfa700155(options: { noCapes: boolean; rootKind: string; workspace: boolean }, ctx: Ctx): Promise<void> {
	const { noCapes, rootKind, workspace } = options;
	const root = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: ctx.cwd, encoding: "utf8" });
	if (root.status !== 0) throw new Error("seed makes a git repo a bridge, and this is not a git repo");
	const dir = root.stdout.trim();
	const changed: string[] = [];

	const repo = basename(dir);
	const configPath = join(dir, ".nosedive", "config.yaml");
	// A repo it knows is brought to today's shape before anything else reads it.
	for (const name of existsSync(configPath) ? runMigrations(dir, ctx) : []) ctx.out(`migrated ${repo}: ${name}`);
	if (!readRepoConfig(dir)) {
		// A repo is what its config enables: its id, its first root, and a workspace when asked for.
		// The root's kind is one of core's, which the root says in a canonical scope.
		const core = ctx.capes[0]!;
		if (core.kinds[rootKind] === undefined) throw new Error(`no kind ${rootKind} is declared, so it cannot be the root's kind`);
		const version = versionOf({ ...(core.kinds[rootKind] as object), name: rootKind, owner: CORE_OWNER, repoDir: core.repoDir });
		mkdirSync(join(dir, ".nosedive"), { recursive: true });
		const scopes = [{ [CORE_OWNER]: { canonical: true, ...(version ? { version } : {}) } }];
		const root = mintKbDoc(join(dir, "kb"), { kind: rootKind, name: repo, gist: `What ${repo} holds`, title: repo, scopes });
		// The primary root is the one whose id is the repo's.
		const config = { id: root.id, migrations: MIGRATIONS.map((migration) => migration.id), ...(workspace ? { workspace: "./workspace" } : {}), roots: [`kb/${root.id}.md`] };
		writeFileSync(configPath, new Document(config).toString({ lineWidth: 0 }));
		changed.push(root.path, configPath);
	} else {
		const config = parseDocument(readFileSync(configPath, "utf8"));
		if (config.errors.length > 0) throw new Error(`${configPath}: ${config.errors[0]!.message}`);
		const before = config.toString({ lineWidth: 0 });
		// --workspace adds a workspace a repo lacks.
		if (workspace && config.has("roots") && !config.has("workspace")) config.set("workspace", "./workspace");
		if (config.toString({ lineWidth: 0 }) !== before) {
			writeFileSync(configPath, config.toString({ lineWidth: 0 }));
			changed.push(configPath);
		}
	}

	// nosedive's own ignores live beside its config, so the repo's own .gitignore stays the user's.
	const ignorePath = join(dir, ".nosedive", ".gitignore");
	const ignore = existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : "";
	const missing = NOSEDIVE_IGNORES.filter((line) => !ignore.split(/\r?\n/).includes(line));
	if (missing.length > 0) {
		writeFileSync(ignorePath, `${ignore}${ignore && !ignore.endsWith("\n") ? "\n" : ""}${missing.map((line) => `${line}\n`).join("")}`);
		changed.push(ignorePath);
	}

	const own = readRepoConfig(dir)!;
	// A cape's or hero's packages build from its lockfile, which a global ignore could hide from every commit.
	if (findRoot(dir, "cape") || own.workspace !== undefined) {
		const repoIgnore = join(dir, ".gitignore");
		const text = existsSync(repoIgnore) ? readFileSync(repoIgnore, "utf8") : "";
		if (!text.split(/\r?\n/).includes(LOCKFILE)) {
			writeFileSync(repoIgnore, `${text}${text && !text.endsWith("\n") ? "\n" : ""}${LOCKFILE}\n`);
			changed.push(repoIgnore);
		}
	}
	if (own.workspace !== undefined) placeWorkspace(dir, own.workspace);
	const readme = join(dir, "README.md");
	if (!existsSync(readme) && own.root) {
		const primary = own.roots.find((root) => root.id === own.root)!;
		writeFileSync(readme, `# [${repo}](${relative(dir, primary.path).replace(/\\/g, "/")})\n`);
		changed.push(readme);
	}

	if (changed.length > 0) {
		commitFiles(dir, changed, `seed: ${repo} set up`);
		ctx.out(`seeded ${repo}`);
	} else {
		ctx.out(`${repo} is already seeded`);
	}

	// Each root's body is its tree, rendered from its links.
	const roots = own.roots.flatMap((root) => {
		const doc = findKbDoc(root.dir, root.id);
		return doc ? [{ doc, kbDir: root.dir }] : [];
	});
	for (const { doc, kbDir } of roots) {
		const tree = renderTree(kbDir, doc, [...(own.kindsDir ? [own.kindsDir] : []), ...(own.reposDir ? [own.reposDir] : []), ...own.roots.map((root) => root.dir)]);
		if (tree === doc.body) continue;
		writeKbDoc(doc.path, doc.yaml, tree);
		commitFiles(dir, [doc.path], `seed: ${repo} tree rendered`);
		ctx.out(`rendered the tree of ${String(doc.fm.name)}`);
	}

	if (noCapes) return;
	const core = ctx.capes[0]!;
	const bridgeAt = findBridge(dir)!;
	const failed: string[] = [];
	for (const cape of configuredCapes(bridgeAt, core)) {
		try {
			const built = await buildCape(bridgeAt, cape.repo ?? findRepoDoc(bridgeAt, cape.name), cape.ref, core, [], ctx.out);
			if (!built.fresh) ctx.out(`cape ${cape.spec} is built`);
			else ctx.out(`built cape ${cape.spec} ${built.version} (${built.commit.slice(0, 7)}): ${Object.keys(built.actions).join(", ") || "no actions"}`);
		} catch (err) {
			failed.push(`${cape.spec}: ${err instanceof Error ? err.message : String(err)}${lastBuilt(bridgeAt.dir, cape.name, cape.repo?.id, core.id)}`);
		}
	}
	if (failed.length > 0) throw new Error(`some capes are not usable:\n${failed.map((failure) => `- ${failure}`).join("\n")}`);
}

/** Where a cape that failed to build last built: the way back to a core it works with. */
function lastBuilt(bridgeDir: string, name: string, repo: string | undefined, coreId: string): string {
	const last = capeManifest(bridgeDir)
		.filter((build) => build.repo === repo && build.core !== coreId && build.coreVersion)
		.sort((a, b) => a.builtAt.localeCompare(b.builtAt))
		.at(-1);
	if (!last) return "";
	return `\n  it last built at ${last.commit.slice(0, 7)} with core ${last.coreVersion}: pin it there, with \`ref: ${last.commit}\` on its .cape link, or go back to that core`;
}
