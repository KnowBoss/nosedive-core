// crud <quid> --parent <parent>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { git, ok, run, tempBridge } from "../test/harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");

test("moves a doc to its new parent, unlinking the old one on both sides, in one commit", async () => {
	const bridge = await tempBridge("crud-parent");
	const [a, b, c] = [ok(await run(["crud", "goal", "a"], bridge)), ok(await run(["crud", "goal", "b"], bridge)), ok(await run(["crud", "goal", "c"], bridge))];
	ok(await run(["crud", idOf(c), "--parent", idOf(a)], bridge));
	assert.match(readFileSync(join(bridge, c), "utf8"), new RegExp(`links:\n {2}- kb/${idOf(a)}\\.md:\n {6}rel: parent\\.feat\n`));
	assert.match(readFileSync(join(bridge, a), "utf8"), new RegExp(`links:\n {2}- kb/${idOf(c)}\\.md:\n {6}rel: child\\.feat\n`));
	const head = git(["rev-parse", "HEAD"], bridge);

	assert.deepEqual(ok(await run(["crud", idOf(c), "--parent", idOf(b)], bridge)).split("\n").sort(), [a, b, c].sort());
	assert.equal(git(["log", "--format=%s", `${head}..HEAD`], bridge), "crud: updated 3 docs");
	assert.doesNotMatch(readFileSync(join(bridge, a), "utf8"), /links/);
	assert.doesNotMatch(readFileSync(join(bridge, c), "utf8"), new RegExp(idOf(a)));
	assert.match(readFileSync(join(bridge, c), "utf8"), new RegExp(`- kb/${idOf(b)}\\.md:\n {6}rel: parent\\.feat\n`));
	assert.match(readFileSync(join(bridge, b), "utf8"), new RegExp(`- kb/${idOf(c)}\\.md:\n {6}rel: child\\.feat\n`));

	ok(await run(["crud", idOf(c), "--parent", idOf(b)], bridge));
	assert.equal(git(["rev-list", "--count", `${head}..HEAD`], bridge), "1", "an unchanged parent commits nothing");
});

test("refuses the doc itself, or a doc under it, as its parent", async () => {
	const bridge = await tempBridge("crud-parent-refused");
	const a = idOf(ok(await run(["crud", "goal", "a"], bridge)));
	const b = idOf(ok(await run(["crud", "goal", "b"], bridge)));
	const c = idOf(ok(await run(["crud", "goal", "c"], bridge)));
	ok(await run(["crud", b, "--parent", a], bridge));
	ok(await run(["crud", c, "--parent", b], bridge));
	const head = git(["rev-parse", "HEAD"], bridge);

	assert.match((await run(["crud", a, "--parent", a], bridge)).err, new RegExp(`${a} cannot be its own parent`));
	assert.match((await run(["crud", a, "--parent", c], bridge)).err, new RegExp(`${c} is under ${a}, so it cannot be its parent`));
	assert.equal(git(["rev-parse", "HEAD"], bridge), head);
});
