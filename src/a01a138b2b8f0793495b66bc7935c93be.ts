import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import type { Bridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./a01a1337d2c14754f9772dc22c1f2edfc.ts";
import { a01a138b2b8ed775297973c2aad478c8f as workspaceRepo } from "./a01a138b2b8ed775297973c2aad478c8f.ts";

/** Returns the checkout and a line saying whether it was there or cloned. */
export function a01a138b2b8f0793495b66bc7935c93be(bridge: Bridge, name: string): { dir: string; kbDir: string; said: string } {
	const workspace = typeof bridge.config.workspace === "string" ? bridge.config.workspace : "workspace";
	const dir = resolve(bridge.dir, workspace, name);
	const shown = relative(bridge.dir, dir).replace(/\\/g, "/");
	if (existsSync(dir)) return { ...workspaceRepo(bridge, name), said: `${shown}: checked out already` };
	const repo = findRepoDoc(bridge, name);
	mkdirSync(dirname(dir), { recursive: true });
	const clone = spawnSync("git", ["clone", "-q", repo.remote, dir], { encoding: "utf8" });
	if (clone.status !== 0) throw new Error(`could not clone ${name} from ${repo.remote}: ${(clone.stderr || clone.stdout).trim()}`);
	const branch = spawnSync("git", ["branch", "--show-current"], { cwd: dir, encoding: "utf8" }).stdout.trim();
	const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: dir, encoding: "utf8" }).stdout.trim();
	return { ...workspaceRepo(bridge, name), said: `${shown}: cloned ${branch} at ${commit}` };
}
