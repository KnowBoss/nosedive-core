// crud --batch <source>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, ok, run, tempBridge } from "./harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");

test("applies every edit in order and commits once, with text inline", async () => {
	const bridge = await tempBridge("crud-batch");
	const a = ok(await run(["crud", "goal", "a"], bridge));
	const b = ok(await run(["crud", "goal", "b"], bridge));
	const head = git(["rev-parse", "HEAD"], bridge);
	const batch = [
		`- quid: ${idOf(a)}`,
		"  title: Alpha",
		`- quid: ${idOf(a)}`,
		"  body: |",
		"    A path: C:\\old\\dir",
		"",
		"    Done.",
		`- quid: ${idOf(a)}`,
		"  section: {heading: Open, text: Nothing yet.}",
		`- quid: ${idOf(a)}`,
		"  replace:",
		"    old: C:\\old\\dir",
		"    new: D:\\new\\dir",
		`- quid: ${idOf(b)}`,
		"  gist: second",
		`- quid: ${idOf(b)}`,
		`  parent: ${idOf(a)}`,
		`- quid: ${idOf(b)}`,
		"  meta: {size: 2}",
		"",
	].join("\n");

	assert.deepEqual(ok(await run(["crud", "--batch", "-"], bridge, batch)).split("\n").sort(), [a, b].sort());
	assert.equal(git(["log", "--format=%s", `${head}..HEAD`], bridge), "crud: updated 2 docs");
	assert.match(readFileSync(join(bridge, a), "utf8"), /\n---\n\n# Alpha\n\nA path: D:\\new\\dir\n\nDone\.\n\n## Open\n\nNothing yet\.\n$/);
	assert.match(readFileSync(join(bridge, a), "utf8"), new RegExp(`- kb/${idOf(b)}\\.md:\n {6}rel: child\\.feat\n`));
	const second = readFileSync(join(bridge, b), "utf8");
	assert.match(second, /\ngist: "second"\n/);
	assert.match(second, /\nmeta:\n {2}size: 2\n/);
	assert.match(second, new RegExp(`- kb/${idOf(a)}\\.md:\n {6}rel: parent\\.feat\n`));
});

test("writes nothing when any edit is refused, naming the item", async () => {
	const bridge = await tempBridge("crud-batch-refused");
	const a = ok(await run(["crud", "goal", "a"], bridge));
	const before = readFileSync(join(bridge, a), "utf8");
	const head = git(["rev-parse", "HEAD"], bridge);

	const refused = await run(["crud", "--batch", "-"], bridge, `- quid: ${idOf(a)}\n  gist: fine\n- quid: ${idOf(a)}\n  replace: {old: absent, new: x}\n`);
	assert.equal(refused.code, 1);
	assert.match(refused.err, /--batch item 2: --replace found its text nowhere/);

	const malformed = await run(["crud", "--batch", "-"], bridge, `- quid: ${idOf(a)}\n  gist: one\n  name: two\n`);
	assert.match(malformed.err, /--batch item 1 takes a quid and one of meta, scopes, links, parent, title, body, section, replace, gist, name, kind/);
	assert.match((await run(["crud", "--batch", "-"], bridge, "gist: one\n")).err, /--batch takes a list of edits/);

	assert.equal(readFileSync(join(bridge, a), "utf8"), before);
	assert.equal(git(["rev-parse", "HEAD"], bridge), head);
});
