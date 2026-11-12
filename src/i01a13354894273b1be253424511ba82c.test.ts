// commit-files
import assert from "node:assert/strict";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { git, gitRepo } from "../test/harness.ts";

test("commits only the given files", () => {
	const dir = gitRepo("commit-files");
	writeFileSync(join(dir, "a.txt"), "a");
	writeFileSync(join(dir, "b.txt"), "b");
	const sha = commitFiles(dir, [join(dir, "a.txt")], "add a", "test");
	assert.equal(sha, git(["rev-parse", "HEAD"], dir), "it returns the commit's sha");
	assert.equal(git(["log", "--format=%s"], dir), "add a");
	assert.equal(git(["log", "-1", "--format=%B"], dir).trim(), "add a\n\nCo-Authored-By: nosedive test <noreply@nosedive.dev>", "the message ends with nosedive's co-author");
	writeFileSync(join(dir, "a.txt"), "a again");
	commitFiles(dir, [join(dir, "a.txt")], "again\n\nCo-Authored-By: nosedive old <noreply@nosedive.dev>", "test");
	assert.equal(git(["log", "-1", "--format=%(trailers:only,unfold)"], dir).trim(), "Co-Authored-By: nosedive old <noreply@nosedive.dev>", "a message that has one gets no second");
	assert.equal(git(["status", "--porcelain"], dir), "?? b.txt");
});

test("throws with git's reason", () => {
	assert.throws(() => commitFiles(gitRepo("commit-files-fail"), ["missing.txt"], "m", "test"), /git add failed: .*missing\.txt/);
});

test("commits more files than a Windows command line can name, and deletions", () => {
	const dir = gitRepo("commit-files-many");
	const paths = Array.from({ length: 800 }, (_, index) => join(dir, `a-long-file-name-to-fill-the-command-line-${index}.txt`));
	for (const path of paths) writeFileSync(path, "x");
	commitFiles(dir, paths, "add many", "test");
	assert.equal(git(["ls-files"], dir).split("\n").length, 800);
	for (const path of paths.slice(0, 700)) rmSync(path);
	commitFiles(dir, paths.slice(0, 700), "drop many", "test");
	assert.equal(git(["ls-files"], dir).split("\n").length, 100);
	assert.equal(git(["status", "--porcelain"], dir), "");
});
