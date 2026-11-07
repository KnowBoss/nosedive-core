// scaffold-cape
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "./i01a1335480c776ba8945020d0af333eb.ts";
import { i01a133547f5f7c45a3fb2ac0e3a7678e as scaffoldCape } from "./i01a133547f5f7c45a3fb2ac0e3a7678e.ts";
import { CANONICAL, gitRepo, kbOf, kbPath, ok, run } from "../test/harness.ts";

const ACTION = "01a1335b-f253-7b80-ab64-d2f9a03c9634";
const HELPER = "01a1335b-f30a-7dd2-a1d4-b675fd419238";
const file = (id: string) => `src/i${id.replace(/-/g, "")}.ts`;

function actionDoc(kbDir: string, id: string, name: string, usage = name): void {
	mkdirSync(kbDir, { recursive: true });
	writeFileSync(join(kbDir, `${id}.md`), `---\nkind: action\nid: ${id}\nname: ${name}\ngist: "${name}"\nmeta:\n  usages:\n    - ${usage}\n${CANONICAL}---\n`);
}

async function capeRepo(label: string): Promise<string> {
	const dir = gitRepo(label);
	ok(await run(["seed", "--root-kind", "cape"], dir));
	actionDoc(kbOf(dir), ACTION, "greet", "greet <who>");
	writeFileSync(join(kbOf(dir), `${HELPER}.md`), `---\nkind: function\nid: ${HELPER}\nname: shout\ngist: "Shouts"\n${CANONICAL}---\n`);
	return dir;
}

test("writes every missing file and Code section, says so, and on a second run has nothing to scaffold", async () => {
	const dir = await capeRepo("scaffold-cape");
	const { written, lines } = scaffoldCape(dir);
	const usage = written.find((each) => /^src\/i[0-9a-f]{32}\.ts$/.test(each) && each !== file(ACTION) && each !== file(HELPER))!;
	assert.deepEqual([...written].sort(), [
		file(ACTION),
		file(HELPER),
		usage,
		file(HELPER).replace(/\.ts$/, ".test.ts"),
		usage.replace(/\.ts$/, ".test.ts"),
		kbPath(dir, ACTION),
		kbPath(dir, HELPER),
	].sort());
	assert.deepEqual(lines.filter((line) => line.startsWith("updated ")).sort(), [`updated ${kbPath(dir, ACTION)}`, `updated ${kbPath(dir, HELPER)}`]);
	assert.match(readFileSync(join(dir, file(ACTION)), "utf8"), new RegExp(`case "u${usage.slice(5, 37)}": // greet <who>`));
	assert.match(readFileSync(join(dir, file(ACTION)), "utf8"), /from "nosedive-core"/, "a cape outside core imports core's types by name");
	assert.deepEqual(scaffoldCape(dir), { written: [], lines: ["nothing to scaffold"] });
});

test("a gate's usage gets an impl taking the pass's GateCtx, routed from call.gate, and no test", async () => {
	const dir = await capeRepo("scaffold-cape-gate");
	actionDoc(kbOf(dir), ACTION, "ready", "pass --ready <device>");
	const { written, lines } = scaffoldCape(dir);
	const impl = written.find((each) => /^src\/i[0-9a-f]{32}\.ts$/.test(each) && each !== file(ACTION) && each !== file(HELPER))!;
	assert.equal(existsSync(join(dir, impl.replace(/\.ts$/, ".test.ts"))), false);
	assert.match(readFileSync(join(dir, impl), "utf8"), /export async function i[0-9a-f]{32}\(ctx: GateCtx\)/);
	assert.match(readFileSync(join(dir, file(ACTION)), "utf8"), new RegExp(`return ${impl.slice(4, -3)}\\(call\\.gate!\\);`));
	assert.doesNotMatch(lines.join("\n"), /still to do/);
});

test("lists what it cannot fix, and leaves it", async () => {
	const dir = await capeRepo("scaffold-cape-left");
	mkdirSync(join(dir, "src"));
	writeFileSync(join(dir, "src", "stray.ts"), "export {};\n");
	assert.match(scaffoldCape(dir).lines.join("\n"), /still to do:\n(.|\n)*src\/stray\.ts: no doc accounts for it/);
	assert.equal(existsSync(join(dir, "src", "stray.ts")), true);
});

test("never enters node_modules, .git or .nosedive/capes, leaves a seeded repo nested in it to itself, and names a doc it cannot read", async () => {
	const dir = await capeRepo("scaffold-cape-walk");
	const ignored = mintUuid();
	for (const place of ["node_modules/pkg", ".git/refs/stray", ".nosedive/capes/built"]) actionDoc(join(dir, place), ignored, "ignored");
	const nested = join(dir, "capes", "inner");
	mkdirSync(join(nested, ".nosedive"), { recursive: true });
	writeFileSync(join(nested, ".nosedive", "config.yaml"), `id: ${mintUuid()}\nroots: []\n`);
	actionDoc(join(nested, "kb"), mintUuid(), "inner");
	const broken = mintUuid();
	writeFileSync(join(kbOf(dir), `${broken}.md`), `---\nkind: action\nid: ${broken}\nname: broken\nscopes:\n  - 01a1336b-c0b8-7cde-b7c6-285196062297: {canonical: true}\n  - 01a1336b-c0b8-7cde-b7c6-285196062297: {canonical: true}\n---\n`);
	const { written, lines } = scaffoldCape(dir);
	assert.ok(written.every((each) => !each.includes("node_modules") && !each.startsWith(".git") && !each.startsWith("capes/")), written.join(", "));
	assert.match(lines.join("\n"), new RegExp(`error ${kbPath(dir, broken).replace(/\./g, "\\.")}: `));
	assert.equal(existsSync(join(nested, "src")), false, "the nested repo is scaffolded when it is seeded");
});
