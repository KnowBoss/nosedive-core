// scaf [<quid>]
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { gitRepo, ok, run } from "../test/harness.ts";

const ACTION = "01a1335b-f253-7b80-ab64-d2f9a03c9634";
const HELPER = "01a1335b-f30a-7dd2-a1d4-b675fd419238";

async function capeRepo(): Promise<string> {
	const dir = gitRepo("scaf");
	ok(await run(["seed", "--root-kind", "cape"], dir));
	writeFileSync(
		join(dir, "kb", `${ACTION}.md`),
		`---\nkind: action\nid: ${ACTION}\nname: greet\ngist: "Greets"\nmeta:\n  usages:\n    - greet <who>\n---\n`,
	);
	writeFileSync(join(dir, "kb", `${HELPER}.md`), `---\nkind: function\nid: ${HELPER}\nname: shout\ngist: "Shouts"\n---\n`);
	return dir;
}

test("writes every missing file, then nothing on a second run", async () => {
	const dir = await capeRepo();
	const out = ok(await run(["scaf"], dir));
	const lines = out.split("\n");
	const created = lines.filter((line) => line.startsWith("created ")).map((line) => line.slice(8));
	assert.deepEqual(lines.filter((line) => line.startsWith("updated ")).sort(), [`updated kb/${ACTION}.md`, `updated kb/${HELPER}.md`]);
	const docs = [ACTION, HELPER].map((id) => `src/i${id.replace(/-/g, "")}.ts`);
	const usage = created.find((file) => /^src\/i[0-9a-f]{32}\.ts$/.test(file) && !docs.includes(file))!;
	const hex = usage.slice(5, 37);
	assert.deepEqual(created.sort(), [
		`src/i${ACTION.replace(/-/g, "")}.ts`,
		`src/i${HELPER.replace(/-/g, "")}.ts`,
		`src/i${hex}.ts`,
		`src/i${HELPER.replace(/-/g, "")}.test.ts`,
		`src/i${hex}.test.ts`,
	].sort());
	assert.match(readFileSync(join(dir, `src/i${ACTION.replace(/-/g, "")}.ts`), "utf8"), new RegExp(`case "u${hex}": // greet <who>`));
	assert.equal(ok(await run(["scaf"], dir)), "nothing to scaffold");
});

test("a gate's usage gets an impl taking the pass's GateCtx, routed from call.gate, and no test", async () => {
	const dir = await capeRepo();
	writeFileSync(
		join(dir, "kb", `${ACTION}.md`),
		`---\nkind: action\nid: ${ACTION}\nname: ready\ngist: "Readies"\nmeta:\n  usages:\n    - pass --ready <device>\n---\n`,
	);
	const out = ok(await run(["scaf", ACTION], dir));
	const impl = /created src\/(i[0-9a-f]{32})\.ts/g;
	const files = [...out.matchAll(impl)].map((match) => match[1]!).filter((name) => name !== `i${ACTION.replace(/-/g, "")}`);
	assert.equal(files.length, 1);
	assert.doesNotMatch(out, /created src\/i[0-9a-f]{32}\.test\.ts/);
	assert.match(readFileSync(join(dir, "src", `${files[0]}.ts`), "utf8"), /export async function i[0-9a-f]{32}\(ctx: GateCtx\)/);
	assert.match(readFileSync(join(dir, "src", `i${ACTION.replace(/-/g, "")}.ts`), "utf8"), new RegExp(`return ${files[0]}\\(call\\.gate!\\);`));
	assert.doesNotMatch(out, /\n {2}ready /, "nothing left to do for the gate");
});

test("one action only, and lists what it cannot fix", async () => {
	const dir = await capeRepo();
	mkdirSync(join(dir, "src"));
	writeFileSync(join(dir, "src", "stray.ts"), "export {};\n");
	const out = ok(await run(["scaf", HELPER], dir));
	assert.match(out, /created src\/i01a1335bf30a7dd2a1d4b675fd419238\.ts/);
	assert.deepEqual(out.match(/created src\/\S+/g), ["created src/i01a1335bf30a7dd2a1d4b675fd419238.ts", "created src/i01a1335bf30a7dd2a1d4b675fd419238.test.ts"], "only the chosen doc's code");
	assert.match(out, /still to do:\n(.|\n)*greet .*missing src\/i01a1335bf2537b80ab64d2f9a03c9634\.ts/);
	assert.match(out, /src\/stray\.ts: no doc accounts for it/);
	assert.equal(existsSync(join(dir, "src", "stray.ts")), true);
});

test("runs in a base, whose code imports core's types by name", async () => {
	const dir = gitRepo("scaf-base");
	ok(await run(["seed"], dir));
	writeFileSync(join(dir, "kb", `${ACTION}.md`), `---\nkind: action\nid: ${ACTION}\nname: greet\ngist: "Greets"\nmeta:\n  usages:\n    - greet <who>\n---\n`);
	assert.match(ok(await run(["scaf", ACTION], dir)), /created src\/i01a1335bf2537b80ab64d2f9a03c9634\.ts/);
	assert.match(readFileSync(join(dir, "src", "i01a1335bf2537b80ab64d2f9a03c9634.ts"), "utf8"), /from "nosedive-core"/);
});

test("refuses a repo that is neither a cape nor a base", async () => {
	const memo = gitRepo("scaf-memo");
	ok(await run(["seed", "--root-kind", "memo"], memo));
	const refused = await run(["scaf"], memo);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /scaf runs in a cape or a base, and this repo's root is a memo: `nosedive seed --root-kind cape` makes a cape/);
	const bare = await run(["scaf"], gitRepo("scaf-bare"));
	assert.match(bare.err, /this repo has no root/);
});
