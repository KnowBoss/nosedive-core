// pass [<argv>...]
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { i01a1336cb234701bb0338faf5183960c as codeSection } from "../src/i01a1336cb234701bb0338faf5183960c.ts";
import { git, gitRepo, greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge } from "./harness.ts";

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
		...gate(STAMP, "stamp", "pass --stamp <quid> [--loud]", '\tctx.crud(ctx.doc.id, "gist", ctx.args.loud ? "STAMPED" : "stamped");\n\tctx.crud(ctx.doc.id, "section", { heading: "Stamp", text: `by ${ctx.kind}` });\n\tctx.out("stamping");'),
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
	assert.match(text, /## Stamp\n\nby memo\n$/);
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
	assert.match((await run(["pass", "--stamp", memo, "--quiet"], bridge)).err, /no gate usage matches `pass --stamp \S+ --quiet`; usages:\n {2}pass --stamp/);
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
