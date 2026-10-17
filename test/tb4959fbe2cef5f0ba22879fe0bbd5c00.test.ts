// pass [<argv>...]
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { i01a1336cb234701bb0338faf5183960c as codeSection } from "../src/i01a1336cb234701bb0338faf5183960c.ts";
import { git, gitRepo, greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge, tempDir } from "./harness.ts";

const ROOT = "01a14b36-0cfd-7521-ae18-bece3dfaa6cf";
const STAMP = "01a14b36-0faa-71c7-bf35-9e1af7f29d0b";
const REFUSE = "01a14b36-1256-7698-beb6-fccd1b91d169";
const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");
const rootOf = (repo: string) => /\nroot: (\S+)/.exec(readFileSync(join(repo, ".nosedive", "config.yaml"), "utf8"))![1]!;

/** A cape of two gates in the stamp sect: one stamps the doc through crud, one refuses when asked to. */
function stampCapeRepo(): string {
	const dir = gitRepo("stamp-cape");
	const gate = (id: string, name: string, usage: string, code: string) => {
		const hex = id.replace(/-/g, "");
		const doc = { kind: "gate" as const, name, gist: name, usages: [], top: true, text: "", body: "" };
		return {
			[`kb/${id}.md`]: `---\nkind: gate\nid: ${id}\nname: ${name}\ngist: "${name}"\nmeta:\n  usages:\n    - ${usage}\n---\n${codeSection(`\n# ${name}\n`, doc, `i${hex}`)}`,
			[`src/i${hex}.ts`]: `export function i${hex}(ctx: any) {\n${code}\n}\n`,
		};
	};
	const files: Record<string, string> = {
		".nosedive/config.yaml": `kb: ./kb\nroot: ${ROOT}\n`,
		[`kb/${ROOT}.md`]: `---\nkind: cape\nid: ${ROOT}\nname: stamp-cape\n---\n`,
		...gate(STAMP, "stamp", "pass --stamp <quid> [--loud]", '\tctx.crud(ctx.doc.id, "gist", ctx.args.loud ? "STAMPED" : "stamped");\n\tctx.crud(ctx.doc.id, "section", { heading: "Stamp", text: `by ${ctx.doc.fm.kind}, with ${Object.keys(ctx.args).join(" and ")}` });\n\tctx.out("stamping");'),
		...gate(REFUSE, "refuse", "pass --stamp <quid> [--refuse]", '\tif (ctx.args.refuse) throw new Error("asked to refuse");'),
	};
	for (const [file, text] of Object.entries(files)) {
		mkdirSync(join(dir, dirname(file)), { recursive: true });
		writeFileSync(join(dir, file), text);
	}
	git(["add", "-A"], dir);
	git(["commit", "-qm", "stamp cape"], dir);
	return dir;
}

async function stampBridge(label: string): Promise<{ bridge: string; memo: string; path: string }> {
	const bridge = await tempBridge(label);
	await registerRepo(bridge, "stamp-cape", stampCapeRepo());
	setCapes(bridge, ["stamp-cape"]);
	ok(await run(["seed"], bridge));
	const path = ok(await run(["crud", "memo", "a", "memo"], bridge));
	const memo = idOf(path);
	ok(await run(["crud", memo, "--links", "-"], bridge, `stamp-cape:${STAMP}:\n  rel: stamp.gate\nstamp-cape:${REFUSE}:\n  rel: stamp.gate\n`));
	return { bridge, memo, path };
}

test("passes a doc through its gates in one sect, with the args their usages match, and commits their edits once", async () => {
	const { bridge, memo, path } = await stampBridge("pass-stamp");
	const head = git(["rev-parse", "HEAD"], bridge);
	assert.equal(ok(await run(["pass", "--stamp", memo, "--loud"], bridge)), `stamping\ngate stamp: passed\ngate refuse: passed\n${path}`);
	assert.equal(git(["log", "--format=%s", `${head}..HEAD`], bridge), "pass(a-memo-" + memo.slice(-6) + "): stamp");
	const text = readFileSync(join(bridge, path), "utf8");
	assert.match(text, /\ngist: "?STAMPED"?\n/);
	assert.match(text, /## Stamp\n\nby memo, with loud\n$/);
});

test("fails fast, and writes nothing when a gate fails", async () => {
	const { bridge, memo, path } = await stampBridge("pass-refuse");
	const before = readFileSync(join(bridge, path), "utf8");
	const head = git(["rev-parse", "HEAD"], bridge);
	const refused = await run(["pass", "--stamp", memo, "--refuse"], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /gate refuse failed, so nothing was written: asked to refuse/);
	assert.equal(readFileSync(join(bridge, path), "utf8"), before);
	assert.equal(git(["rev-parse", "HEAD"], bridge), head);
});

test("lists its gates' usages, and refuses argv none matches or a doc that links no gate in the sect", async () => {
	const { bridge, memo } = await stampBridge("pass-usages");
	const help = ok(await run(["pass", "--help"], bridge));
	assert.match(help, /\n {2}pass --stamp <quid> \[--loud\]\n {2}pass --stamp <quid> \[--refuse\]\n {2}pass --test <quid>$/);
	assert.equal(ok(await run(["pass"], bridge)), help);
	assert.match((await run(["pass", "--stamp", memo, "--quiet"], bridge)).err, /no gate usage matches `pass --stamp \S+ --quiet`; usages:\n {2}pass --hydrate <quid>\n {2}pass --stamp/);
	const other = idOf(ok(await run(["crud", "memo", "other"], bridge)));
	assert.match((await run(["pass", "--stamp", other], bridge)).err, /other-\w{6} links no stamp\.gate, nor does its kind memo/);
});

test("a cape's root passes its kind's test gate, which runs its tests, once even when its root links it too", async () => {
	const bridge = await tempBridge("pass-test");
	const checkout = join(bridge, "workspace", "greet-cape");
	git(["clone", "-q", greetCapeRepo({ gated: true }), checkout], bridge);
	const out = ok(await run(["pass", "--test", rootOf(checkout)], bridge));
	assert.match(out, /✔ greet <who>[\s\S]*\ngate cape-tests-pass: passed$/);
	assert.equal(out.match(/gate cape-tests-pass: passed/g)!.length, 1);

	const failing = join(bridge, "workspace", "failing-cape");
	git(["clone", "-q", greetCapeRepo({ failing: true, name: "failing-cape" }), failing], bridge);
	const failed = await run(["pass", "--test", rootOf(failing)], bridge);
	assert.equal(failed.code, 1);
	assert.match(failed.err, /gate cape-tests-pass failed, so nothing was written: the tests of failing-cape failed/);
});

/** A base with repo `hello` registered and committed, cloned from a repo of one commit on main. */
async function helloBridge(label: string): Promise<{ bridge: string; id: string; source: string }> {
	const bridge = await tempBridge(label);
	const source = gitRepo(`${label}-source`);
	git(["commit", "-q", "--allow-empty", "-m", "first"], source);
	const id = await registerRepo(bridge, "hello", source);
	git(["add", "kb"], bridge);
	git(["commit", "-qm", "hello"], bridge);
	return { bridge, id, source };
}

test("hydrate checks a repo out as a worktree of the bridge's cache of it, and leaves it once there", async () => {
	const { bridge, id, source } = await helloBridge("pass-hydrate");
	const head = git(["rev-parse", "--short", "HEAD"], source);
	assert.equal(ok(await run(["pass", "--hydrate", id], bridge)), `workspace/hello: worktree of main at ${head}\ngate hydrate: passed`);
	const checkout = join(bridge, "workspace", "hello");
	assert.equal(git(["rev-parse", "--path-format=absolute", "--git-common-dir"], checkout).toLowerCase(), join(bridge, ".nosedive", "cache", `${id}.git`).replace(/\\/g, "/").toLowerCase());
	assert.equal(git(["log", "-1", "--format=%s"], checkout), "first");
	assert.doesNotMatch(git(["status", "--porcelain", "--untracked-files=all"], bridge), /cache|workspace/, "neither the cache nor the checkout is committed");
	assert.match(ok(await run(["pass", "--hydrate", id], bridge)), /^workspace\/hello: checked out already\n/);
});

test("hydrate fetches from the home copy, and warns and fetches from the first remote when it cannot", async () => {
	const { bridge, id, source } = await helloBridge("pass-hydrate-home");
	const homes = tempDir("pass-hydrate-homes");
	writeFileSync(join(bridge, ".nosedive", "config.yaml"), `${readFileSync(join(bridge, ".nosedive", "config.yaml"), "utf8")}home: ${JSON.stringify(homes)}\n`);
	const missing = await run(["pass", "--hydrate", id], bridge);
	assert.equal(missing.code, 0);
	assert.match(missing.err, /cannot fetch hello from its home copy .+: it does not exist; trying its first remote/);
	git(["worktree", "remove", join(bridge, "workspace", "hello")], join(bridge, ".nosedive", "cache", `${id}.git`));

	const home = /home copy (\S+):/.exec(missing.err)![1]!;
	git(["clone", "-q", "--bare", source, home], bridge);
	git(["commit", "-q", "--allow-empty", "-m", "second, not in the home copy"], source);
	const fetched = await run(["pass", "--hydrate", id], bridge);
	assert.equal(fetched.err, "");
	assert.equal(git(["log", "-1", "--format=%s"], join(bridge, "workspace", "hello")), "first");
});

test("hydrate refuses a doc that is no repo", async () => {
	const { bridge } = await helloBridge("pass-hydrate-memo");
	const memo = idOf(ok(await run(["crud", "memo", "note"], bridge)));
	ok(await run(["crud", memo, "--links", "-"], bridge, `nosedive-core:01a14b77-89b8-7b17-8e4c-26b61bf78856:\n  rel: hydrate.gate\n`));
	assert.match((await run(["pass", "--hydrate", memo], bridge)).err, /gate hydrate failed, so nothing was written: note-\w{6} is a memo, not a repo/);
});

test("hydrate adopts a legacy cache named by the repo's id alone, and makes new ones <id>.git", async () => {
	const { bridge, id, source } = await helloBridge("pass-hydrate-legacy");
	const legacy = join(bridge, ".nosedive", "cache", id);
	git(["clone", "-q", "--bare", source, legacy], bridge);
	git(["config", "extensions.worktreeConfig", "true"], legacy);
	ok(await run(["pass", "--hydrate", id], bridge));
	assert.equal(existsSync(join(legacy, "worktrees", "hello")), true);
	assert.equal(git(["status", "--porcelain"], join(bridge, "workspace", "hello")), "", "a worktree of a cache with per-worktree config is no bare repo");
	assert.equal(existsSync(`${legacy}.git`), false);
});
