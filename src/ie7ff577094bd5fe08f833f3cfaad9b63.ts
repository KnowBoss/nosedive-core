import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Document, parseDocument } from "yaml";
import type { Ctx } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335480c776ba8945020d0af333eb as mintUuid } from "./a01a1335480c776ba8945020d0af333eb.ts";
import { a01a13354894273b1be253424511ba82c as commitFiles } from "./a01a13354894273b1be253424511ba82c.ts";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./a01a1337d2c14754f9772dc22c1f2edfc.ts";
import { a01a1337c806075ca96d637c9ece7316e as capeId } from "./a01a1337c806075ca96d637c9ece7316e.ts";
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
	const configText = config.toString({ lineWidth: 0 });
	if (!existsSync(configPath) || readFileSync(configPath, "utf8") !== configText) {
		mkdirSync(join(dir, ".nosedive"), { recursive: true });
		writeFileSync(configPath, configText);
		changed.push(configPath);
	}

	const kbDir = join(dir, String(config.get("kb")));
	const keep = join(kbDir, ".gitkeep");
	if (!existsSync(kbDir)) {
		mkdirSync(kbDir, { recursive: true });
		writeFileSync(keep, "");
		changed.push(keep);
	}

	const ignorePath = join(dir, ".gitignore");
	const ignore = existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : "";
	if (!ignore.split(/\r?\n/).includes(CAPES_IGNORE)) {
		writeFileSync(ignorePath, `${ignore}${ignore && !ignore.endsWith("\n") ? "\n" : ""}${CAPES_IGNORE}\n`);
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
	const specs = [...new Set(Object.values(actions).filter((spec): spec is string => typeof spec === "string"))];
	if (noCapes || specs.length === 0) return;
	const bridgeAt = findBridge(dir)!;
	const core = ctx.capes[0]!;
	for (const spec of specs) {
		const [repoName, ref = ""] = spec.split("@", 2) as [string, string | undefined];
		const repo = findRepoDoc(bridgeAt, repoName);
		const pinned = /^[0-9a-f]{40}$/.test(ref) ? capeId(repo.id, ref, core.id) : undefined;
		if (pinned && existsSync(join(dir, ".nosedive", "capes", `${pinned}.js`))) {
			ctx.out(`cape ${spec} is built`);
			continue;
		}
		const built = await buildCape(bridgeAt, repo, ref, core);
		const serves = Object.keys(actions).filter((action) => actions[action] === spec);
		ctx.out(`built cape ${spec} ${built.version} (${built.commit.slice(0, 7)}) for ${serves.join(", ")}`);
	}
}
