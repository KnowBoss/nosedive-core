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
import { i01a1337c810a7456876b831d0c873396 as capeManifest } from "./i01a1337c810a7456876b831d0c873396.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig, KIND_FILES } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";
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

	const repo = basename(dir);
	const configPath = join(dir, ".nosedive", "config.yaml");
	if (!readRepoConfig(dir)) {
		// The root every action, kind and gate of this repo hangs from; its kind says what the repo is.
		if (checkMeta(rootKind, {}, [], ctx.capes)) throw new Error(`no kind ${rootKind} is declared, so it cannot be the root's kind`);
		mkdirSync(join(dir, ".nosedive"), { recursive: true });
		const kbDir = join(dir, "kb");
		mkdirSync(kbDir, { recursive: true });
		const named = { name: repo, gist: `What ${repo} holds`, title: repo };
		if (KIND_FILES.includes(rootKind)) {
			// A ship, cape or base is what its kind file says, a doc named for its kind; a ship's docs are in decks, its first ./kb.
			const deck = rootKind === "ship" ? mintKbDoc(kbDir, { kind: "deck", ...named }) : undefined;
			if (deck) changed.push(deck.path);
			const minted = mintKbDoc(join(dir, ".nosedive"), { kind: rootKind, ...named, meta: deck ? { workspace: "./workspace", decks: { "./kb": deck.id } } : undefined });
			const kindFile = join(dir, ".nosedive", `${rootKind}.md`);
			renameSync(minted.path, kindFile);
			changed.push(kindFile);
		} else {
			// Any other root is a doc of the kb its config names.
			const root = mintKbDoc(kbDir, { kind: rootKind, ...named });
			writeFileSync(configPath, new Document({ kb: "./kb", root: root.id }).toString({ lineWidth: 0 }));
			changed.push(root.path, configPath);
		}
	} else if (existsSync(configPath) && !readRepoConfig(dir)!.rootPath) {
		// An older config without a kb has the default one.
		const config = parseDocument(readFileSync(configPath, "utf8"));
		if (config.errors.length > 0) throw new Error(`${configPath}: ${config.errors[0]!.message}`);
		if (!config.has("kb")) {
			config.set("kb", "./kb");
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
	const rootDoc = findRoot(dir);
	// A cape's or ship's packages build from its lockfile, which a global ignore could hide from every commit.
	if (rootDoc?.kind === "cape" || own.workspace !== undefined) {
		const repoIgnore = join(dir, ".gitignore");
		const text = existsSync(repoIgnore) ? readFileSync(repoIgnore, "utf8") : "";
		if (!text.split(/\r?\n/).includes(LOCKFILE)) {
			writeFileSync(repoIgnore, `${text}${text && !text.endsWith("\n") ? "\n" : ""}${LOCKFILE}\n`);
			changed.push(repoIgnore);
		}
	}
	if (own.workspace !== undefined) placeWorkspace(dir, own.workspace);

	if (changed.length > 0) {
		commitFiles(dir, changed, `seed: ${repo} set up`);
		ctx.out(`seeded ${repo}`);
	} else {
		ctx.out(`${repo} is already seeded`);
	}

	// A root's body is its tree, rendered from its links: each of a ship's deck roots, else the repo's root.
	const deckRoots = own.decks.flatMap((deck) => {
		const doc = deck.root ? findKbDoc(deck.dir, deck.root) : undefined;
		return doc ? [{ doc, kbDir: deck.dir }] : [];
	});
	const roots = own.rootPath && own.workspace !== undefined ? deckRoots : rootDoc ? [{ doc: rootDoc, kbDir: own.kbDir }] : [];
	for (const { doc, kbDir } of roots) {
		const tree = renderTree(kbDir, doc);
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
	return `\n  it last built at ${last.commit.slice(0, 7)} with core ${last.coreVersion}: pin it there, as \`${name}@${last.commit}\` in config \`capes\`, or go back to that core`;
}
