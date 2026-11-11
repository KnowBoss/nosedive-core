import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { relative } from "node:path";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13c760de87562b4738946402010b8 as checkoutPath } from "./i01a13c760de87562b4738946402010b8.ts";
import { cacheGit } from "./i01a15baf13e27bd88dc880d4871f2210.ts";

type RepoDoc = { fm: Record<string, unknown> };
type Say = { out(text: string): void; err(text: string): void };

/** The one refusal a cape can act on, known by its name, since capes import only the function: the checkout's ignored files, which `discard` removes. */
class DehydrateIgnored extends Error {
	override name = "DehydrateIgnored";
	ignored: string[];
	constructor(dir: string, ignored: string[]) {
		super(`${dir} has ignored files it would lose, so it stays; discard them to go on:\n${indent(ignored)}`);
		this.ignored = ignored;
	}
}

export function i01a17fba20d673c5b8dd8551943369a2(bridge: Bridge, doc: RepoDoc, ctx: Say, options: { discard?: boolean } = {}): void {
	const dir = checkoutPath(bridge, String(doc.fm.name));
	const shown = relative(bridge.dir, dir).replace(/\\/g, "/");
	if (!existsSync(dir)) {
		ctx.out(`${shown}: not checked out`);
		return;
	}
	const lines = git(dir, "status", "--porcelain", "--ignored", "--untracked-files=all").text.split("\n").filter(Boolean);
	const changed = lines.filter((line) => !line.startsWith("!! "));
	const ignored = lines.filter((line) => line.startsWith("!! ")).map((line) => line.slice(3));
	if (changed.length) throw new Error(`${shown} has changes it would lose, so it stays:\n${indent(changed)}`);
	const unpushed = git(dir, "log", "--oneline", "HEAD", "--not", "--remotes=origin", "--glob=refs/nosedive/*").text.split("\n").filter(Boolean);
	if (unpushed.length) throw new Error(`${shown} has commits origin does not have, so it stays:\n${indent(unpushed)}`);
	if (ignored.length && !options.discard) throw new DehydrateIgnored(shown, ignored);

	const cache = git(dir, "rev-parse", "--path-format=absolute", "--git-common-dir").text;
	const removed = cacheGit(cache, "worktree", "remove", ...(ignored.length ? ["--force"] : []), dir);
	if (!removed.ok) throw new Error(`cannot remove ${shown}: ${removed.text}`);
	ctx.out(`${shown}: put away`);
}

function indent(lines: string[]): string {
	return lines.map((line) => `  ${line}`).join("\n");
}

function git(cwd: string, ...args: string[]): { ok: boolean; text: string } {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	return { ok: result.status === 0, text: (result.status === 0 ? result.stdout : result.stderr || result.stdout || "").trim() };
}
