import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";

/** The last nosedive that runs September's heroes. @see kb/01a204bc-1c1c-7395-b331-c57a3a342b05.md */
const SEPTEMBER = "2026.9.18";

/** Whether the nearest `.nosedive/config.yaml` above `start` names a `backlog` and no `roots`, as legacy-capes tests it; a config that cannot be read or parsed is no match. */
function isSeptemberHero(start: string): boolean {
	for (let dir = resolve(start); ; dir = dirname(dir)) {
		const path = join(dir, ".nosedive", "config.yaml");
		if (existsSync(path)) {
			try {
				const config = parse(readFileSync(path, "utf8")) as Record<string, unknown> | null;
				return typeof config === "object" && config !== null && !("roots" in config) && typeof config.backlog === "string";
			} catch {
				return false;
			}
		}
		if (dirname(dir) === dir) return false;
	}
}

/** One argument as a shell takes it literally: bare when it is plain, else single-quoted, PowerShell's way on Windows and POSIX's elsewhere. */
function quote(arg: string): string {
	if (/^[\w@%+=:,./-]+$/.test(arg)) return arg;
	return process.platform === "win32" ? `'${arg.replace(/'/g, "''")}'` : `'${arg.replace(/'/g, `'\\''`)}'`;
}

/**
 * The refusal for a command line aimed at a September hero, or undefined for any other: the hero is the one `--at` names, else the one holding `cwd`.
 * It reads nothing but config files, so what it refuses is left as it was.
 */
export function i01a204bc1c1c7395b331c57a3a342b05(argv: string[], cwd: string): string | undefined {
	const target = argv[0] === "--at" && argv[1] !== undefined ? resolve(cwd, argv[1]) : cwd;
	if (!isSeptemberHero(target)) return undefined;
	return `this hero is for September nosedive, and this nosedive does not run on it. Nothing was changed. Run this command line there with:\n  ${["npx", "-y", `nosedive@${SEPTEMBER}`, ...argv.map(quote)].join(" ")}`;
}
