import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { Document, parseDocument } from "yaml";
import type { Ctx } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335480c776ba8945020d0af333eb as mintUuid } from "./a01a1335480c776ba8945020d0af333eb.ts";
import { a01a13354894273b1be253424511ba82c as commitFiles } from "./a01a13354894273b1be253424511ba82c.ts";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./a01a1337d2c14754f9772dc22c1f2edfc.ts";
import { a01a1337c81b57799820f96a757b791d0 as buildCape } from "./a01a1337c81b57799820f96a757b791d0.ts";
import { a01a138b2b8ef7e8097e19d599ba39bcc as checkMeta } from "./a01a138b2b8ef7e8097e19d599ba39bcc.ts";
import { a01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./a01a13354845c7253a55b60bba87285d8.ts";

/** Relative to .nosedive/: built capes, and what this checkout remembers for itself. */
const NOSEDIVE_IGNORES = ["capes/", "local/"];

/**
 * Makes the base's workspace, which ignores everything in it, itself included, so nothing checked
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
	if (!config.has("kb")) config.set("kb", "./kb");
	const kbDir = join(dir, String(config.get("kb")));
	mkdirSync(kbDir, { recursive: true });
	// `backlog` is the root's older name; a bridge with either has its root.
	if (!config.has("root") && !config.has("backlog")) {
		// The root every action, kind and gate of this bridge hangs from; its kind says what the repo is.
		if (checkMeta(rootKind, {}, [kbDir], ctx.capes)) throw new Error(`no kind ${rootKind} is declared, so it cannot be the root's kind`);
		const rootId = mintUuid();
		const rootPath = join(kbDir, `${rootId}.md`);
		// A base is a repo other repos are checked out in; its workspace is where.
		const meta = rootKind === "base" ? "meta:\n  workspace: ./workspace\n" : "";
		writeFileSync(rootPath, `---\nkind: ${rootKind}\nid: ${rootId}\nname: root\ngist: ${JSON.stringify(`What ${basename(dir)} holds`)}\n${meta}---\n\n# ${basename(dir)}\n`);
		config.set("root", rootId);
		changed.push(rootPath);
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

	const rootDoc = findKbDoc(kbDir, String(config.get("root") ?? config.get("backlog")));
	if (rootDoc?.fm.kind === "base") {
		const path = (rootDoc.fm.meta as { workspace?: unknown } | undefined)?.workspace;
		placeWorkspace(dir, resolve(dir, typeof path === "string" ? path : "workspace"));
	}

	const repo = basename(dir);
	if (changed.length > 0) {
		commitFiles(dir, changed, `seed: ${repo} set up`);
		ctx.out(`seeded ${repo}`);
	} else {
		ctx.out(`${repo} is already seeded`);
	}

	const actions = (config.toJS()?.actions ?? {}) as Record<string, unknown>;
	const core = ctx.capes[0]!;
	const shadowing = Object.keys(actions).filter((action) =>
		Object.values(core.docs).some((doc) => doc.name === action && doc.usages.length > 0),
	);
	if (shadowing.length > 0) {
		throw new Error(`config actions cannot replace core's own: remove ${shadowing.join(", ")} from ${configPath}`);
	}
	const specs = [...new Set(Object.values(actions).filter((spec): spec is string => typeof spec === "string"))];
	if (noCapes || specs.length === 0) return;
	const bridgeAt = findBridge(dir)!;
	for (const spec of specs) {
		const [repoName, ref = ""] = spec.split("@", 2) as [string, string | undefined];
		const built = await buildCape(bridgeAt, findRepoDoc(bridgeAt, repoName), ref, core);
		if (!built.fresh) {
			ctx.out(`cape ${spec} is built`);
			continue;
		}
		const serves = Object.keys(actions).filter((action) => actions[action] === spec);
		ctx.out(`built cape ${spec} ${built.version} (${built.commit.slice(0, 7)}) for ${serves.join(", ")}`);
	}
}
