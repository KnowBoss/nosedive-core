import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";

/** The last nosedive that runs September's heroes. @see kb/01a204bc-1c1c-7395-b331-c57a3a342b05.md */
const SEPTEMBER = "2026.9.18";

/**
 * Whether `dir`'s `.nosedive/config.yaml` names a `backlog` and no `roots`, as legacy-capes tests it.
 * A config that is not a regular file, or cannot be read or parsed, is no match; it is opened only when it is a regular file, whatever its size, as core's own config reader does next. @see kb/01a20631-d3aa-790f-8fa8-88d8aea020ee.md
 */
function isSeptemberConfig(dir: string): boolean {
	try {
		const path = join(dir, ".nosedive", "config.yaml");
		const stat = statSync(path);
		if (!stat.isFile()) return false;
		const config = parse(readFileSync(path, "utf8")) as Record<string, unknown> | null;
		return typeof config === "object" && config !== null && !("roots" in config) && typeof config.backlog === "string";
	} catch {
		return false;
	}
}

/** The directory of the September hero `start` is in: the nearest `.nosedive/config.yaml` above it, the one find-bridge reads, when it is September's. */
function septemberRoot(start: string): string | undefined {
	for (let dir = resolve(start); ; dir = dirname(dir)) {
		if (existsSync(join(dir, ".nosedive", "config.yaml"))) return isSeptemberConfig(dir) ? dir : undefined;
		if (dirname(dir) === dir) return undefined;
	}
}

/** Whether two paths are one directory, as the file system sees them. */
function sameDirectory(a: string, b: string): boolean {
	try {
		return realpathSync.native(a) === realpathSync.native(b);
	} catch {
		return false;
	}
}

/** In single quotes with each `'` closed, escaped and reopened: literal to bash and zsh whatever it holds. */
const bashQuoted = (text: string) => `'${text.replace(/'/g, `'\\''`)}'`;

/** An argument bare when plain, else quoted; the root is always quoted, as legacy-line-anchor decides. */
const bash = (arg: string) => (BASH_PLAIN.test(arg) ? arg : bashQuoted(arg));
const BASH_PLAIN = /^[\w./:-][\w./:@=-]*$/;

/**
 * What npx's cmd.exe launch of a package on Windows does not hand over unchanged, whatever shell the line is pasted in: a newline cuts the command line there and a carriage return is dropped.
 * Observed with npm 11 for each of U+0001 to U+007F and a sample beyond; no other character changed. @see kb/01a20622-90a9-733d-9bcb-aca009dc4338.md
 */
const CMD_CUTS = /[\r\n]/;

/** In single quotes with each quote, curly ones too, doubled: literal to PowerShell. */
const powershellPath = (path: string) => `'${path.replace(/['‘’‚‛]/g, "$&$&")}'`;

/**
 * What the real npx.ps1 hands to nosedive unchanged under Windows PowerShell 5.1 and pwsh when typed bare, and a little less: a word, an option (two hyphens), a relative path of `.` and `..`,
 * or a hyphenated id such as a uuid. Never an empty argument, a quote, a bare `--`, a single hyphen, a number or an operator, nor any of `,` `@` `$` `;` `&` `|` `~` `{` `(` `<` `#` `` ` ``
 * or a space, which PowerShell reads for itself or npx.ps1 loses. @see kb/01a205f6-1f86-7182-9b37-fd3c1a2badb7.md
 */
const POWERSHELL_PLAIN = [/^[A-Za-z][\w.:=/-]*$/, /^--[A-Za-z][\w.:=/-]*$/, /^\.{1,2}(?:\/[\w.:=-]+)*\/?$/, /^(?=.*[a-f])\d[0-9a-f]*(?:-[0-9a-f]+)+$/i];
const passesPowershell = (arg: string) => POWERSHELL_PLAIN.some((plain) => plain.test(arg));

/**
 * The refusal for a command line run in `cwd`, the directory launch acts in, or undefined when that is no September hero.
 * It judges the hero launch would act through and nothing `--at` names, and reads nothing but that hero's config, so what it refuses is left as it was.
 * `enclosing` is the hero whose workspace holds the checkout `cwd` is in, which is then the hero rather than the nearest config.
 * 2026.9.18 acts on the directory it is run in, so the line to run is given only at the hero's root, anchored there; anywhere else the refusal names the root and says to run again from it.
 * `platform` is where the line would be run, this one unless a test says otherwise: on Windows an argument npx's cmd.exe launch would cut gets no line, and the refusal names it.
 */
export function i01a204bc1c1c7395b331c57a3a342b05(argv: string[], cwd: string, enclosing?: string, platform: NodeJS.Platform = process.platform): string | undefined {
	const root = enclosing === undefined ? septemberRoot(cwd) : isSeptemberConfig(enclosing) ? resolve(enclosing) : undefined;
	if (root === undefined) return undefined;
	const head = "this hero is for September nosedive, and this nosedive does not run on it. Nothing was changed.";
	// NOSEDIVE_HERO makes cwd the hero's whatever directory the arguments were typed in.
	const typedAtRoot = enclosing === undefined && resolve(cwd) === root && (!process.env.NOSEDIVE_HERO || sameDirectory(process.cwd(), root));
	if (!typedAtRoot) return `${head} The hero's root is '${root}': run the same command again from there, which prints the command line to run it with.`;
    const cut = platform === "win32" ? argv.find((arg) => CMD_CUTS.test(arg)) : undefined;
    if (cut !== undefined) return `${head} The hero's root is '${root}'. The command line to run it with cannot be given on Windows: the argument ${JSON.stringify(cut)} holds a line break, which npx's cmd.exe launch of September nosedive cuts or drops.`;
    const npx = ["npx", "-y", `nosedive@${SEPTEMBER}`];
    const lines = [`${head} To run this command line with September nosedive, in bash or zsh:`, `  ${[`cd ${bashQuoted(root)} &&`, ...npx, ...argv.map(bash)].join(" ")}`];
	if (!argv.every(passesPowershell)) return [...lines, "No PowerShell line is given because an argument would not pass through npx.ps1 unchanged."].join("\n");
	return [...lines, "or in PowerShell:", `  ${[`Set-Location -LiteralPath ${powershellPath(root)};`, ...npx, ...argv].join(" ")}`].join("\n");
}
