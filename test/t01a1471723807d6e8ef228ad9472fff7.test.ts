// read-text
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Ctx } from "../src/i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1471723807d6e8ef228ad9472fff7 as readText } from "../src/i01a1471723807d6e8ef228ad9472fff7.ts";
import { tempDir } from "./harness.ts";

test("reads stdin for -, else a file relative to the cwd, unparsed", async () => {
	const cwd = tempDir("read-text");
	const ctx = { cwd, stdin: async () => "key: value\n" } as Ctx;
	assert.equal(await readText("-", ctx), "key: value\n");
	writeFileSync(join(cwd, "a.md"), "# Text\n");
	assert.equal(await readText("a.md", ctx), "# Text\n");
});
