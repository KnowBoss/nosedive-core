import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The agent instruction files a hero may hold, read by the write and the drift check alike. */
export const INSTRUCTION_FILES = ["AGENTS.md", "CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md"];
export const SURFACE_BEGIN = "<!-- BEGIN nosedive managed instructions -->";
export const SURFACE_END = "<!-- END nosedive managed instructions -->";
const STAMP = /^<!-- nosedive v=(\S+) surface=([0-9a-f]{8}) -->$/;

const GUIDANCE = [
	"Instructions in `nosedive` output come first.",
	"A line starting `nose:` is a call to attention: handle it before any other work.",
	"When the pilot needs help finding work, run `nosedive next`.",
];

/** The first 8 hex of the sha256 of the surface, trimmed, so two cores rendering the same surface agree. */
export function surfaceDigest(surface: string): string {
	return createHash("sha256").update(surface.trim()).digest("hex").slice(0, 8);
}

/** Where a file's managed block lies: the lines between its markers, each on a line of its own, or nothing when it has no such pair. */
function managed(text: string): { lines: string[]; begin: number; end: number } | undefined {
	const lines = text.split("\n");
	const at = (marker: string, from: number) => lines.findIndex((line, index) => index >= from && line.replace(/\r$/, "").trim() === marker);
	const begin = at(SURFACE_BEGIN, 0);
	if (begin < 0) return undefined;
	const end = at(SURFACE_END, begin + 1);
	return end < 0 ? undefined : { lines, begin, end };
}

function block(surface: string, version: string): string[] {
	const body = surface.trim();
	const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((run) => run.length));
	const fence = "`".repeat(Math.max(3, longest + 1));
	return [`<!-- nosedive v=${version} surface=${surfaceDigest(body)} -->`, "", ...GUIDANCE.map((line) => `- ${line}`), "", fence, body, fence];
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
		const next = [...found.lines.slice(0, found.begin + 1), ...lines, ...found.lines.slice(found.end)].join("\n");
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

/** One line for each marked instruction file whose block's stamp does not match the surface, or which carries no stamp. */
export function surfaceDrift(dir: string, surface: string): string[] {
	const digest = surfaceDigest(surface);
	return INSTRUCTION_FILES.flatMap((file) => {
		const path = join(dir, file);
		if (!existsSync(path)) return [];
		const found = managed(readFileSync(path, "utf8"));
		if (!found) return [];
		const stamp = found.lines.slice(found.begin + 1, found.end).map((line) => STAMP.exec(line.replace(/\r$/, "").trim())).find(Boolean);
		return stamp?.[2] === digest ? [] : [`${file}'s agent instructions do not match this nosedive: run nosedive seed`];
	});
}
