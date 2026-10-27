import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { relative } from "node:path";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13c760de87562b4738946402010b8 as checkoutPath } from "./i01a13c760de87562b4738946402010b8.ts";

type RepoDoc = { fm: Record<string, unknown> };
type Say = { out(text: string): void; err(text: string): void };

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
	if (ignored.length && !options.discard) throw new Error(`${shown} has ignored files it would lose, so it stays; discard them to go on:\n${indent(ignored)}`);

	const on = git(dir, "symbolic-ref", "-q", "--short", "HEAD");
	let said = "put away";
	if (on.ok) {
		// The packed ref holds this branch's commits alone, so it is forced; only land moves a work branch.
		const pushed = git(dir, "push", "-q", "--force", "origin", `HEAD:refs/nosedive/${on.text}`);
		if (!pushed.ok) throw new Error(`origin refused ${on.text}, so ${shown} stays: ${pushed.text}`);
		said = `pushed to refs/nosedive/${on.text} and put away`;
	} else {
		const unpushed = git(dir, "log", "--oneline", "HEAD", "--not", "--remotes=origin", "--glob=refs/nosedive/*").text.split("\n").filter(Boolean);
		if (unpushed.length) throw new Error(`${shown} is detached with commits origin does not have, so it stays; put them on a branch:\n${indent(unpushed)}`);
	}
	const cache = git(dir, "rev-parse", "--path-format=absolute", "--git-common-dir").text;
	const removed = git(cache, "worktree", "remove", ...(ignored.length ? ["--force"] : []), dir);
	if (!removed.ok) throw new Error(`cannot remove ${shown}: ${removed.text}`);
	ctx.out(`${shown}: ${said}`);
}

function indent(lines: string[]): string {
	return lines.map((line) => `  ${line}`).join("\n");
}

function git(cwd: string, ...args: string[]): { ok: boolean; text: string } {
	const result = spawnSync("git", args, { cwd, encoding: "utf8" });
	return { ok: result.status === 0, text: (result.status === 0 ? result.stdout : result.stderr || result.stdout || "").trim() };
}
