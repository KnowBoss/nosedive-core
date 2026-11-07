// crud --drop <quid> --sure [--hard]
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { declareKinds, git, ok, run, tempBridge } from "../test/harness.ts";

test("drops a doc that hangs from none only when sure", async () => {
	const bridge = await tempBridge("crud-drop-sure");
	await declareKinds(bridge, "goal");
	const path = ok(await run(["crud", "goal", "loose"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");
	const refused = await run(["crud", "--drop", id], bridge);
	assert.equal(refused.code, 1);
	assert.match(refused.err, new RegExp(`it hangs from no doc, so none can record what it held: \`nosedive crud --drop ${id} --sure\` drops it anyway`));
	assert.equal(ok(await run(["crud", "--drop", id, "--sure"], bridge)), path);
	assert.equal(existsSync(join(bridge, path)), false);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), "crud: drop");
});
