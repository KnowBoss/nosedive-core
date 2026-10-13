import { spawnSync } from "node:child_process";

export function a01a13354894273b1be253424511ba82c(repoDir: string, paths: string[], message: string): void {
	for (const args of [["add", "--", ...paths], ["commit", "-q", "-m", message, "--", ...paths]]) {
		const result = spawnSync("git", args, { cwd: repoDir, encoding: "utf8" });
		if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`);
	}
}
