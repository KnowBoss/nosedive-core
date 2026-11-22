import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";

/** The last nosedive that runs September's heroes. @see kb/01a204bc-1c1c-7395-b331-c57a3a342b05.md */
const SEPTEMBER = "2026.9.18";

/** A config bigger than this is no hero's. */
const MAX_CONFIG = 1 << 20;

/**
 * Whether the nearest `.nosedive/config.yaml` above `start`, the one find-bridge reads, names a `backlog` and no `roots`, as legacy-capes tests it.
 * A config that is not a regular file, is too big, or cannot be read or parsed is no match; none of it is opened unless it is a small regular file.
 */
function isSeptemberHero(start: string): boolean {
	for (let dir = resolve(start); ; dir = dirname(dir)) {
		const path = join(dir, ".nosedive", "config.yaml");
		if (existsSync(path)) {
			try {
				const stat = statSync(path);
				if (!stat.isFile() || stat.size > MAX_CONFIG) return false;
				const config = parse(readFileSync(path, "utf8")) as Record<string, unknown> | null;
				return typeof config === "object" && config !== null && !("roots" in config) && typeof config.backlog === "string";
			} catch {
				return false;
			}
		}
		if (dirname(dir) === dir) return false;
	}
}

/** Bare when plain, else in single quotes with each `'` closed, escaped and reopened: literal to bash and zsh whatever it holds. */
const bash = (arg: string) => (PLAIN.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`);
/** Bare when plain, else in single quotes with each quote, curly ones too, doubled: literal to PowerShell, which also reads a bare `@x` as a splat and `a,b` as a list. */
const powershell = (arg: string) => (PLAIN.test(arg) ? arg : `'${arg.replace(/['‘’‚‛]/g, "$&$&")}'`);
const PLAIN = /^[\w./:-][\w./:@-]*$/;

/**
 * The refusal for a command line run in `cwd`, the directory launch acts in, or undefined when that is no September hero.
 * It judges the hero launch would act through and nothing `--at` names, and reads nothing but that hero's config, so what it refuses is left as it was.
 * The command to run it with is one line when bash and PowerShell read it alike, else a line for each.
 */
export function i01a204bc1c1c7395b331c57a3a342b05(argv: string[], cwd: string): string | undefined {
	if (!isSeptemberHero(cwd)) return undefined;
	const line = (quote: (arg: string) => string) => ["npx", "-y", `nosedive@${SEPTEMBER}`, ...argv.map(quote)].join(" ");
	const head = "this hero is for September nosedive, and this nosedive does not run on it. Nothing was changed. Run this command line there";
	return line(bash) === line(powershell) ? `${head} with:\n  ${line(bash)}` : `${head}, in bash or zsh:\n  ${line(bash)}\nor in PowerShell:\n  ${line(powershell)}`;
}
