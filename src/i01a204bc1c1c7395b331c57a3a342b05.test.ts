// legacy-hero-guard
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { test, type TestContext } from "node:test";
import { git, gitRepo, run, tempDir } from "../test/harness.ts";

const OLD = "2026.9.18";
const BACKLOG = "01a204bc-0000-7000-8000-000000000001";
const MODERN = "01a204bc-0000-7000-8000-000000000002";
const isWindows = process.platform === "win32";

/** The refusal for these arguments, as its words and their quoting read; `shown` is the arguments as a pilot pastes them. */
function refusal(shown: string): string {
	return `nosedive: this hero is for September nosedive, and this nosedive does not run on it. Nothing was changed. Run this command line there with:\n  npx -y nosedive@${OLD}${shown ? ` ${shown}` : ""}`;
}

/** A directory whose config is `config`, with nothing else. */
function hero(label: string, config: string): string {
	const dir = tempDir(label);
	mkdirSync(join(dir, ".nosedive"));
	writeFileSync(join(dir, ".nosedive", "config.yaml"), config);
	return dir;
}

const SEPTEMBER = `compatibility-level: 2\nworkspace: ./workspace\nbacklog: ${BACKLOG}\nkb: ./kb\nbridge: ${BACKLOG}\n`;

/** Every file and directory under `dirs`, by path and the hash of its bytes. */
function snapshot(...dirs: string[]): Record<string, string> {
	const seen: Record<string, string> = {};
	const walk = (dir: string, root: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			const key = `${relative(join(root, ".."), path)}`;
			if (entry.isDirectory()) {
				seen[`${key}/`] = "dir";
				walk(path, root);
			} else seen[key] = entry.isFile() ? createHash("sha256").update(readFileSync(path)).digest("hex") : "other";
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
	const refused: [string[], string][] = [
		[[], ""],
		[["help"], "help"],
		[["--help"], "--help"],
		[["--help", "--more"], "--help --more"],
		[["crud", "--help"], "crud --help"],
		[["no-such-action"], "no-such-action"],
		[["seed"], "seed"],
		[["seed", "--no-capes"], "seed --no-capes"],
		[["crud", "memo", "one two"], "crud memo 'one two'"],
		[["crud", "memo", "it's"], isWindows ? "crud memo 'it''s'" : "crud memo 'it'\\''s'"],
		[["crud", "memo", ""], "crud memo ''"],
		[["core:seed"], "core:seed"],
		[["--at", "kb", "crud", "memo", "x"], "--at kb crud memo x"],
		[["--at", "./kb/sub", "seed"], "--at ./kb/sub seed"],
		[["--at", "./not-there-yet", "seed"], "--at ./not-there-yet seed"],
		[["--at"], "--at"],
	];
	for (const [argv, shown] of refused) {
		const result = await run(argv, dir);
		assert.deepEqual(result, { code: 1, out: "", err: refusal(shown) }, argv.join(" "));
	}
	// From a subdirectory, and from a checkout in its workspace, it is still that hero.
	for (const cwd of [join(dir, "kb", "sub"), join(dir, "workspace"), join(dir, "workspace", "scratch")]) {
		assert.deepEqual(await run(["seed"], cwd), { code: 1, out: "", err: refusal("seed") }, cwd);
	}
	assert.deepEqual(snapshot(dir), before);
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
	const result = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", join(import.meta.dirname, "..", "scripts", "dev.mjs"), "seed"], {
		cwd: tempDir("legacy-hero-guard-elsewhere"),
		env: { ...process.env, NOSEDIVE_HERO: dir },
		encoding: "utf8",
	});
	assert.equal(result.stdout, "");
	assert.equal(result.stderr.trim(), refusal("seed"));
	assert.equal(result.status, 1);
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

test("--at goes by the hero it names, not the one it is run in", async () => {
	// A September hero in a modern hero's workspace is refused for the one whose files the command would act on...
	const modern = hero("legacy-hero-guard-host", `id: ${MODERN}\nroots:\n  - kb/${MODERN}.md\nworkspace: ./workspace\n`);
	const inner = join(modern, "workspace", "old");
	mkdirSync(join(inner, ".nosedive"), { recursive: true });
	writeFileSync(join(inner, ".nosedive", "config.yaml"), SEPTEMBER);
	assert.deepEqual(await run(["--at", "./workspace/old", "crud", "memo", "x"], modern), { code: 1, out: "", err: refusal("--at ./workspace/old crud memo x") });
	// ...and a modern one in a September hero's workspace is not.
	const old = hero("legacy-hero-guard-old-host", SEPTEMBER);
	const nested = join(old, "workspace", "new");
	mkdirSync(join(nested, ".nosedive"), { recursive: true });
	writeFileSync(join(nested, ".nosedive", "config.yaml"), `id: ${MODERN}\nroots:\n  - kb/${MODERN}.md\n`);
	const result = await run(["--at", "./workspace/new", "--help"], old);
	assert.equal(result.code, 0, result.err);
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
		for (const argv of EVERY_CLASS) {
			const result = await run(argv, cwd);
			assert.equal(result.out, "", `${label}: ${argv.join(" ")} printed to stdout in ${cwd}`);
			assert.equal(result.code, 1, `${label}: ${argv.join(" ")} in ${cwd}: ${result.err}`);
			assert.equal(result.err, refusal(argv.map((arg) => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg}'`)).join(" ")), `${label}: ${argv.join(" ")} in ${cwd}`);
		}
	}
	assert.deepEqual(await run(["pre-push.hook", "origin", "url"], dir), { code: 0, out: "", err: "" }, `${label}: pre-push.hook`);
	assert.deepEqual(snapshot(...watched), before, `${label}: files changed`);
	t.diagnostic(`${label}: ${EVERY_CLASS.length * 4} command lines refused, ${Object.keys(before).length} paths unchanged`);
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
