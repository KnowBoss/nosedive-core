import { spawnSync } from "node:child_process";

export function i01a13354894273b1be253424511ba82c(repoDir: string, paths: string[], message: string): void {
	// Paths go on stdin, not the command line, which caps how many fit on Windows.
	const input = `${paths.join("\n")}\n`;
	for (const args of [["add", "--pathspec-from-file=-"], ["commit", "-q", "-m", message, "--pathspec-from-file=-"]]) {
		const result = spawnSync("git", args, { cwd: repoDir, encoding: "utf8", input });
		if (result.status !== 0) {
			throw new Error(`git ${args[0]} failed: ${(result.stderr || result.stdout || result.error?.message || "").trim()}`);
		}
	}
}
