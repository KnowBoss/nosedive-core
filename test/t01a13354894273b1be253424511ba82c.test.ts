// commit-files
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "../src/i01a13354894273b1be253424511ba82c.ts";
import { git, gitRepo } from "./harness.ts";

test("commits only the given files", () => {
	const dir = gitRepo("commit-files");
	writeFileSync(join(dir, "a.txt"), "a");
	writeFileSync(join(dir, "b.txt"), "b");
	commitFiles(dir, [join(dir, "a.txt")], "add a");
	assert.equal(git(["log", "--format=%s"], dir), "add a");
	assert.equal(git(["status", "--porcelain"], dir), "?? b.txt");
});

test("throws with git's reason", () => {
	assert.throws(() => commitFiles(gitRepo("commit-files-fail"), ["missing.txt"], "m"), /git add failed: .*missing\.txt/);
});
