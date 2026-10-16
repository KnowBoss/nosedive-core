// load-source-cape
import assert from "node:assert/strict";
import { test } from "node:test";
import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "../src/i01a1335480147d0686528aee80f8ee34.ts";
import { i01a135419cdf7f3ba72a31c4092c5bb5 as loadSourceCape } from "../src/i01a135419cdf7f3ba72a31c4092c5bb5.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { repoDir } from "../scripts/source-cape.mjs";

const ID = "01a13541-9d8a-7f92-8be9-3ad202ef84bd";
const SCAF = "01a13354-7f5f-7c45-a3fb-2ac0e3a7678e";

test("indexes each action by name and its entrypoint by doc id, under the given id", async () => {
	const cape = await loadSourceCape(repoDir, ID, "nosedive-core");
	assert.deepEqual([cape.id, cape.name, cape.commit, cape.version], [ID, "nosedive-core", "source", "source"]);
	assert.equal(cape.index[namespacedUuid("scaf", ID)], SCAF);
	assert.equal(typeof cape.index[namespacedUuid(SCAF, ID)], "function");
});
