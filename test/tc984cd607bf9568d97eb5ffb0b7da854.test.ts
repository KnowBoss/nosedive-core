// scaf [<quid>]
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { gitRepo, ok, run } from "./harness.ts";

const ACTION = "01a1335b-f253-7b80-ab64-d2f9a03c9634";
const HELPER = "01a1335b-f30a-7dd2-a1d4-b675fd419238";

function capeRepo(): string {
	const dir = gitRepo("scaf");
	mkdirSync(join(dir, "kb"));
	writeFileSync(
		join(dir, "kb", `${ACTION}.md`),
		`---\nkind: action\nid: ${ACTION}\nname: greet\ngist: "Greets"\nmeta:\n  usages:\n    - greet <who>\n---\n`,
	);
	writeFileSync(join(dir, "kb", `${HELPER}.md`), `---\nkind: action\nid: ${HELPER}\nname: shout\ngist: "Shouts"\n---\n`);
	return dir;
}

test("writes every missing file, then nothing on a second run", async () => {
	const dir = capeRepo();
	const out = ok(await run(["scaf"], dir));
	const created = out.split("\n").map((line) => line.replace(/^created /, ""));
	const usage = created.find((file) => /^src\/i[0-9a-f]{32}\.ts$/.test(file))!;
	const hex = usage.slice(5, 37);
	assert.deepEqual(created.sort(), [
		`src/a${ACTION.replace(/-/g, "")}.ts`,
		`src/a${HELPER.replace(/-/g, "")}.ts`,
		`src/i${hex}.ts`,
		`test/t${HELPER.replace(/-/g, "")}.test.ts`,
		`test/t${hex}.test.ts`,
	].sort());
	assert.match(readFileSync(join(dir, `src/a${ACTION.replace(/-/g, "")}.ts`), "utf8"), new RegExp(`case "u${hex}": // greet <who>`));
	assert.equal(ok(await run(["scaf"], dir)), "nothing to scaffold");
});

test("one action only, and lists what it cannot fix", async () => {
	const dir = capeRepo();
	mkdirSync(join(dir, "src"));
	writeFileSync(join(dir, "src", "stray.ts"), "export {};\n");
	const out = ok(await run(["scaf", HELPER], dir));
	assert.match(out, /created src\/a01a1335bf30a7dd2a1d4b675fd419238\.ts/);
	assert.doesNotMatch(out, /created src\/i/);
	assert.match(out, /still to do:\n(.|\n)*greet .*missing src\/a01a1335bf2537b80ab64d2f9a03c9634\.ts/);
	assert.match(out, /src\/stray\.ts: no action doc accounts for it/);
	assert.equal(existsSync(join(dir, "src", "stray.ts")), true);
});
