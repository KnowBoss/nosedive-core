// pass [<argv>...]
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { i01a133548178739398941123114401ad as usageId } from "./i01a133548178739398941123114401ad.ts";
import { i01a1336cb234701bb0338faf5183960c as codeSection } from "./i01a1336cb234701bb0338faf5183960c.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a15baf13e27bd88dc880d4871f2210 as hydrateRepo } from "./i01a15baf13e27bd88dc880d4871f2210.ts";
import { CANONICAL, git, gitRepo, greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge, tempDir, kbOf } from "../test/harness.ts";

const ROOT = "01a14b36-0cfd-7521-ae18-bece3dfaa6cf";
const STAMP = "01a14b36-0faa-71c7-bf35-9e1af7f29d0b";
const REFUSE = "01a14b36-1256-7698-beb6-fccd1b91d169";
const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");
const rootOf = (repo: string) => readRepoConfig(repo)!.root!;

/** A cape of two gates in the stamp sect: one stamps the doc through crud, one refuses when asked to. */
function stampCapeRepo(): string {
	const dir = gitRepo("stamp-cape");
	const gate = (id: string, name: string, text: string, code: string) => {
		const hex = id.replace(/-/g, "");
		const usage = { id: usageId(text, id), text };
		const doc = { kind: "action" as const, name, gist: name, usages: [usage], top: true, text: "", body: "" };
		return {
			[`kb/${id}.md`]: `---\nkind: action\nid: ${id}\nname: ${name}\ngist: "${name}"\nmeta:\n  usages:\n    - ${text}\n${CANONICAL}---\n${codeSection(`\n# ${name}\n`, doc, `i${hex}`)}`,
			[`src/i${hex}.ts`]: `import { i${usage.id} } from "./i${usage.id}.ts";\n\nexport function i${hex}(call: any) {\n\tif (call.usage === "u${usage.id}") return i${usage.id}(call.gate);\n}\n`,
			[`src/i${usage.id}.ts`]: `export function i${usage.id}(ctx: any) {\n${code}\n}\n`,
		};
	};
	const files: Record<string, string> = {
		".nosedive/config.yaml": `roots:\n  - kb/${ROOT}.md\n`,
		[`kb/${ROOT}.md`]: `---\nkind: cape\nid: ${ROOT}\nname: stamp-cape\n${CANONICAL}---\n`,
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
	const path = ok(await run(["crud", "core:memo", "a", "memo"], bridge));
	const memo = idOf(path);
	ok(await run(["crud", memo, "--links", "-"], bridge, `stamp-cape:${STAMP}:\n  rel: stamp.gate\nstamp-cape:${REFUSE}:\n  rel: stamp.gate\n`));
	return { bridge, memo, path };
}

test("passes a doc through those of its gates in one sect with a usage the command line matches, and commits their edits once", async () => {
	const { bridge, memo, path } = await stampBridge("pass-stamp");
	const head = git(["rev-parse", "HEAD"], bridge);
	assert.equal(ok(await run(["pass", "--stamp", memo, "--loud"], bridge)), `stamping\ngate stamp: passed\n${path}`);
	assert.equal(git(["log", "--format=%s", `${head}..HEAD`], bridge), "pass: stamp");
	const text = readFileSync(join(bridge, path), "utf8");
	assert.match(text, /\ngist: "?STAMPED"?\n/);
	assert.match(text, /## Stamp\n\nby memo, with loud\n$/);
});

test("the commit names the feat of the doc passed, and ends with nosedive's co-author once", async () => {
	const { bridge, memo, path } = await stampBridge("pass-feat");
	ok(await run(["crud", findBridge(bridge)!.root!, "--links", "-"], bridge, `${path}: {rel: work.feat}\n`));
	const head = git(["rev-parse", "HEAD"], bridge);
	ok(await run(["pass", "--stamp", memo], bridge));
	assert.equal(git(["log", "--format=%s", `${head}..HEAD`], bridge), `feat(a-memo-${memo.slice(-6)}): pass stamp`);
	assert.equal(git(["log", "-1", "--format=%(trailers:only,unfold)"], bridge).trim(), "Co-Authored-By: nosedive source <noreply@nosedive.dev>");
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
	// Core's gates sit under the kinds that link them; the stamp gates, linked by the doc alone, under any doc, last.
	assert.match(help, /\n\ncore:cape\n {2}pass --attach-cape <cape>\n[^]*\n {2}pass --test <cape>\n\ncore:repo\n {2}pass --attach-cape <cape>\n[^]*\n\nany doc\n {2}pass --stamp <quid> \[--loud\]\n {2}pass --stamp <quid> \[--refuse\]$/);
	assert.equal(ok(await run(["pass"], bridge)), help);
	assert.match((await run(["pass", "--stamp", memo, "--quiet"], bridge)).err, /no gate usage matches `pass --stamp \S+ --quiet`; usages:\n[^]*\n\nany doc\n {2}pass --stamp/);
	const other = idOf(ok(await run(["crud", "core:memo", "other"], bridge)));
	assert.match((await run(["pass", "--stamp", other], bridge)).err, /other-\w{6} links no stamp\.gate, nor does its kind \S+:memo/);
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

test("a local cape's tests run by its path, not the hero's", async () => {
	const hero = await tempBridge("pass-test-local");
	ok(await run(["--at", "capes/greet", "seed", "--root-kind", "cape"], hero));
	const fixture = greetCapeRepo();
	for (const dir of ["kb", "src"]) cpSync(join(fixture, dir), join(hero, "capes", "greet", dir), { recursive: true });
	git(["add", "-A"], hero);
	git(["commit", "-qm", "greet"], hero);
	assert.match(ok(await run(["pass", "--test", "capes/greet"], hero)), /✔ greet <who>[\s\S]*\ngate cape-tests-pass: passed$/);
});

test("lists a gate under each kind that links it, by the kind's spelling, and under no other group", async () => {
	const { bridge } = await stampBridge("pass-groups");
	const kind = idOf(ok(await run(["crud", "core:kind", "a thing", "--name", "thing", "--meta", "-"], bridge, "schema:\n  type: object\n  additionalProperties: true\n")));
	ok(await run(["crud", kind, "--links", "-"], bridge, `stamp-cape:${STAMP}:\n  rel: stamp.gate\n`));
	const groups = ok(await run(["pass", "--help"], bridge)).split("\n\n");
	assert.deepEqual(groups.slice(1).map((group) => group.split("\n")[0]), ["core:cape", "core:repo", "thing", "any doc"], "kinds by name, each once, then any doc");
	assert.equal(groups.at(-2), "thing\n  pass --stamp <quid> [--loud]");
	assert.equal(groups.at(-1), "any doc\n  pass --stamp <quid> [--refuse]");
});
