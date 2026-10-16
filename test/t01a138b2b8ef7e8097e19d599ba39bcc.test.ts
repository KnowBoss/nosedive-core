// check-meta
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Cape } from "../src/i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a138b2b8ef7e8097e19d599ba39bcc as checkMeta } from "../src/i01a138b2b8ef7e8097e19d599ba39bcc.ts";
import { tempDir } from "./harness.ts";

const closed = { type: "object", additionalProperties: false, properties: { owner: { type: "string" } } };
const cape = { kinds: { task: { schema: closed } } } as unknown as Cape;

test("checks against the first kb declaring the kind, then the capes, and warns when none does", () => {
	const kb = tempDir("check-meta");
	writeFileSync(join(kb, "k.md"), "---\nkind: kind\nname: task\nmeta:\n  schema:\n    type: object\n    additionalProperties: true\n---\n");
	assert.equal(checkMeta("task", { anything: 1 }, [kb], [cape]), undefined, "the kb's open schema wins");
	assert.equal(checkMeta("task", { owner: "dan" }, [], [cape]), undefined);
	assert.throws(() => checkMeta("task", { owner: 1, extra: true }, [], [cape]), /meta does not fit kind task:\n {2}meta must NOT have additional properties\n {2}\/owner must be string/);
	assert.match(checkMeta("note", {}, [kb], [cape])!, /no kind note is declared here/);
});
