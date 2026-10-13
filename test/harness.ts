import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";
import { a01a1336a958f71c7beec4db3195c7966 as launch, type Cape, type Ctx } from "../src/a01a1336a958f71c7beec4db3195c7966.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";

const cape: Cape = await sourceCape();

export type Run = { code: number; out: string; err: string };

/** Runs one command line in-process against this repo's source cape. */
export async function run(argv: string[], cwd: string, stdin = ""): Promise<Run> {
	const out: string[] = [];
	const err: string[] = [];
	const ctx: Ctx = {
		cwd,
		capes: [cape],
		out: (text) => out.push(text),
		err: (text) => err.push(text),
		stdin: async () => stdin,
	};
	const code = await launch(argv, ctx);
	return { code, out: out.join("\n"), err: err.join("\n") };
}

export function ok(result: Run): string {
	assert.equal(result.code, 0, result.err);
	return result.out;
}

export function tempDir(label: string): string {
	const dir = mkdtempSync(join(tmpdir(), `nosedive-core-${label}-`));
	after(() => rmSync(dir, { recursive: true, force: true }));
	return dir;
}

export function git(args: string[], cwd: string): string {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
	return result.stdout.trim();
}

export function gitRepo(label: string): string {
	const dir = tempDir(label);
	git(["init", "-q", "-b", "main"], dir);
	git(["config", "user.name", "Core Test"], dir);
	git(["config", "user.email", "core@example.com"], dir);
	return dir;
}

/** A seeded bridge in a fresh temp repo. */
export async function tempBridge(label: string): Promise<string> {
	const dir = gitRepo(label);
	ok(await run(["seed"], dir));
	return dir;
}
