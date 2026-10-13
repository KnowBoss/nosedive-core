// mint [<count>] [--ms <utcmillis>] [--ts <iso8601>]
import assert from "node:assert/strict";
import { test } from "node:test";
import { ok, run, tempDir } from "./harness.ts";

const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const stamp = (id: string) => Number.parseInt(id.replace(/-/g, "").slice(0, 12), 16);

test("prints one id by default, and count ids a millisecond apart, in order", async () => {
	const dir = tempDir("mint");
	assert.match(ok(await run(["mint"], dir)), V7);
	const ids = ok(await run(["mint", "3"], dir)).split("\n");
	assert.equal(ids.length, 3);
	assert.deepEqual(ids.map((id) => stamp(id) - stamp(ids[0]!)), [0, 1, 2]);
});

test("stamps the first id with --ms or --ts", async () => {
	const dir = tempDir("mint-at");
	assert.equal(stamp(ok(await run(["mint", "--ms", "1791741249908"], dir))), 1791741249908);
	assert.equal(stamp(ok(await run(["mint", "--ts", "2026-10-11T00:00:00Z"], dir))), Date.parse("2026-10-11T00:00:00Z"));
});

test("refuses a bad count, a bad time, and both stamps at once", async () => {
	const dir = tempDir("mint-bad");
	for (const [argv, error] of [
		[["mint", "0"], /count must be a whole number above 0/],
		[["mint", "--ts", "soon"], /not a time: soon/],
		[["mint", "--ms", "1", "--ts", "2026-10-11T00:00:00Z"], /give --ms or --ts, not both/],
	] as const) {
		const result = await run([...argv], dir);
		assert.equal(result.code, 1);
		assert.match(result.err, error);
	}
});
