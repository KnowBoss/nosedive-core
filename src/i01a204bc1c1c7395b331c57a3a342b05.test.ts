// legacy-hero-guard
import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { after, test, type TestContext } from "node:test";
import { i01a204bc1c1c7395b331c57a3a342b05 as guard } from "./i01a204bc1c1c7395b331c57a3a342b05.ts";
import { git, gitRepo, realPath, run, tempDir } from "../test/harness.ts";

const OLD = "2026.9.18";
const BACKLOG = "01a204bc-0000-7000-8000-000000000001";
const MODERN = "01a204bc-0000-7000-8000-000000000002";
const isWindows = process.platform === "win32";
const CORE_DIR = join(import.meta.dirname, "..");

const HEAD = "nosedive: this hero is for September nosedive, and this nosedive does not run on it. Nothing was changed.";
const TO_RUN = `${HEAD} To run this command line with September nosedive, in bash or zsh:`;
const NO_POWERSHELL = "No PowerShell line is given because an argument would not pass through npx.ps1 unchanged.";
/** What a command gets from anywhere but the hero's root: no npx line, the root, and where to run it again. */
const elsewhere = (root: string) => `${HEAD} The hero's root is '${root}': run the same command again from there, which prints the command line to run it with.`;

/** The arguments the tests type that the real npx.ps1 passes unchanged and the guard puts in a PowerShell line; every other argument gets the bash line alone. */
const POWERSHELL_SAFE = new Set([
	"help", "--help", "--more", "crud", "pass", "no-such-action", "seed", "--no-capes", "memo", "mint", "next", "dock", "scratch", "jump", "land", "pack", "bail", "--reason", "trial",
	"work:jump", "core:seed", "record.repo", "record.dive", "--feat", "add-a-hello-note", "--gist", "Second", "--brief", "preflight", "list-dives", "--at", "kb", "x", "--drop", BACKLOG,
	"./kb/sub", "./not-there-yet", "./workspace/scratch", "./workspace/inner", "--meta:k=v", "--meta:feat=abc", "kb/x.md", "A-B", "a:b", "a.b", "x_y", "--at=x", "--k=v", "./", "../x", "../x/y.z", ".", "..", "true", "false", "null",
	"if", "function", "01a205fc-9f4a-7578-9ba5-ca524f8f269f",
]);

/** What a command line holding a line break gets at the root on Windows (legacy-line-windows-newline): no npx line, and the argument npx's cmd.exe launch would cut. */
const unpassable = (root: string, arg: string) => `${HEAD} The hero's root is '${root}'. The command line to run it with cannot be given on Windows: the argument ${JSON.stringify(arg)} holds a line break, which npx's cmd.exe launch of September nosedive cuts or drops.`;
const hasLineBreak = (arg: string) => /[\r\n]/.test(arg);

/** The refusal for these arguments typed in `here`, a hero's `root` or somewhere else in or beside it, written out as the message says it. */
function refusal(argv: string[], root: string, here = root): string {
	if (here !== root) return elsewhere(root);
	if (isWindows && argv.some(hasLineBreak)) return unpassable(root, argv.find(hasLineBreak)!);
	const bash = (arg: string) => (/^[\w./:-][\w./:@=-]*$/.test(arg) ? arg : `'${arg.replace(/'/g, "'\\''")}'`);
	const bashLine = `  ${[`cd '${root.replace(/'/g, "'\\''")}' &&`, "npx", "-y", `nosedive@${OLD}`, ...argv.map(bash)].join(" ")}`;
	if (!argv.every((arg) => POWERSHELL_SAFE.has(arg))) return `${TO_RUN}\n${bashLine}\n${NO_POWERSHELL}`;
	return `${TO_RUN}\n${bashLine}\nor in PowerShell:\n  Set-Location -LiteralPath '${root.replace(/['‘’‚‛]/g, "$&$&")}'; ${["npx", "-y", `nosedive@${OLD}`, ...argv].join(" ")}`;
}

/** The checkout refusal launch has always given inside a hero's workspace, which a September hero's kept checkout no longer gets. */
const CHECKOUT = /a checkout is never a hero/;

/** The real command line, built when a build is there and from source otherwise (CI builds first), run as a process. */
function cliArgs(): string[] {
	const built = join(CORE_DIR, "dist", "cli.js");
	if (existsSync(built)) return ["--disable-warning=ExperimentalWarning", built];
	if (process.env.CI) assert.fail("dist/cli.js is missing: CI builds before it tests");
	return ["--disable-warning=ExperimentalWarning", join(CORE_DIR, "scripts", "dev.mjs")];
}
function cli(argv: string[], cwd: string, env: NodeJS.ProcessEnv = {}): { code: number | null; out: string; err: string } {
	const result = spawnSync(process.execPath, [...cliArgs(), ...argv], { cwd, env: { ...process.env, ...env }, encoding: "utf8" });
	return { code: result.status, out: result.stdout, err: result.stderr.trim() };
}

/** A directory whose config is `config`, with nothing else. */
function hero(label: string, config: string): string {
	const dir = tempDir(label);
	mkdirSync(join(dir, ".nosedive"));
	writeFileSync(join(dir, ".nosedive", "config.yaml"), config);
	return dir;
}

const SEPTEMBER = `compatibility-level: 2\nworkspace: ./workspace\nbacklog: ${BACKLOG}\nkb: ./kb\nbridge: ${BACKLOG}\n`;

/** Every file and directory under `dirs`, by path and its mode, modified time and, for a file, the hash of its bytes: a git index refreshed for nothing shows. */
function snapshot(...dirs: string[]): Record<string, string> {
	const seen: Record<string, string> = {};
	const walk = (dir: string, root: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			const key = `${relative(join(root, ".."), path)}`;
			const stat = statSync(path);
			const meta = `${stat.mode.toString(8)} ${stat.mtimeMs}`;
			if (entry.isDirectory()) {
				seen[`${key}/`] = `dir ${meta}`;
				walk(path, root);
			} else seen[key] = `${entry.isFile() ? createHash("sha256").update(readFileSync(path)).digest("hex") : "other"} ${meta}`;
		}
	};
	for (const dir of dirs) walk(dir, dir);
	return seen;
}

test("a September hero refuses every command line, naming the old nosedive to run it with at its root, and changes nothing", async () => {
	const dir = hero("legacy-hero-guard", SEPTEMBER);
	mkdirSync(join(dir, "workspace", "scratch"), { recursive: true });
	mkdirSync(join(dir, "kb", "sub"), { recursive: true });
	mkdirSync(join(dir, "workspace", "scratch", "deeper"), { recursive: true });
	const before = snapshot(dir);
	const refused: string[][] = [
		[],
		["help"],
		["--help"],
		["--help", "--more"],
		["crud", "--help"],
		["no-such-action"],
		["seed"],
		["seed", "--no-capes"],
		["crud", "memo", "one two"],
		["crud", "memo", "it's $HOME"],
		["crud", "memo", ""],
		["core:seed"],
		// --at is judged by the hero the command runs in, which it does not choose.
		["--at", "kb", "crud", "memo", "x"],
		["--at", "./kb/sub", "seed"],
		["--at", "./not-there-yet", "seed"],
		["--at"],
		["seed", "--at", "kb"],
		["crud", "--at", "kb", "memo", "x"],
	];
	for (const argv of refused) assert.deepEqual(await run(argv, dir), { code: 1, out: "", err: refusal(argv, dir) }, argv.join(" "));
	// From a subdirectory, from the workspace and from a kept checkout in it, the refusal names the root and gives no npx line.
	for (const cwd of [join(dir, "kb"), join(dir, "kb", "sub"), join(dir, "workspace"), join(dir, "workspace", "scratch"), join(dir, "workspace", "scratch", "deeper")]) {
		const result = await run(["seed", "--no-capes"], cwd);
		assert.deepEqual(result, { code: 1, out: "", err: elsewhere(dir) }, cwd);
		assert.doesNotMatch(result.err, /npx|--at|NOSEDIVE_HERO/);
	}
	assert.deepEqual(snapshot(dir), before);
});

test("the refusal's lines are verbatim", async () => {
	const dir = hero("legacy-hero-guard-verbatim", SEPTEMBER);
	const at = async (argv: string[]) => (await run(argv, dir)).err;
	const both = (args: string) => `${TO_RUN}\n  cd '${dir}' && npx -y nosedive@2026.9.18${args}\nor in PowerShell:\n  Set-Location -LiteralPath '${dir}'; npx -y nosedive@2026.9.18${args}`;
	assert.equal(await at([]), both(""));
	assert.equal(await at(["seed", "--no-capes"]), both(" seed --no-capes"));
	assert.equal(await at(["crud", "--meta:feat=a/b", "./kb/sub", "01a205fc-9f4a-7578-9ba5-ca524f8f269f"]), both(" crud --meta:feat=a/b ./kb/sub 01a205fc-9f4a-7578-9ba5-ca524f8f269f"));
	// A bash line alone, and why there is no other.
	const bashOnly = (args: string) => `${TO_RUN}\n  cd '${dir}' && npx -y nosedive@2026.9.18${args}\n${NO_POWERSHELL}`;
	assert.equal(await at(["crud", "memo", "one two"]), bashOnly(" crud memo 'one two'"));
	assert.equal(await at(["crud", "memo", "it's $HOME", "", "@x"]), bashOnly(" crud memo 'it'\\''s $HOME' '' '@x'"));
	for (const [arg, quoted] of [["1", "1"], ["007", "007"], ["1kb", "1kb"], ["0x10", "0x10"], ["-x", "-x"], ["--", "--"], ["-a:b", "-a:b"], ["a,b", "'a,b'"], ["$x", "'$x'"], ["8f269f", "8f269f"], ["~", "'~'"], ["a;b", "'a;b'"], ["", "''"]]) {
		assert.equal(await at(["jump", arg]), bashOnly(` jump ${quoted}`), `jump ${JSON.stringify(arg)}`);
	}
	// What is left of the safe set: words, options, relative paths and hyphenated ids go bare in both.
	for (const arg of ["seed", "A-b_c.d:e=f/g", "--no-capes", "--meta:k=v", "--at=x", ".", "..", "./", "../x", "./a/b.c", "0e12-1", "01a205fc-9f4a-7578-9ba5-ca524f8f269f"]) {
		assert.equal(await at(["jump", arg]), both(` jump ${arg}`), arg);
	}
	// The root is quoted, in each shell its own way, whatever it holds.
	const odd = join(tempDir("legacy-hero-guard-odd-root"), "it's ‘here’");
	mkdirSync(join(odd, ".nosedive"), { recursive: true });
	writeFileSync(join(odd, ".nosedive", "config.yaml"), SEPTEMBER);
	assert.equal((await run(["seed"], odd)).err, `${TO_RUN}\n  cd '${odd.replace(/'/g, "'\\''")}' && npx -y nosedive@2026.9.18 seed\nor in PowerShell:\n  Set-Location -LiteralPath '${odd.replace(/['‘’]/g, "$&$&")}'; npx -y nosedive@2026.9.18 seed`);
	assert.equal((await run(["seed"], join(odd, "kb"))).err, elsewhere(odd));
});

test("the root is single-quoted in the bash line even when it is plain", { skip: isWindows && "a Windows root is never plain: it holds a colon and backslashes" }, () => {
	const dir = mkdtempSync("/tmp/legacy-hero-guard-plain-");
	after(() => rmSync(dir, { recursive: true, force: true }));
	mkdirSync(join(dir, ".nosedive"));
	writeFileSync(join(dir, ".nosedive", "config.yaml"), SEPTEMBER);
	assert.match(dir, /^[\w./-]+$/, "the root is one bash would take bare");
	const bare = (message: string) => message.slice("nosedive: ".length);
	assert.equal(guard(["seed"], dir), `${bare(TO_RUN)}\n  cd '${dir}' && npx -y nosedive@2026.9.18 seed\nor in PowerShell:\n  Set-Location -LiteralPath '${dir}'; npx -y nosedive@2026.9.18 seed`);
	assert.equal(guard(["crud", "memo", "one two"], dir), `${bare(TO_RUN)}\n  cd '${dir}' && npx -y nosedive@2026.9.18 crud memo 'one two'\n${NO_POWERSHELL}`);
});

test("on Windows an argument npx's cmd.exe launch would cut gets no line in either shell and is named; elsewhere it is pasted through bash as typed", async () => {
	const dir = hero("legacy-hero-guard-windows", SEPTEMBER);
	mkdirSync(join(dir, "kb"));
	const bare = (message: string) => message.slice("nosedive: ".length);
	for (const arg of ["two\nlines", "carriage\rreturn", "dos\r\nline", "\n"]) {
		const argv = ["crud", "memo", arg];
		// The first such argument is the one named, and a line is held back whatever else is typed.
		assert.equal(guard(argv, dir, undefined, "win32"), bare(unpassable(dir, arg)), JSON.stringify(arg));
		assert.equal(guard(["x y", ...argv, "a\nb"], dir, undefined, "win32"), bare(unpassable(dir, arg)), JSON.stringify(arg));
		assert.doesNotMatch(guard(argv, dir, undefined, "win32")!, /npx -y|Set-Location|\bcd '/);
		for (const platform of ["linux", "darwin"] as const) {
			assert.equal(guard(argv, dir, undefined, platform), `${bare(TO_RUN)}\n  cd '${dir.replace(/'/g, "'\\''")}' && npx -y nosedive@2026.9.18 crud memo '${arg}'\n${NO_POWERSHELL}`, `${platform} ${JSON.stringify(arg)}`);
		}
	}
	// Nothing else changes on Windows: the other characters the launch passes, spaces, quotes, percent signs and backslashes, still get the bash line.
	const others = ["crud", "memo", "one two", "it's", "100%", 'say "hi"', "back\\slash", "tab\there", "^&|<>()!", "café"];
	const line = guard(others, dir, undefined, "win32")!;
	assert.equal(line, guard(others, dir, undefined, "linux"));
	assert.match(line, /\n  cd '/);
	// Away from the root no line is printed anyway, so the refusal is the one every platform gives.
	assert.equal(guard(["a\nb"], join(dir, "kb"), undefined, "win32"), bare(elsewhere(dir)));
	// As a process on this machine, whichever it is.
	assert.deepEqual(await run(["crud", "memo", "two\nlines"], dir), { code: 1, out: "", err: refusal(["crud", "memo", "two\nlines"], dir) });
});

/** A package standing in for nosedive@2026.9.18, which prints the arguments and directory it was run with. */
function stubPackage(): string {
	const dir = tempDir("legacy-hero-guard-stub");
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "nosedive", version: OLD, bin: { nosedive: "cli.js" } }));
	// ASCII only, so no shell re-reads what it prints.
	writeFileSync(join(dir, "cli.js"), '#!/usr/bin/env node\nprocess.stdout.write("@@" + JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }).replace(/[\\u0080-\\uffff]/g, (c) => "\\\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")) + "\\n");\n');
	return dir;
}

/** The environment a shell runs a pasted line in: the real npx ahead of the tests' stub, and an npm that touches nothing of the user's. */
function shellEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {};
	for (const [key, value] of Object.entries(process.env)) if (!/^path$/i.test(key)) env[key] = value;
	return { ...env, PATH: realPath, ...extra };
}

/** Whether a tool is missing: where CI has it that is a failure, and elsewhere there is nothing to run. */
function missing(result: SpawnSyncReturns<string>, what: string): boolean {
	if (!result.error) return false;
	assert.ok(!process.env.CI, `${what} is not here, and CI has it: ${result.error.message}`);
	return true;
}

type Shell = "bash" | "pwsh" | "powershell";
/** Each shell a line is pasted into: Windows PowerShell 5.1 exists only on Windows, where it is what npx.ps1 meets by default. */
const SHELLS: Shell[] = isWindows ? ["bash", "pwsh", "powershell"] : ["bash", "pwsh"];

/** What each pasted line made the stub print, or undefined where the shell is absent and CI does not need it; the shell must also have found the npx it is meant to. */
function pasteAll(shell: Shell, lines: string[], from: string, env: NodeJS.ProcessEnv): { argv: string[]; cwd: string }[] | undefined {
	// The lines run as the shell's own statements, one after the other, as if pasted; a PowerShell one first names the npx it resolves.
	const script = shell === "bash" ? lines.join("\n") : ['Write-Output ("@@npx " + (Get-Command npx).Source)', ...lines].join("\n");
	const args = shell === "bash" ? ["-c", script] : ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")];
	const result = spawnSync(shell === "powershell" ? "powershell.exe" : shell, args, { cwd: from, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 400_000 });
	if (missing(result, shell)) return undefined;
	assert.equal(result.status, 0, `${shell}: ${script}\n${result.stdout}\n${result.stderr}`);
	const printed = result.stdout.split(/\r?\n/).filter((line) => line.startsWith("@@"));
	const resolved = printed.find((line) => line.startsWith("@@npx "));
	if (shell !== "bash") {
		assert.ok(resolved, `${shell} printed no npx: ${result.stdout}`);
		// Windows resolves npx to npx.ps1 in both PowerShells; that script is what the lines are pasted through.
		if (isWindows) assert.match(resolved, /npx\.ps1$/i, `${shell} resolved ${resolved}`);
	}
	const records = printed.filter((line) => !line.startsWith("@@npx ")).map((line) => JSON.parse(line.slice(2)) as { argv: string[]; cwd: string });
	assert.equal(records.length, lines.length, `${shell} ran ${records.length} of ${lines.length} lines:\n${result.stdout}\n${result.stderr}`);
	return records;
}

/** The bash line, and the PowerShell line when there is one, a refusal prints. */
function printedLines(message: string): { bash: string; powershell?: string } {
	const start = message.indexOf("in bash or zsh:\n  ") + "in bash or zsh:\n  ".length;
	const other = message.indexOf("\nor in PowerShell:\n  ");
	if (other >= 0) return { bash: message.slice(start, other), powershell: message.slice(other + "\nor in PowerShell:\n  ".length) };
	assert.ok(message.endsWith(`\n${NO_POWERSHELL}`), message);
	return { bash: message.slice(start, message.length - NO_POWERSHELL.length - 1) };
}

test("printed lines, pasted through the real npx into bash, Windows PowerShell and pwsh, run in the root and hand the package the arguments typed", { timeout: 900_000 }, async (t) => {
	const stub = stubPackage();
	const npmCache = join(tempDir("legacy-hero-guard-npm-cache"), "cache");
	const env = shellEnv({ npm_config_cache: npmCache, npm_config_offline: "true", npm_config_update_notifier: "false" });
	// A hero with the stub installed as its dependency, so that the line's own npx finds nosedive@2026.9.18 without a registry.
	const withStub = (dir: string): boolean => {
		writeFileSync(join(dir, "package.json"), '{"name":"hero","version":"1.0.0"}');
		const result = spawnSync("npm", ["i", stub, "--no-audit", "--no-fund", "--ignore-scripts"], { cwd: dir, env, encoding: "utf8", shell: isWindows });
		if (missing(result, "npm")) return false;
		assert.equal(result.status, 0, `npm i: ${result.stdout}${result.stderr}`);
		return true;
	};
	const plain = hero("legacy-hero-guard-paste", SEPTEMBER);
	const odd = join(tempDir("legacy-hero-guard-paste-odd"), "it's ‘here’ ok");
	mkdirSync(join(odd, ".nosedive"), { recursive: true });
	writeFileSync(join(odd, ".nosedive", "config.yaml"), SEPTEMBER);
	if (!withStub(plain)) return t.skip("npm is not here");
	withStub(odd);
	const safe: string[][] = [
		[], ["seed"], ["seed", "--no-capes"], ["--at", "./kb/sub", "seed"], ["crud", "memo", "--meta:feat=abc"], ["jump", "01a205fc-9f4a-7578-9ba5-ca524f8f269f"], ["dock", "../x"], ["list-dives"],
		["a.b", "kb/x.md", "A-B", "a:b", "x_y", "--at=x", "--k=v", "./", "../x/y.z", ".", ".."], ["true", "false", "null", "if", "function", "work:jump"],
	];
	// Each is an argument PowerShell or npx.ps1 changes or drops, or reads as a number or an operator, so no PowerShell line is given for it; bash passes all of them as they are.
	const unsafe = [
		"a b", "it's", "it's $HOME", "`id`", "$(echo x)", "$x", "$true", "100%", "hi!", 'say "hi"', "back\\slash", "two\nlines", "", "*.md", "@file", "@{a=1}", "x,y", "1,2", "--", "-", "+", "-x", "-a:b",
		"carriage\rreturn", "dos\r\nline", "-ErrorAction:Stop", "--%", "~", "~/x", "#c", "{a}", "(x)", "a;b", "a&b", "a|b", "<x>", "‘curly’", "café", "1", "-1", "007", "1.5", "1kb", "0x10", "1e3", "1d", "1n", "8f269f", "2024-01-01", "1-2",
	].map((arg) => ["crud", arg]);
	const needed = new Set<Shell>();
	const heroes: [string, string[][]][] = [[plain, [...safe, ...unsafe]], [odd, [["seed"], ["crud", "it's", "1"]]]];
	for (const [dir, cases] of heroes) {
		const lines: { bash: string; powershell?: string; argv: string[] }[] = [];
		for (const argv of cases) {
			const message = (await run(argv, dir)).err;
			assert.equal(message, refusal(argv, dir), argv.join(" "));
			// On Windows npx's cmd.exe launch cuts such an argument, so the refusal gives no line to paste (legacy-line-windows-newline); elsewhere bash passes it as typed.
			if (isWindows && argv.some(hasLineBreak)) continue;
			lines.push({ ...printedLines(message), argv });
		}
		for (const shell of SHELLS) {
			const got = pasteAll(shell, lines.flatMap((line) => (shell === "bash" ? [line.bash] : line.powershell === undefined ? [] : [line.powershell])), tempDir("legacy-hero-guard-away"), env);
			if (!got) continue;
			needed.add(shell);
			const sent = lines.filter((line) => shell === "bash" || line.powershell !== undefined);
			for (const [at, line] of sent.entries()) {
				assert.deepEqual(got[at]!.argv, line.argv, `${shell}: ${shell === "bash" ? line.bash : line.powershell}`);
				// Run from a directory of its own, the line still acted in the hero: its cd or Set-Location anchored it.
				assert.equal(realpathSync.native(got[at]!.cwd), realpathSync.native(dir), `${shell} ran in ${got[at]!.cwd}`);
			}
			if (shell !== "bash") assert.ok(sent.length >= (dir === plain ? safe.length : 1), `${shell} had lines to run`);
		}
	}
	if (process.env.CI) assert.deepEqual([...needed].sort(), [...SHELLS].sort(), "every shell CI needs ran");
});

test("a command line run in a September hero's subdirectory, workspace or kept checkout, or named by NOSEDIVE_HERO from elsewhere, gets the root and no npx line", () => {
	const dir = hero("legacy-hero-guard-redirect", SEPTEMBER);
	mkdirSync(join(dir, "workspace", "scratch"), { recursive: true });
	mkdirSync(join(dir, "kb", "sub"), { recursive: true });
	const away = tempDir("legacy-hero-guard-away");
	const redirected = elsewhere(dir);
	// Run from outside with NOSEDIVE_HERO, 2026.9.18 would act on the directory it is in, so the line is held back, whatever NOSEDIVE_HERO names.
	for (const named of [dir, join(dir, "kb", "sub"), join(dir, "workspace"), join(dir, "workspace", "scratch")]) {
		assert.deepEqual(cli(["seed"], away, { NOSEDIVE_HERO: named }), { code: 1, out: "", err: redirected }, named);
	}
	// Run at the root, it is where the arguments were typed, so the anchored line is given as it is anywhere else.
	assert.deepEqual(cli(["seed"], dir, { NOSEDIVE_HERO: dir }), { code: 1, out: "", err: refusal(["seed"], dir) });
	assert.deepEqual(cli(["seed"], dir), { code: 1, out: "", err: refusal(["seed"], dir) });
	// Without NOSEDIVE_HERO, a subdirectory or the kept checkout is not the root either.
	for (const cwd of [join(dir, "kb", "sub"), join(dir, "workspace", "scratch")]) assert.deepEqual(cli(["seed"], cwd), { code: 1, out: "", err: redirected }, cwd);
});

test("nothing in the refusal suggests a newer version or a way past it", async () => {
	const dir = hero("legacy-hero-guard-words", SEPTEMBER);
	mkdirSync(join(dir, "kb"));
	// The root is named by path, which holds this test's label: it is the message's words that are judged.
	for (const cwd of [dir, join(dir, "kb")]) assert.doesNotMatch((await run(["seed"], cwd)).err.replaceAll(dir, "<root>"), /newer|latest|upgrade|update|migrat|npm i|--force|--yes|skip|bypass|legacy|override|--at|NOSEDIVE_HERO/i);
});

test("pre-push.hook still exits 0 silently in a September hero", async () => {
	const dir = hero("legacy-hero-guard-hook", SEPTEMBER);
	mkdirSync(join(dir, "workspace", "scratch"), { recursive: true });
	assert.deepEqual(await run(["pre-push.hook", "origin", "url"], dir), { code: 0, out: "", err: "" });
	// Nor does the kept checkout's refusal, or the September one, come before it.
	assert.deepEqual(await run(["pre-push.hook", "origin", "url"], join(dir, "workspace", "scratch")), { code: 0, out: "", err: "" });
});

test("a repo that is no September hero is not refused", async () => {
	const withRoots = hero("legacy-hero-guard-roots", `${SEPTEMBER}roots:\n  - kb/${BACKLOG}.md\n`);
	const cases: [string, string][] = [
		["a hero mid-migration, with roots beside its backlog", withRoots],
		["a hero with roots", hero("legacy-hero-guard-modern", `id: ${MODERN}\nroots:\n  - kb/${MODERN}.md\nworkspace: ./workspace\n`)],
		["a backlog that is a list", hero("legacy-hero-guard-list", "backlog:\n  - a\n  - b\n")],
		["a backlog that is empty", hero("legacy-hero-guard-null", "backlog:\n")],
		["a backlog that is a number", hero("legacy-hero-guard-number", "backlog: 7\n")],
		["no backlog", hero("legacy-hero-guard-none", "workspace: ./workspace\n")],
		["an empty config", hero("legacy-hero-guard-empty", "")],
		["a config that is a list", hero("legacy-hero-guard-seq", "- backlog\n")],
		["a config that is not yaml", hero("legacy-hero-guard-broken", "backlog: [unclosed\n  : :\n")],
	];
	for (const [label, dir] of cases) {
		const result = await run(["--help"], dir);
		assert.doesNotMatch(result.err, /September/, label);
	}
	for (const [label, dir] of cases.slice(0, 1)) assert.equal((await run(["--help"], dir)).code, 0, label);
	// A hero mid-migration has a kept checkout too, and keeps launch's refusal there.
	mkdirSync(join(withRoots, "workspace", "scratch"), { recursive: true });
	const checkout = await run(["seed"], join(withRoots, "workspace", "scratch"));
	assert.doesNotMatch(checkout.err, /September/);
	assert.match(checkout.err, CHECKOUT);
	// A config that cannot be read at all is no match either, and never a crash.
	const unreadable = tempDir("legacy-hero-guard-unreadable");
	mkdirSync(join(unreadable, ".nosedive", "config.yaml"), { recursive: true });
	assert.doesNotMatch((await run(["--help"], unreadable)).err, /September/);
	// Outside any hero it runs as before.
	const outside = await run(["--help"], tempDir("legacy-hero-guard-outside"));
	assert.equal(outside.code, 0);
	assert.match(outside.out, /^Usage: nosedive/);
});

const MODERN_CONFIG = `id: ${MODERN}\nroots:\n  - kb/${MODERN}.md\nworkspace: ./workspace\n`;

/** A hero of `config` with a hero of `inner` in its workspace, at workspace/inner. */
function nestedHeroes(label: string, config: string, inner: string): { host: string; inner: string } {
	const host = hero(label, config);
	mkdirSync(join(host, "workspace", "inner", ".nosedive"), { recursive: true });
	writeFileSync(join(host, "workspace", "inner", ".nosedive", "config.yaml"), inner);
	return { host, inner: join(host, "workspace", "inner") };
}

test("the guard judges the hero launch runs in, whatever --at and NOSEDIVE_HERO name", async () => {
	// A modern hero is never refused because --at points into a September one, which the command does not act through...
	const modern = nestedHeroes("legacy-hero-guard-modern-host", MODERN_CONFIG, SEPTEMBER);
	const into = await run(["--at", "./workspace/inner", "crud", "memo", "x"], modern.host);
	assert.doesNotMatch(into.err, /September/);
	assert.match(into.err, /no kind memo is declared/, "launch went on as before");
	// ...and a September hero is refused though --at points at a modern one, which it would act through the September one's bridge.
	const old = nestedHeroes("legacy-hero-guard-old-host", SEPTEMBER, MODERN_CONFIG);
	for (const argv of [["--at", "./workspace/inner", "crud", "memo", "x"], ["--at", old.inner, "seed"], ["seed", "--at", "./workspace/inner"]]) {
		assert.deepEqual(await run(argv, old.host), { code: 1, out: "", err: refusal(argv, old.host) }, argv.join(" "));
	}
	// Outside any hero, --at gets the error it always did, not the September one.
	const outside = tempDir("legacy-hero-guard-nowhere");
	const none = await run(["--at", old.inner, "seed"], outside);
	assert.equal(none.err, `nosedive: --at names one of the hero's roots or a directory in it, and ${old.inner} is none`);
	// NOSEDIVE_HERO picks the hero the way cwd does, from anywhere, and from anywhere but its root the line is held back.
	const away = tempDir("legacy-hero-guard-elsewhere");
	const asked = (named: string, argv: string[]) => cli(argv, away, { NOSEDIVE_HERO: named });
	assert.deepEqual(asked(old.host, ["--at", "./workspace/inner", "seed"]), { code: 1, out: "", err: elsewhere(old.host) });
	assert.deepEqual(asked(old.host, ["seed"]), { code: 1, out: "", err: elsewhere(old.host) });
	const free = asked(modern.host, ["--at", "./workspace/inner", "crud", "memo", "x"]);
	assert.doesNotMatch(free.err, /September/);
	assert.match(free.err, /no kind memo is declared/);
	// A checkout in a September hero's workspace gets that hero's refusal, not the checkout's: 2026.9.18 ran there, and has no --at.
	assert.deepEqual(await run(["seed"], old.inner), { code: 1, out: "", err: elsewhere(old.host) });
	// A checkout in a hero that is no September one keeps launch's own refusal, though it is September's itself.
	const checkout = await run(["seed"], modern.inner);
	assert.doesNotMatch(checkout.err, /September/);
	assert.match(checkout.err, /is checked out in .*'s workspace, and a checkout is never a hero/);
});

test("a kept checkout is the September hero's even when it holds a config of its own", async () => {
	const old = nestedHeroes("legacy-hero-guard-checkout-config", SEPTEMBER, MODERN_CONFIG);
	assert.deepEqual(await run(["help"], old.inner), { code: 1, out: "", err: elsewhere(old.host) });
	assert.equal(guard(["help"], old.inner, old.host), elsewhere(old.host).slice("nosedive: ".length));
	assert.equal(guard(["help"], old.inner, old.inner), undefined, "named as the hero, it is a modern one");
});

test("a September config over 1 MiB is refused like any other, and nothing changes", { timeout: 60_000 }, async () => {
	const huge = hero("legacy-hero-guard-huge", `${SEPTEMBER}# ${"x".repeat((1 << 20) + 1)}\n`);
	assert.ok(statSync(join(huge, ".nosedive", "config.yaml")).size > 1 << 20);
	const before = snapshot(huge);
	for (const argv of [["seed"], ["help"], ["--help"]]) assert.deepEqual(await run(argv, huge), { code: 1, out: "", err: refusal(argv, huge) }, argv.join(" "));
	assert.ok(guard(["seed"], huge));
	assert.ok(guard(["seed"], huge, huge));
	assert.deepEqual(snapshot(huge), before);
});

test("a config that is no regular file is no match, and never a hang", { timeout: 60_000 }, () => {
	if (!isWindows) {
		const fifo = tempDir("legacy-hero-guard-fifo");
		mkdirSync(join(fifo, ".nosedive"));
		assert.equal(spawnSync("mkfifo", [join(fifo, ".nosedive", "config.yaml")]).status, 0);
		assert.equal(guard(["seed"], fifo), undefined);
		const linked = tempDir("legacy-hero-guard-fifo-link");
		mkdirSync(join(linked, ".nosedive"));
		symlinkSync(join(fifo, ".nosedive", "config.yaml"), join(linked, ".nosedive", "config.yaml"));
		assert.equal(guard(["seed"], linked), undefined);
		const loop = tempDir("legacy-hero-guard-loop");
		mkdirSync(join(loop, ".nosedive"));
		symlinkSync(join(loop, ".nosedive", "config.yaml"), join(loop, ".nosedive", "config.yaml"));
		assert.equal(guard(["seed"], loop), undefined);
	}
});

/** Where the published 2026.9.18 is installed: made with the file, not a test, so it outlives the test that first needs it. */
const NPM_PREFIX = tempDir("legacy-hero-guard-npm");

/** The published 2026.9.18, installed once into a directory of its own; its cli, or why it could not be had. */
let installed: { cli: string } | { skip: string } | undefined;
function september(): { cli: string } | { skip: string } {
	if (installed) return installed;
	const prefix = NPM_PREFIX;
	const result = spawnSync("npm", ["i", "--prefix", prefix, `nosedive@${OLD}`, "--no-audit", "--no-fund", "--ignore-scripts"], {
		encoding: "utf8",
		shell: isWindows,
		env: { ...shellEnv(), npm_config_cache: join(prefix, ".npm-cache") },
	});
	if (result.status === 0) return (installed = { cli: join(prefix, "node_modules", "nosedive", "dist", "cli.js") });
	const why = `npm could not install nosedive@${OLD}: ${(result.stderr || result.error?.message || "").trim().split("\n").slice(-3).join(" ")}`;
	// CI has npm and the network, so a failure there is a failure; elsewhere a test that needs them has nothing to run on.
	if (process.env.CI) assert.fail(why);
	return (installed = { skip: why });
}

/** A September nosedive's own environment: a home, git config, and nosedive user dir of its own, and none of this machine's. */
function septemberEnv(home: string): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {};
	for (const [key, value] of Object.entries(shellEnv())) {
		if (/^(GIT_CONFIG_|NOSEDIVE_|GITHUB_TOKEN|GH_TOKEN|CLAUDECODE|CLAUDE_CODE_ENTRYPOINT)/.test(key)) continue;
		env[key] = value;
	}
	const config = join(home, "gitconfig");
	writeFileSync(config, "[user]\n\tname = Test Pilot\n\temail = test@nosedive.invalid\n[init]\n\tdefaultBranch = main\n[credential]\n\thelper =\n");
	return { ...env, HOME: home, USERPROFILE: home, APPDATA: join(home, "AppData", "Roaming"), GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0", NOSEDIVE_USER_DIR: join(home, ".nosedive"), npm_config_cache: join(home, ".npm-cache") };
}

/** A hero as 2026.9.18 makes one: seeded, with a repo, a feat and a dive, jumped, and in the checkout a commit and an uncommitted file. */
function septemberHero(cli: string, root: string): { hero: string; remotes: string; env: NodeJS.ProcessEnv } {
	const home = join(root, "home");
	mkdirSync(join(home, "AppData", "Roaming"), { recursive: true });
	const env = septemberEnv(home);
	const old = (args: string[], cwd: string, input?: string) => {
		const result = spawnSync(process.execPath, [cli, ...args], { cwd, env, encoding: "utf8", input });
		assert.equal(result.status, 0, `nosedive@${OLD} ${args.join(" ")}: ${result.stdout}${result.stderr}`);
	};
	const as = (args: string[], cwd: string) => git(["-c", "user.name=Test Pilot", "-c", "user.email=test@nosedive.invalid", ...args], cwd);
	const remotes = join(root, "remotes");
	for (const name of ["hero", "scratch"]) git(["init", "-q", "--bare", "-b", "main", join(remotes, `${name}.git`)], root);
	const clone = (name: string, text: string) => {
		const dir = join(root, name);
		git(["clone", "-q", pathToFileURL(join(remotes, `${name}.git`)).href, dir], root);
		writeFileSync(join(dir, "README.md"), text);
		as(["add", "-A"], dir);
		as(["commit", "-qm", "init"], dir);
		git(["push", "-q", "origin", "HEAD:main"], dir);
		return dir;
	};
	clone("scratch", "scratch\n");
	const dir = clone("hero", "notes\n");
	old(["seed", "--headless"], dir);
	old(["record.repo", "--remote", pathToFileURL(join(remotes, "scratch.git")).href, "--name", "scratch"], dir);
	old(["record.feat", "--gist", "Add a hello note", "--scope", "scratch", "--name", "add-a-hello-note"], dir);
	old(["record.dive", "--feat", "add-a-hello-note", "--gist", "Write hello", "--brief", "-"], dir, "Done when hello.md exists\n");
	old(["jump"], dir);
	const checkout = join(dir, "workspace", "scratch");
	writeFileSync(join(checkout, "hello.md"), "hello\n");
	as(["add", "-A"], checkout);
	as(["commit", "-qm", "add hello"], checkout);
	writeFileSync(join(checkout, "README.md"), "scratch\nwip\n");
	return { hero: dir, remotes, env };
}

/** Whether `path` is `dir` or inside it. */
function within(dir: string, path: string): boolean {
	const rel = relative(resolve(dir), resolve(path));
	return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** Where a fixture hero's checkout is wired to, and every text file in the hero that names `other`, a place it was not made in. */
function pointsInto(heroDir: string, other: string): { gitdir: string; strays: string[] } {
	const gitdir = /^gitdir: (.*)$/m.exec(readFileSync(join(heroDir, "workspace", "scratch", ".git"), "utf8"))?.[1]?.trim();
	assert.ok(gitdir, "the checkout has a .git file naming its git directory");
	const needles = [other, other.replace(/\\/g, "/")].map((path) => path.toLowerCase());
	const strays: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== "objects") walk(path);
			} else if (entry.isFile() && statSync(path).size < 1 << 20) {
				const text = readFileSync(path, "latin1").toLowerCase();
				if (needles.some((needle) => text.includes(needle))) strays.push(relative(heroDir, path));
			}
		}
	};
	walk(heroDir);
	return { gitdir, strays };
}

const EVERY_CLASS: string[][] = [
	[],
	["help"],
	["--help"],
	["--help", "--more"],
	["seed", "--help"],
	["crud", "--help"],
	["pass", "--help"],
	["no-such-action"],
	["seed"],
	["seed", "--no-capes"],
	["crud"],
	["crud", "memo", "a note"],
	["crud", "--drop", BACKLOG],
	["mint"],
	["next"],
	["pass"],
	["dock", "scratch"],
	["jump"],
	["land"],
	["pack"],
	["bail", "--reason", "trial"],
	["work:jump"],
	["record.repo", "--help"],
	["record.dive", "--feat", "add-a-hello-note", "--gist", "Second", "--brief", "-"],
	["preflight"],
	["list-dives"],
	["--at", "kb", "crud", "memo", "x"],
	["--at", "./workspace/scratch", "seed"],
];

async function runEveryClass(t: TestContext, label: string, dir: string, watched: string[]) {
	const before = snapshot(...watched);
	for (const cwd of [dir, join(dir, "workspace"), join(dir, "workspace", "scratch"), join(dir, "kb")]) {
		for (const argv of EVERY_CLASS) {
			const result = await run(argv, cwd);
			assert.equal(result.out, "", `${label}: ${argv.join(" ")} printed to stdout in ${cwd}`);
			assert.equal(result.code, 1, `${label}: ${argv.join(" ")} in ${cwd}: ${result.err}`);
			// At the root the anchored line; in the workspace, the kept checkout and a subdirectory the root and no line, and never launch's checkout refusal.
			assert.equal(result.err, refusal(argv, dir, cwd), `${label}: ${argv.join(" ")} in ${cwd}`);
			assert.doesNotMatch(result.err, CHECKOUT);
		}
	}
	assert.deepEqual(await run(["pre-push.hook", "origin", "url"], dir), { code: 0, out: "", err: "" }, `${label}: pre-push.hook`);
	// Then the same command lines as a process of the built CLI, which is what a pilot runs.
	for (const argv of EVERY_CLASS) assert.deepEqual(cli(argv, dir), { code: 1, out: "", err: refusal(argv, dir) }, `${label}: ${argv.join(" ")} as a process`);
	for (const argv of EVERY_CLASS.slice(0, 6)) assert.deepEqual(cli(argv, join(dir, "workspace", "scratch")), { code: 1, out: "", err: elsewhere(dir) }, `${label}: ${argv.join(" ")} as a process in the checkout`);
	assert.deepEqual(cli(["pre-push.hook", "origin", "url"], dir), { code: 0, out: "", err: "" });
	assert.deepEqual(snapshot(...watched), before, `${label}: files changed`);
	t.diagnostic(`${label}: ${EVERY_CLASS.length * 5} command lines refused, ${Object.keys(before).length} paths unchanged`);
}

test("a hero made by the published 2026.9.18, jumped and mid-dive, then offline, is refused by every command and left byte for byte as it was", { timeout: 900_000 }, async (t) => {
	const got = september();
	if ("skip" in got) return t.skip(got.skip);
	const root = tempDir("legacy-hero-guard-september");
	const online = septemberHero(got.cli, join(root, "online"));
	const user = process.env.NOSEDIVE_USER_DIR!;
	await runEveryClass(t, "online", online.hero, [online.hero, online.remotes, user]);
	// The same hero with its remotes gone, made again in a place of its own: nothing can be fetched, so any command that tried would fail or half-finish.
	// A copy of the online hero would keep its checkout's .git naming the online hero's cache, which is not offline at all.
	const offline = septemberHero(got.cli, join(root, "offline"));
	rmSync(offline.remotes, { recursive: true, force: true });
	const wired = pointsInto(offline.hero, join(root, "online"));
	assert.ok(within(offline.hero, wired.gitdir), `the offline checkout's git directory ${wired.gitdir} is in the offline hero`);
	assert.deepEqual(wired.strays, [], "no file of the offline hero names the online one");
	assert.ok(!within(online.hero, wired.gitdir));
	await runEveryClass(t, "offline", offline.hero, [offline.hero, user]);
});

test("a read-only line the refusal prints, run with the real 2026.9.18 from outside the hero, acts on that hero", { timeout: 900_000 }, async (t) => {
	const got = september();
	if ("skip" in got) return t.skip(got.skip);
	const root = tempDir("legacy-hero-guard-real");
	const made = septemberHero(got.cli, root);
	const line = printedLines((await run(["list-dives"], made.hero)).err).bash;
	assert.equal(line, `cd '${made.hero.replace(/'/g, "'\\''")}' && npx -y nosedive@2026.9.18 list-dives`);
	// What 2026.9.18 prints run in the hero itself, the time of the jump aside.
	const same = (text: string) => text.replace(/Jumped .*? - /, "Jumped - ");
	const direct = spawnSync(process.execPath, [got.cli, "list-dives"], { cwd: made.hero, env: made.env, encoding: "utf8" });
	assert.equal(direct.status, 0, direct.stderr);
	assert.match(direct.stdout, /add-a-hello-note/);
	// The line is pasted into a directory that is no hero and no repo, through the real npx fetching the real package.
	const away = tempDir("legacy-hero-guard-real-away");
	const pasted = spawnSync("bash", ["-c", line], { cwd: away, env: made.env, encoding: "utf8", timeout: 400_000 });
	if (missing(pasted, "bash")) return t.skip("bash is not here");
	assert.equal(pasted.status, 0, `${line}\n${pasted.stdout}${pasted.stderr}`);
	assert.equal(same(pasted.stdout), same(direct.stdout));
	assert.match(pasted.stdout, /Write hello/);
	assert.deepEqual(readdirSync(away), [], "nothing was written where the line was pasted");
});
