import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { Document, parseDocument } from "yaml";
import type { Ctx } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335480c776ba8945020d0af333eb as mintUuid } from "./a01a1335480c776ba8945020d0af333eb.ts";
import { a01a13354894273b1be253424511ba82c as commitFiles } from "./a01a13354894273b1be253424511ba82c.ts";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./a01a1337d2c14754f9772dc22c1f2edfc.ts";
import { a01a1337c81b57799820f96a757b791d0 as buildCape } from "./a01a1337c81b57799820f96a757b791d0.ts";

const CAPES_IGNORE = ".nosedive/capes/";

export async function ie7ff577094bd5fe08f833f3cfaad9b63(noCapes: boolean, ctx: Ctx): Promise<void> {
	const root = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: ctx.cwd, encoding: "utf8" });
	if (root.status !== 0) throw new Error("seed makes a git repo a bridge, and this is not a git repo");
	const dir = root.stdout.trim();
	const changed: string[] = [];

	const configPath = join(dir, ".nosedive", "config.yaml");
	const config = existsSync(configPath) ? parseDocument(readFileSync(configPath, "utf8")) : new Document({});
	if (config.errors.length > 0) throw new Error(`${configPath}: ${config.errors[0]!.message}`);
	if (!config.has("bridge")) config.set("bridge", mintUuid());
	if (!config.has("kb")) config.set("kb", "./kb");
	const kbDir = join(dir, String(config.get("kb")));
	mkdirSync(kbDir, { recursive: true });
	if (!config.has("backlog")) {
		// The root every action, kind and gate of this bridge hangs from.
		const rootId = mintUuid();
		const rootPath = join(kbDir, `${rootId}.md`);
		writeFileSync(rootPath, `---\nkind: memo\nid: ${rootId}\nname: root\ngist: ${JSON.stringify(`What ${basename(dir)} holds`)}\n---\n\n# ${basename(dir)}\n`);
		config.set("backlog", rootId);
		changed.push(rootPath);
	}
	const configText = config.toString({ lineWidth: 0 });
	if (!existsSync(configPath) || readFileSync(configPath, "utf8") !== configText) {
		mkdirSync(join(dir, ".nosedive"), { recursive: true });
		writeFileSync(configPath, configText);
		changed.push(configPath);
	}

	const ignorePath = join(dir, ".gitignore");
	const ignore = existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : "";
	const workspace = `${String(config.get("workspace") ?? "workspace").replace(/^\.\//, "").replace(/\/$/, "")}/`;
	const missing = [CAPES_IGNORE, workspace].filter((line) => !ignore.split(/\r?\n/).includes(line));
	if (missing.length > 0) {
		writeFileSync(ignorePath, `${ignore}${ignore && !ignore.endsWith("\n") ? "\n" : ""}${missing.map((line) => `${line}\n`).join("")}`);
		changed.push(ignorePath);
	}

	const bridge = String(config.get("bridge"));
	if (changed.length > 0) {
		commitFiles(dir, changed, `seed: bridge ${bridge} set up`);
		ctx.out(`seeded bridge ${bridge}`);
	} else {
		ctx.out(`bridge ${bridge} is already seeded`);
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
