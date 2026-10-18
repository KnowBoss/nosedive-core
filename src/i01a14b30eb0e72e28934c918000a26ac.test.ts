// load-cape
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1337c810a7456876b831d0c873396 as capeManifest } from "./i01a1337c810a7456876b831d0c873396.ts";
import { i01a14b30eb0e72e28934c918000a26ac as loadCape } from "./i01a14b30eb0e72e28934c918000a26ac.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge } from "../test/harness.ts";

const core: Cape = await sourceCape();

test("loads a built cape once, and refuses one this core has not built", async () => {
	const bridge = await tempBridge("load-cape");
	await registerRepo(bridge, "greet-cape", greetCapeRepo());
	setCapes(bridge, ["greet-cape"]);
	ok(await run(["seed"], bridge));
	const [build] = capeManifest(bridge);

	const cape = await loadCape(bridge, build!, core);
	assert.equal(cape.name, "greet-cape");
	assert.equal(await loadCape(bridge, build!, core), cape);

	await assert.rejects(loadCape(bridge, { ...build!, id: "never-built" }, core), /needs capes this core has not built: run `nosedive seed`/);
});
