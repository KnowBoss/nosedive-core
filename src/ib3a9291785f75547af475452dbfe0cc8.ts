import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { Document, parseDocument } from "yaml";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./i01a1337d2c14754f9772dc22c1f2edfc.ts";
import { i01a1337c81b57799820f96a757b791d0 as buildCape } from "./i01a1337c81b57799820f96a757b791d0.ts";
import { i01a138b2b8ef7e8097e19d599ba39bcc as checkMeta } from "./i01a138b2b8ef7e8097e19d599ba39bcc.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a141f869c07c4da8288927a559c8ae as mintKbDoc } from "./i01a141f869c07c4da8288927a559c8ae.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import { i01a141fbba027b2684d5b1c1879d9337 as actionClashes } from "./i01a141fbba027b2684d5b1c1879d9337.ts";
import { i01a1337c810a7456876b831d0c873396 as capeManifest } from "./i01a1337c810a7456876b831d0c873396.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig, ROOT_KEYS } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a14a5504467ef08586b828ebabc148 as renderTree } from "./i01a14a5504467ef08586b828ebabc148.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./i01a1335483aa776cb84df698b04adc06.ts";

/** Relative to .nosedive/: built capes, and what this checkout remembers for itself. */
const NOSEDIVE_IGNORES = ["cache/", "capes/", "local/"];
const LOCKFILE = "!package-lock.json";

/**
 * Makes the ship's workspace, which ignores everything in it, itself included, so nothing checked
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

export async function ib3a9291785f75547af475452dbfe0cc8(options: { noCapes: boolean; rootKind: string }, ctx: Ctx): Promise<void> {
	const { noCapes, rootKind } = options;
	const root = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: ctx.cwd, encoding: "utf8" });
	if (root.status !== 0) throw new Error("seed makes a git repo a bridge, and this is not a git repo");
	const dir = root.stdout.trim();
	const changed: string[] = [];

	const configPath = join(dir, ".nosedive", "config.yaml");
	const config = existsSync(configPath) ? parseDocument(readFileSync(configPath, "utf8")) : new Document({});
	if (config.errors.length > 0) throw new Error(`${configPath}: ${config.errors[0]!.message}`);
	const seeding = !ROOT_KEYS.some((key) => config.has(key));
	// A new ship's docs are its bridge; any other repo's, and an older config's, are its kb.
	if (!config.has("kb")) config.set("kb", seeding && rootKind === "ship" ? "./bridge" : "./kb");
	const kbDir = join(dir, String(config.get("kb")));
	mkdirSync(kbDir, { recursive: true });
	// A config names its root under its kind's key, or one of the legacy names; any of them is its root.
	if (seeding) {
		// The root every action, kind and gate of this bridge hangs from; its kind says what the repo is.
		if (checkMeta(rootKind, {}, [kbDir], ctx.capes)) throw new Error(`no kind ${rootKind} is declared, so it cannot be the root's kind`);
		// The root takes the repo's name, which is what ships call it: a cape's name is its root's.
		// A ship is where other repos are checked out; its workspace is where.
		const root = mintKbDoc(kbDir, {
			kind: rootKind,
			name: basename(dir),
			gist: `What ${basename(dir)} holds`,
			title: basename(dir),
			meta: rootKind === "ship" ? { workspace: "./workspace" } : undefined,
		});
		config.set(["ship", "cape", "base"].includes(rootKind) ? rootKind : "root", root.id);
		changed.push(root.path);
	}
	const configText = config.toString({ lineWidth: 0 });
	if (!existsSync(configPath) || readFileSync(configPath, "utf8") !== configText) {
		mkdirSync(join(dir, ".nosedive"), { recursive: true });
		writeFileSync(configPath, configText);
		changed.push(configPath);
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
	const rootDoc = own.root ? findKbDoc(kbDir, own.root) : undefined;
	// A cape's or ship's packages build from its lockfile, which a global ignore could hide from every commit.
	if (rootDoc?.fm.kind === "cape" || own.workspace !== undefined) {
		const repoIgnore = join(dir, ".gitignore");
		const text = existsSync(repoIgnore) ? readFileSync(repoIgnore, "utf8") : "";
		if (!text.split(/\r?\n/).includes(LOCKFILE)) {
			writeFileSync(repoIgnore, `${text}${text && !text.endsWith("\n") ? "\n" : ""}${LOCKFILE}\n`);
			changed.push(repoIgnore);
		}
	}
	if (own.workspace !== undefined) placeWorkspace(dir, own.workspace);

	const repo = basename(dir);
	if (changed.length > 0) {
		commitFiles(dir, changed, `seed: ${repo} set up`);
		ctx.out(`seeded ${repo}`);
	} else {
		ctx.out(`${repo} is already seeded`);
	}

	// The root's body is its tree, rendered from its links.
	if (rootDoc) {
		const tree = renderTree(kbDir, rootDoc);
		if (tree !== rootDoc.body) {
			writeKbDoc(rootDoc.path, rootDoc.yaml, tree);
			commitFiles(dir, [rootDoc.path], `seed: ${repo} tree rendered`);
			ctx.out(`rendered the tree of ${String(rootDoc.fm.name)}`);
		}
	}

	if (noCapes) return;
	const core = ctx.capes[0]!;
	const bridgeAt = findBridge(dir)!;
	const failed: string[] = [];
	for (const cape of configuredCapes(bridgeAt, core)) {
		try {
			const built = await buildCape(bridgeAt, cape.repo ?? findRepoDoc(bridgeAt, cape.name), cape.ref, core);
			if (!built.fresh) ctx.out(`cape ${cape.spec} is built`);
			else ctx.out(`built cape ${cape.spec} ${built.version} (${built.commit.slice(0, 7)}): ${Object.keys(built.actions).join(", ") || "no actions"}`);
		} catch (err) {
			failed.push(`${cape.spec}: ${err instanceof Error ? err.message : String(err)}${lastBuilt(bridgeAt.dir, cape.name, cape.repo?.id, core.id)}`);
		}
	}
	const built = configuredCapes(bridgeAt, core).flatMap((cape) => (cape.build ? [{ name: cape.name, actions: cape.build.actions }] : []));
	const clashes = actionClashes(core, built);
	if (clashes.length > 0) failed.push(`capes clash, so drop or pin one of them:\n  ${clashes.join("\n  ")}`);
	if (failed.length > 0) throw new Error(`some capes are not usable:\n${failed.map((failure) => `- ${failure}`).join("\n")}`);
}

/** Where a cape that failed to build last built: the way back to a core it works with. */
function lastBuilt(bridgeDir: string, name: string, repo: string | undefined, coreId: string): string {
	const last = capeManifest(bridgeDir)
		.filter((build) => build.repo === repo && build.core !== coreId && build.coreVersion)
		.sort((a, b) => a.builtAt.localeCompare(b.builtAt))
		.at(-1);
	if (!last) return "";
	return `\n  it last built at ${last.commit.slice(0, 7)} with core ${last.coreVersion}: pin it there, as \`${name}@${last.commit}\` in config \`capes\`, or go back to that core`;
}
