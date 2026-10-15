import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import type { Bridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./a01a13dee4b1d78f7a699c3777bf63587.ts";
import { a01a13c760de87562b4738946402010b8 as checkoutPath } from "./a01a13c760de87562b4738946402010b8.ts";

export function a01a138b2b8ed775297973c2aad478c8f(bridge: Bridge, name: string): { dir: string; kbDir: string } {
	const dir = checkoutPath(bridge, name);
	if (!existsSync(dir)) throw new Error(`${name} is not checked out at ${relative(bridge.dir, dir).replace(/\\/g, "/")}`);
	const own = readRepoConfig(dir);
	return { dir, kbDir: own?.kbDir ?? join(dir, "kb") };
}
