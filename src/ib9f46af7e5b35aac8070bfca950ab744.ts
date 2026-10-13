import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Document, parseDocument } from "yaml";
import type { Ctx } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335480c776ba8945020d0af333eb as mintUuid } from "./a01a1335480c776ba8945020d0af333eb.ts";
import { a01a13354894273b1be253424511ba82c as commitFiles } from "./a01a13354894273b1be253424511ba82c.ts";

const CAPES_IGNORE = ".nosedive/capes/";

export async function ib9f46af7e5b35aac8070bfca950ab744(ctx: Ctx): Promise<void> {
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

	const actions = config.toJS()?.actions;
	if (actions && typeof actions === "object" && Object.keys(actions).length > 0) {
		ctx.out(`building capes is not in this prototype yet: ${Object.keys(actions).join(", ")}`);
	}
}
