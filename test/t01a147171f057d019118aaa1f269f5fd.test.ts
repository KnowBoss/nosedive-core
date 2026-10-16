// find-kind
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Cape } from "../src/i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a147171f057d019118aaa1f269f5fd as findKind } from "../src/i01a147171f057d019118aaa1f269f5fd.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { tempDir } from "./harness.ts";

const core: Cape = await sourceCape();

test("finds a kind in the first kb that declares it, else in the capes, with its durability", () => {
	const kb = tempDir("find-kind");
	assert.deepEqual(findKind("memo", [kb], [core]), { ...(core.kinds.memo as object) });
	assert.equal(findKind("memo", [kb], [core])?.durable, true);
	writeFileSync(join(kb, "memo.md"), "---\nkind: kind\nid: m\nname: memo\nmeta:\n  schema:\n    type: object\n    additionalProperties: true\n---\n");
	assert.deepEqual(findKind("memo", [kb], [core]), { schema: { type: "object", additionalProperties: true } }, "the kb overrides core, durability included");
	assert.equal(findKind("goal", [kb], [core]), undefined);
});
