// read-source
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335487317576a0afd03506ef5555 as readSource } from "./i01a1335487317576a0afd03506ef5555.ts";
import { tempDir } from "../test/harness.ts";

test("reads YAML from stdin for `-`, and JSON or YAML from a file relative to cwd", async () => {
	const cwd = tempDir("read-source");
	writeFileSync(join(cwd, "p.json"), '{"a": 1}');
	const ctx = { cwd, stdin: async () => "b: 2\n" } as Ctx;
	assert.deepEqual(await readSource("-", ctx), { b: 2 });
	assert.deepEqual(await readSource("p.json", ctx), { a: 1 });
});
