import { spawnSync } from "node:child_process";
import { i01a19005c31172b68871d4842563d310 as coAuthored } from "./i01a19005c31172b68871d4842563d310.ts";

/** `version` is the core's, named in the co-author trailer the message ends with. */
export function i01a13354894273b1be253424511ba82c(repoDir: string, paths: string[], message: string, version: string): void {
	// Paths go on stdin, not the command line, which caps how many fit on Windows.
	const input = `${paths.join("\n")}\n`;
	for (const args of [["add", "--pathspec-from-file=-"], ["commit", "-q", "-m", coAuthored(message, version), "--pathspec-from-file=-"]]) {
		const result = spawnSync("git", args, { cwd: repoDir, encoding: "utf8", input });
		if (result.status !== 0) {
			throw new Error(`git ${args[0]} failed: ${(result.stderr || result.stdout || result.error?.message || "").trim()}`);
		}
	}
}
