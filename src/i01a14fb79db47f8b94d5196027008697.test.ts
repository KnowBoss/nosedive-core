// build-base
import assert from "node:assert/strict";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a133548178739398941123114401ad as usageId } from "./i01a133548178739398941123114401ad.ts";
import { CANONICAL, lock, ok, run, shoutPackage, tempBridge, kbOf, kbPath } from "../test/harness.ts";
import { i01a133547f5f7c45a3fb2ac0e3a7678e as scaffoldCape } from "./i01a133547f5f7c45a3fb2ac0e3a7678e.ts";

const HELLO = "01a14fba-1f85-72f5-8685-94c90e206721";
const READY = "01a14fba-1f86-7d2a-9f27-269a3819ca27";
const LATER = "01a14fec-1d7e-77ca-8f8a-d55300d0f7b2";
const implOf = (id: string, usage: string) => join("src", `i${usageId(usage, id)}.ts`);

/** A base with a command, `hello <who>`, and a gate, `pass --ready <core:memo>`, scaffolded and written, none of it committed. */
async function helloBase(label: string): Promise<string> {
	const bridge = await tempBridge(label, ["--root-kind", "cape"]);
	const doc = (id: string, name: string, gist: string, usage: string) =>
		writeFileSync(join(kbOf(bridge), `${id}.md`), `---\nkind: action\nid: ${id}\nname: ${name}\ngist: "${gist}"\nmeta:\n  usages:\n    - ${usage}\n${CANONICAL}---\n`);
	doc(HELLO, "hello", "Says hello", "hello <who>");
	doc(READY, "ready-memo", "A memo is ready", "pass --ready <core:memo>");
	scaffoldCape(bridge);
	hello(bridge, "hello");
	writeFileSync(join(bridge, implOf(READY, "pass --ready <core:memo>")), `export async function i${usageId("pass --ready <core:memo>", READY)}(ctx: any) {\n\tctx.out(\`\${ctx.doc.fm.name} is ready\`);\n}\n`);
	return bridge;
}

function hello(bridge: string, word: string): void {
	const name = `i${usageId("hello <who>", HELLO)}`;
	writeFileSync(join(bridge, implOf(HELLO, "hello <who>")), `export async function ${name}(args: any, ctx: any) {\n\tctx.out(\`${word} \${args.who}\`);\n}\n`);
}

test("runs a base's own commands, built from its working tree, lists them under its name, and rebuilds after an edit", async () => {
	const bridge = await helloBase("base-hello");
	assert.equal(ok(await run(["hello", "ann"], bridge)), "hello ann");
	const help = ok(await run(["help"], bridge));
	assert.match(help, /\n\n\S+\n {2}hello +Says hello\n/);
	assert.doesNotMatch(help, /ready-memo/);
	hello(bridge, "hi");
	assert.equal(ok(await run(["hello", "ann"], bridge)), "hi ann");
	assert.equal(readdirSync(join(bridge, ".nosedive", "capes")).filter((file) => file.startsWith("base-")).length, 1, "only the newest build is kept");
});

test("takes core's named exports, as a cape's build does", async () => {
	const bridge = await helloBase("base-named");
	const name = `i${usageId("hello <who>", HELLO)}`;
	writeFileSync(join(bridge, implOf(HELLO, "hello <who>")), `import { featTree } from "nosedive-core";\n\nexport async function ${name}(args: any, ctx: any) {\n\tctx.out(\`\${typeof featTree} \${args.who}\`);\n}\n`);
	assert.equal(ok(await run(["hello", "ann"], bridge)), "function ann");
});

test("passes a doc through the base's own gates, which are no commands", async () => {
	const bridge = await helloBase("base-ready");
	const memo = ok(await run(["crud", "core:memo", "a", "memo"], bridge)).replace(/^.*\/|\.md$/g, "");
	ok(await run(["crud", memo, "--links", "-"], bridge, `${kbPath(bridge, READY)}:\n  rel: ready.gate\n`));
	assert.match(ok(await run(["pass", "--ready", memo], bridge)), /^a-memo-\w{6} is ready\ngate ready-memo: passed$/);
	assert.match((await run(["ready-memo"], bridge)).err, /ready-memo is a gate: `nosedive pass --ready <core:memo>`/);
});

test("refuses a base whose code does not check out, and builds nothing for one without code", async () => {
	const bridge = await helloBase("base-broken");
	rmSync(join(bridge, implOf(HELLO, "hello <who>")));
	const refused = await run(["hello", "ann"], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /'s own actions do not check out:\n {2}hello .*missing src\//);

	const plain = await tempBridge("base-plain");
	assert.match((await run(["nope"], plain)).err, /unknown action: nope/);
	assert.deepEqual(readdirSync(join(plain, ".nosedive")).filter((file) => file === "capes"), []);
});

test("reads only the docs its src/ names, so a doc with no code yet is no part of the build and blocks nothing", async () => {
	const bridge = await helloBase("base-from-src");
	ok(await run(["hello", "ann"], bridge));
	const builds = () => readdirSync(join(bridge, ".nosedive", "capes")).filter((file) => file.startsWith("base-"));
	const before = builds();
	writeFileSync(join(kbOf(bridge), `${LATER}.md`), `---\nkind: action\nid: ${LATER}\nname: later\ngist: "Not written yet"\nmeta:\n  usages:\n    - later\n${CANONICAL}---\n`);
	assert.equal(ok(await run(["hello", "ann"], bridge)), "hello ann");
	assert.deepEqual(builds(), before, "the base was not rebuilt");
	assert.doesNotMatch(ok(await run(["help"], bridge)), /later/);
	assert.match((await run(["later"], bridge)).err, /unknown action: later/);
});

test("builds a base whole: its packages, CommonJS included, and its assets as text, bytes and browser bundles", async () => {
	const bridge = await helloBase("base-whole");
	shoutPackage(bridge);
	lock(bridge);
	mkdirSync(join(bridge, "assets"));
	writeFileSync(join(bridge, "assets", "page.html"), "<h1>hi</h1>");
	writeFileSync(join(bridge, "assets", "dot.png"), Buffer.from([137, 80, 78, 71]));
	writeFileSync(join(bridge, "assets", "greet.ts"), "export const greet = (who: string): string => `hey ${who}`;\n");
	writeFileSync(join(bridge, "assets", "app.client.ts"), 'import { greet } from "./greet.ts";\ndocument.title = greet("browser");\n');
	const name = `i${usageId("hello <who>", HELLO)}`;
	writeFileSync(
		join(bridge, implOf(HELLO, "hello <who>")),
		[
			'import shout from "shout";',
			'import page from "../assets/page.html";',
			'import dot from "../assets/dot.png";',
			'import app from "../assets/app.client.ts";',
			"",
			`export async function ${name}(args: any, ctx: any) {`,
			'\tctx.out([shout(String(args.who)), page, dot.length, app.includes("hey ") && !/^import /m.test(app)].join("|"));',
			"}",
			"",
		].join("\n"),
	);
	assert.equal(ok(await run(["hello", "ann"], bridge)), "ANN!|<h1>hi</h1>|4|true");
	writeFileSync(join(bridge, "assets", "page.html"), "<h1>ho</h1>");
	assert.match(ok(await run(["hello", "ann"], bridge)), /\|<h1>ho<\/h1>\|/, "an asset edit rebuilds the base");
});
