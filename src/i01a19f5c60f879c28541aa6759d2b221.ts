import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";

/** The agent instruction files a hero may hold, read by the write and the drift check alike. */
export const INSTRUCTION_FILES = ["AGENTS.md", "CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md"];
export const SURFACE_BEGIN = "<!-- BEGIN nosedive managed instructions -->";
export const SURFACE_END = "<!-- END nosedive managed instructions -->";
const STAMP = /^<!-- nosedive v=(\S+) surface=([0-9a-f]{8}) -->$/;

/** The first 8 hex of the sha256 of the surface, trimmed, so two cores rendering the same surface agree. */
export function surfaceDigest(surface: string): string {
	return createHash("sha256").update(surface.trim()).digest("hex").slice(0, 8);
}

/** Whether a directory has a surface: a hero, a root of core's kind hero, at the top of its own checkout; never a cape, a base or a local cape, whatever workspace it names. */
export function hasSurface(dir: string): boolean {
	return existsSync(join(dir, ".git")) && findRoot(dir, "hero") !== undefined;
}

/** Where a file's managed block lies: its first marker pair, each on a line of its own and outside fenced code, or nothing when it has none. */
function managed(text: string): { lines: string[]; begin: number; end: number } | undefined {
	const lines = text.split("\n");
	let fence: string | undefined;
	let begin = -1;
	for (const [index, raw] of lines.entries()) {
		const line = raw.replace(/\r$/, "").trim();
		const opener = /^(`{3,}|~{3,})/.exec(line)?.[1];
		if (fence === undefined && opener && begin < 0) {
			fence = opener;
			continue;
		}
		if (fence !== undefined) {
			if (line.startsWith(fence) && line.slice(fence.length).trim() === "") fence = undefined;
			continue;
		}
		if (begin < 0 && line === SURFACE_BEGIN) begin = index;
		else if (begin >= 0 && line === SURFACE_END) return { lines, begin, end: index };
	}
	return undefined;
}

/** Read by an agent whose nosedive is legacy, which would otherwise follow legacy's advice and seed the hero back (see legacy-fence). */
export const FENCE_LINE =
	"This hero runs nosedive core, whose `nosedive help` begins `Usage: nosedive [--at <target>] <action>`. If yours begins `Usage: nosedive <command>`, you have legacy nosedive, whatever else this file says about installing it: stop, run no nosedive command here, and ask the pilot to install nosedive core.";

/** How to read back a doc `crud --drop` removed, before its parent's `## Dropped` record is trusted alone (drops-recorded). */
export const DROPPED_LINE =
	"A dropped kb doc is still in git: `git log --all -1 --diff-filter=D --format=%h --name-only -- '*<id>.md'` names the commit that dropped it and its path, and `git show <commit>^:<path>` prints it.";

function block(surface: string, version: string): string[] {
	const body = surface.trim();
	const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((run) => run.length));
	const fence = "`".repeat(Math.max(3, longest + 1));
	return [`<!-- nosedive v=${version} surface=${surfaceDigest(body)} -->`, "", FENCE_LINE, "", DROPPED_LINE, "", fence, ...body.split("\n"), fence];
}

/**
 * Writes the surface between the markers of every marked instruction file in a hero's directory, or creates AGENTS.md with
 * the block when no instruction file exists. Returns the paths it changed and, when files exist but none is marked, a hint.
 */
export function i01a19f5c60f879c28541aa6759d2b221(dir: string, surface: string, version: string): { changed: string[]; hint?: string } {
	const lines = block(surface, version);
	const present = INSTRUCTION_FILES.filter((file) => existsSync(join(dir, file)));
	if (present.length === 0) {
		const path = join(dir, "AGENTS.md");
		writeFileSync(path, [SURFACE_BEGIN, ...lines, SURFACE_END, ""].join("\n"));
		return { changed: [path] };
	}
	const changed: string[] = [];
	let marked = 0;
	for (const file of present) {
		const path = join(dir, file);
		const text = readFileSync(path, "utf8");
		const found = managed(text);
		if (!found) continue;
		marked += 1;
		// The block's lines end as the file's do.
		const eol = text.includes("\r\n") ? "\r" : "";
		const next = [...found.lines.slice(0, found.begin + 1), ...lines.map((line) => `${line}${eol}`), ...found.lines.slice(found.end)].join("\n");
		if (next === text) continue;
		writeFileSync(path, next);
		changed.push(path);
	}
	if (marked > 0) return { changed };
	return {
		changed,
		hint: `no agent instruction file has the nosedive placeholder: paste these two lines into one of ${INSTRUCTION_FILES.join(", ")}, then run nosedive seed again:\n  ${SURFACE_BEGIN}\n  ${SURFACE_END}`,
	};
}

/** A file's text with its managed block emptied, so two texts compare by what lies outside it. */
function outside(text: string): string {
	const found = managed(text);
	return found ? [...found.lines.slice(0, found.begin + 1), ...found.lines.slice(found.end)].join("\n") : text;
}

/** Whether a file the write changed differs from git's HEAD only inside its block, or is an AGENTS.md it created holding nothing else: only then may seed commit it. */
export function ownChange(path: string): boolean {
	const text = readFileSync(path, "utf8");
	const head = spawnSync("git", ["show", `HEAD:./${basename(path)}`], { cwd: dirname(path), encoding: "utf8" });
	if (head.status === 0) return outside(head.stdout) === outside(text);
	return basename(path) === "AGENTS.md" && outside(text) === `${SURFACE_BEGIN}\n${SURFACE_END}\n`;
}

/** One line for each marked instruction file whose block's stamp does not match the surface, or which carries no stamp; the surface is rendered only when some file is marked. */
export async function surfaceDrift(dir: string, render: () => Promise<string>): Promise<string[]> {
	const marked = INSTRUCTION_FILES.flatMap((file) => {
		const path = join(dir, file);
		if (!existsSync(path)) return [];
		const found = managed(readFileSync(path, "utf8"));
		return found ? [{ file, found }] : [];
	});
	if (marked.length === 0) return [];
	const digest = surfaceDigest(await render());
	return marked.flatMap(({ file, found }) => {
		const stamp = found.lines.slice(found.begin + 1, found.end).map((line) => STAMP.exec(line.replace(/\r$/, "").trim())).find(Boolean);
		return stamp?.[2] === digest ? [] : [`warning: ${file}'s agent instructions do not match this nosedive: run nosedive seed`];
	});
}
