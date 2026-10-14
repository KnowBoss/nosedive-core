import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge, type Bridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";

export function a01a138b2b8ed775297973c2aad478c8f(bridge: Bridge, name: string): { dir: string; kbDir: string } {
	const workspace = typeof bridge.config.workspace === "string" ? bridge.config.workspace : "workspace";
	const dir = resolve(bridge.dir, workspace, name);
	if (!existsSync(dir)) throw new Error(`${name} is not checked out at ${relative(bridge.dir, dir).replace(/\\/g, "/")}`);
	const own = existsSync(join(dir, ".nosedive", "config.yaml")) ? findBridge(dir) : undefined;
	return { dir, kbDir: own?.kbDir ?? join(dir, "kb") };
}
