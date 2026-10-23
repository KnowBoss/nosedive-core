// crud <quid> --scopes <source>
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ok, run, tempBridge } from "../test/harness.ts";

const REPO_A = "01a12c5f-ae52-71b4-a9d8-9fbc485580d2";
const REPO_B = "01a12b6e-7152-7704-890d-4e398742c50f";

test("adds, merges onto and removes scope entries", async () => {
	const bridge = await tempBridge("crud-scopes");
	const path = ok(await run(["crud", "feat", "scoped"], bridge));
	const id = path.replace(/^.*\/|\.md$/g, "");

	ok(await run(["crud", id, "--scopes", "-"], bridge, `${REPO_A}:\n  work-branch: work/a\n${REPO_B}:\n`));
	ok(await run(["crud", id, "--scopes", "-"], bridge, `${REPO_A}:\n  ref: main\n${REPO_B}: null\n`));

	assert.match(
		readFileSync(join(bridge, path), "utf8"),
		new RegExp(`\\nscopes:\\n  - ${REPO_A}:\\n      work-branch: work/a\\n      ref: main\\n---\\n`),
	);
});
