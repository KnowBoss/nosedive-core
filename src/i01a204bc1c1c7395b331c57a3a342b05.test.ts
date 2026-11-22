// legacy-hero-guard
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { test, type TestContext } from "node:test";
import { i01a204bc1c1c7395b331c57a3a342b05 as guard } from "./i01a204bc1c1c7395b331c57a3a342b05.ts";
import { existsSync } from "node:fs";
import { git, gitRepo, run, tempDir } from "../test/harness.ts";

const OLD = "2026.9.18";
const BACKLOG = "01a204bc-0000-7000-8000-000000000001";
const MODERN = "01a204bc-0000-7000-8000-000000000002";
const isWindows = process.platform === "win32";
const CORE_DIR = join(import.meta.dirname, "..");

const HEAD = "nosedive: this hero is for September nosedive, and this nosedive does not run on it. Nothing was changed. Run this command line there";
const PLAIN = /^[\w./:-][\w./:@-]*$/;

/** The refusal for these arguments: one line when every argument is plain, else the line for bash and the line for PowerShell. */
function refusal(argv: string[]): string {
	const bash = (arg: string) => (PLAIN.test(arg) ? arg : `'${arg.replace(/'/g, "'\\''")}'`);
	const powershell = (arg: string) => (PLAIN.test(arg) ? arg : `'${arg.replace(/['‘’‚‛]/g, "$&$&")}'`);
	const line = (quote: (arg: string) => string) => ["npx", "-y", `nosedive@${OLD}`, ...argv.map(quote)].join(" ");
	return line(bash) === line(powershell) ? `${HEAD} with:\n  ${line(bash)}` : `${HEAD}, in bash or zsh:\n  ${line(bash)}\nor in PowerShell:\n  ${line(powershell)}`;
}

/** The checkout refusal launch has always given inside a hero's workspace. */
const CHECKOUT = /^nosedive: scratch is checked out in .*'s workspace, and a checkout is never a hero: run nosedive from /;

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

test("a September hero refuses every command line, naming the old nosedive to run it with, and changes nothing", async () => {
	const dir = hero("legacy-hero-guard", SEPTEMBER);
	mkdirSync(join(dir, "workspace", "scratch"), { recursive: true });
	mkdirSync(join(dir, "kb", "sub"), { recursive: true });
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
	for (const argv of refused) assert.deepEqual(await run(argv, dir), { code: 1, out: "", err: refusal(argv) }, argv.join(" "));
	// From a subdirectory, and from the workspace, it is still that hero; a checkout in the workspace keeps launch's own refusal.
	for (const cwd of [join(dir, "kb", "sub"), join(dir, "workspace")]) assert.deepEqual(await run(["seed"], cwd), { code: 1, out: "", err: refusal(["seed"]) }, cwd);
	const checkout = await run(["seed"], join(dir, "workspace", "scratch"));
	assert.equal(checkout.code, 1);
	assert.match(checkout.err, CHECKOUT);
	assert.doesNotMatch(checkout.err, /September/);
	assert.deepEqual(snapshot(dir), before);
});

test("the refusal's lines are verbatim", async () => {
	const dir = hero("legacy-hero-guard-verbatim", SEPTEMBER);
	const at = async (argv: string[]) => (await run(argv, dir)).err;
	assert.equal(await at([]), `${HEAD} with:\n  npx -y nosedive@2026.9.18`);
	assert.equal(await at(["seed", "--no-capes"]), `${HEAD} with:\n  npx -y nosedive@2026.9.18 seed --no-capes`);
	assert.equal(await at(["crud", "memo", "one two"]), `${HEAD} with:\n  npx -y nosedive@2026.9.18 crud memo 'one two'`);
	assert.equal(await at(["crud", "memo", "it's $HOME", "", "@x"]), `${HEAD}, in bash or zsh:\n  npx -y nosedive@2026.9.18 crud memo 'it'\\''s $HOME' '' '@x'\nor in PowerShell:\n  npx -y nosedive@2026.9.18 crud memo 'it''s $HOME' '' '@x'`);
});

/** One shell's run of a printed line, with a stub standing in for npx that prints the arguments it got; its argv, or undefined where the shell is absent. */
function pasted(shell: "bash" | "pwsh", line: string, stub: string): string[] | undefined {
	// The stub stands where npx does, ahead of the arguments, so that they reach it as the shell parses them and no wrapper re-reads them.
	const script = line.replace(/^npx /, `node '${stub.replace(/\\/g, "/")}' `);
	const args = shell === "bash" ? ["-c", script] : ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")];
	const result = spawnSync(shell, args, { encoding: "utf8" });
	if (result.error) {
		assert.ok(!process.env.CI, `${shell} is not here, and CI has it: ${result.error.message}`);
		return undefined;
	}
	assert.equal(result.status, 0, `${shell}: ${line}\n${result.stderr}`);
	return JSON.parse(result.stdout) as string[];
}

test("the printed line, pasted into bash and into PowerShell, hands the same arguments to npx", async () => {
	const dir = hero("legacy-hero-guard-paste", SEPTEMBER);
	const stub = join(tempDir("legacy-hero-guard-stub"), "stub.js");
	writeFileSync(stub, "process.stdout.write(JSON.stringify(process.argv.slice(2)));\n");
	const arguments_ = ["a b", "it's", "it's $HOME", "`id`", "$(echo x)", "100%", "hi!", 'say "hi"', "back\\slash", "two\nlines", "", "*.md", "@file", "@{a=1}", "x,y", "--meta:k=v", "café", "‘curly’", "a;b", "a&b", "a|b", "<x>", "#c", "~", "{a,b}", "(x)"];
	let ran = 0;
	for (const arg of [...arguments_.map((each) => [each]), ["--at", "kb", "crud", "memo", ...arguments_]]) {
		const argv = ["crud", ...arg];
		const err = (await run(argv, dir)).err;
		const split = err.split("\nor in PowerShell:\n  ");
		const bash = split[0]!.slice(HEAD.length).replace(/^(, in bash or zsh| with):\n {2}/, "");
		const lines = [bash, split.at(-1)!];
		const want = ["-y", `nosedive@${OLD}`, ...argv];
		for (const [shell, line] of [["bash", lines[0]!], ["pwsh", lines[1]!]] as const) {
			const got = pasted(shell, line, stub);
			if (got === undefined) continue;
			assert.deepEqual(got, want, `${shell}: ${line}`);
			ran++;
		}
	}
	if (process.env.CI) assert.ok(ran >= 2 * arguments_.length, "both shells ran in CI");
});

test("nothing in the refusal suggests a newer version or a way past it", async () => {
	const { err } = await run(["seed"], hero("legacy-hero-guard-words", SEPTEMBER));
	assert.doesNotMatch(err, /newer|latest|upgrade|update|migrat|npm i|--force|--yes|skip|bypass|legacy|override/i);
});

test("pre-push.hook still exits 0 silently in a September hero", async () => {
	assert.deepEqual(await run(["pre-push.hook", "origin", "url"], hero("legacy-hero-guard-hook", SEPTEMBER)), { code: 0, out: "", err: "" });
});

test("the real command line refuses a September hero named by NOSEDIVE_HERO, from anywhere", () => {
	const dir = hero("legacy-hero-guard-env", SEPTEMBER);
	assert.deepEqual(cli(["seed"], tempDir("legacy-hero-guard-elsewhere"), { NOSEDIVE_HERO: dir }), { code: 1, out: "", err: refusal(["seed"]) });
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
		assert.deepEqual(await run(argv, old.host), { code: 1, out: "", err: refusal(argv) }, argv.join(" "));
	}
	// Outside any hero, --at gets the error it always did, not the September one.
	const outside = tempDir("legacy-hero-guard-nowhere");
	const none = await run(["--at", old.inner, "seed"], outside);
	assert.equal(none.err, `nosedive: --at names one of the hero's roots or a directory in it, and ${old.inner} is none`);
	// NOSEDIVE_HERO picks the hero the way cwd does, from anywhere.
	const elsewhere = tempDir("legacy-hero-guard-elsewhere");
	const asked = (hero: string, argv: string[]) => cli(argv, elsewhere, { NOSEDIVE_HERO: hero });
	assert.deepEqual(asked(old.host, ["--at", "./workspace/inner", "seed"]), { code: 1, out: "", err: refusal(["--at", "./workspace/inner", "seed"]) });
	assert.deepEqual(asked(old.host, ["seed"]), { code: 1, out: "", err: refusal(["seed"]) });
	const free = asked(modern.host, ["--at", "./workspace/inner", "crud", "memo", "x"]);
	assert.doesNotMatch(free.err, /September/);
	assert.match(free.err, /no kind memo is declared/);
	// A checkout in a September hero's workspace is never a hero: launch's own refusal stands.
	const checkout = await run(["seed"], join(old.host, "workspace", "inner"));
	assert.doesNotMatch(checkout.err, /September/);
	assert.match(checkout.err, /is checked out in .*'s workspace, and a checkout is never a hero/);
});

test("a config that is huge, or no regular file, is no match, and never a hang", { timeout: 60_000 }, () => {
	const huge = hero("legacy-hero-guard-huge", `${SEPTEMBER}# ${"x".repeat(2_000_000)}\n`);
	assert.equal(guard(["seed"], huge), undefined);
	const small = hero("legacy-hero-guard-small", SEPTEMBER);
	assert.ok(guard(["seed"], small), "the same config, small, is one");
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

/** The published 2026.9.18, installed once into a directory of its own; its cli, or why it could not be had. */
let installed: { cli: string } | { skip: string } | undefined;
function september(): { cli: string } | { skip: string } {
	if (installed) return installed;
	const prefix = tempDir("legacy-hero-guard-npm");
	const result = spawnSync("npm", ["i", "--prefix", prefix, `nosedive@${OLD}`, "--no-audit", "--no-fund", "--ignore-scripts"], {
		encoding: "utf8",
		shell: isWindows,
		env: { ...process.env, npm_config_cache: join(prefix, ".npm-cache") },
	});
	if (result.status === 0) return (installed = { cli: join(prefix, "node_modules", "nosedive", "dist", "cli.js") });
	const why = `npm could not install nosedive@${OLD}: ${(result.stderr || result.error?.message || "").trim().split("\n").slice(-3).join(" ")}`;
	// CI has the network, so a failure there is a failure; elsewhere a test that needs npm has nothing to run on.
	if (process.env.CI) assert.fail(why);
	return (installed = { skip: why });
}

/** A September nosedive's own environment: a home, git config, and nosedive user dir of its own, and none of this machine's. */
function septemberEnv(home: string): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (/^(GIT_CONFIG_|NOSEDIVE_|GITHUB_TOKEN|GH_TOKEN|CLAUDECODE|CLAUDE_CODE_ENTRYPOINT)/.test(key)) continue;
		env[key] = value;
	}
	const config = join(home, "gitconfig");
	writeFileSync(config, "[user]\n\tname = Test Pilot\n\temail = test@nosedive.invalid\n[init]\n\tdefaultBranch = main\n[credential]\n\thelper =\n");
	return { ...env, HOME: home, USERPROFILE: home, APPDATA: join(home, "AppData", "Roaming"), GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0", NOSEDIVE_USER_DIR: join(home, ".nosedive") };
}

/** A hero as 2026.9.18 makes one: seeded, with a repo, a feat and a dive, jumped, and in the checkout a commit and an uncommitted file. */
function septemberHero(cli: string, root: string): { hero: string; remotes: string } {
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
	return { hero: dir, remotes };
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
		// A checkout in the workspace is never a hero, and launch says so first.
		const checkout = cwd === join(dir, "workspace", "scratch");
		for (const argv of EVERY_CLASS) {
			const result = await run(argv, cwd);
			assert.equal(result.out, "", `${label}: ${argv.join(" ")} printed to stdout in ${cwd}`);
			assert.equal(result.code, 1, `${label}: ${argv.join(" ")} in ${cwd}: ${result.err}`);
			if (checkout) assert.match(result.err, CHECKOUT, `${label}: ${argv.join(" ")} in ${cwd}`);
			else assert.equal(result.err, refusal(argv), `${label}: ${argv.join(" ")} in ${cwd}`);
		}
	}
	assert.deepEqual(await run(["pre-push.hook", "origin", "url"], dir), { code: 0, out: "", err: "" }, `${label}: pre-push.hook`);
	// Then the same command lines as a process of the built CLI, which is what a pilot runs.
	for (const argv of EVERY_CLASS) assert.deepEqual(cli(argv, dir), { code: 1, out: "", err: refusal(argv) }, `${label}: ${argv.join(" ")} as a process`);
	assert.deepEqual(cli(["pre-push.hook", "origin", "url"], dir), { code: 0, out: "", err: "" });
	assert.deepEqual(snapshot(...watched), before, `${label}: files changed`);
	t.diagnostic(`${label}: ${EVERY_CLASS.length * 5} command lines refused, ${Object.keys(before).length} paths unchanged`);
}

test("a hero made by the published 2026.9.18, jumped and mid-dive, then offline, is refused by every command and left byte for byte as it was", { timeout: 600_000 }, async (t) => {
	const got = september();
	if ("skip" in got) return t.skip(got.skip);
	const root = tempDir("legacy-hero-guard-september");
	const online = septemberHero(got.cli, join(root, "online"));
	const user = process.env.NOSEDIVE_USER_DIR!;
	await runEveryClass(t, "online", online.hero, [online.hero, online.remotes, user]);
	// The same hero with its remotes gone: nothing can be fetched, so any command that tried would fail or half-finish.
	const offline = join(root, "offline");
	mkdirSync(offline);
	cpSync(online.hero, join(offline, "hero"), { recursive: true });
	rmSync(online.remotes, { recursive: true, force: true });
	await runEveryClass(t, "offline", join(offline, "hero"), [join(offline, "hero"), user]);
});
