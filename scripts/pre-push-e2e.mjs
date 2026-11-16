#!/usr/bin/env node
// Seeds a fresh repo with the built core, then pushes from it with nothing stubbed, so the pre-push hook seed placed runs
// as a pilot's push would run it: `node scripts/pre-push-e2e.mjs`, after `npm run build`.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist", "cli.js");
if (!existsSync(cli)) throw new Error(`${cli} is missing: run npm run build first`);
const root = mkdtempSync(join(tmpdir(), "nosedive-pre-push-e2e-"));
const env = { ...process.env, GIT_AUTHOR_NAME: "Core CI", GIT_AUTHOR_EMAIL: "ci@example.com", GIT_COMMITTER_NAME: "Core CI", GIT_COMMITTER_EMAIL: "ci@example.com" };

function step(cmd, args, cwd) {
	const result = spawnSync(cmd, args, { cwd, env, encoding: "utf8" });
	if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (${result.status}):\n${result.stdout}${result.stderr}`);
	return result.stdout.trim();
}

try {
	const repo = join(root, "repo");
	const remote = join(root, "remote.git");
	step("git", ["init", "-q", "-b", "main", repo], root);
	step("git", ["init", "-q", "--bare", remote], root);
	step("git", ["remote", "add", "origin", remote], repo);
	console.log(step(process.execPath, [cli, "seed"], repo));
	const hook = join(step("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], repo), "nosedive-hooks", "pre-push");
	const text = readFileSync(hook, "utf8");
	if (!text.includes("pre-push.hook")) throw new Error(`${hook} runs no gate:\n${text}`);
	step("git", ["push", "-q", "origin", "HEAD:refs/heads/main"], repo);
	console.log(`pushed through ${hook}:\n${text}`);
} finally {
	rmSync(root, { recursive: true, force: true });
}
