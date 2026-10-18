// find-cape
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Cape, Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1337c825f7457b879d5c039ffeccd as findCape } from "./i01a1337c825f7457b879d5c039ffeccd.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { git, greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge } from "../test/harness.ts";

const core: Cape = await sourceCape();
const ctxAt = (cwd: string) => ({ cwd }) as Ctx;

test("finds nothing for an action the config does not name", async () => {
	const bridge = await tempBridge("find-cape-none");
	assert.equal(await findCape(ctxAt(bridge), "greet", core), undefined);
});

test("loads the cape seed built, by manifest for a ref and by id for a commit", async () => {
	const bridge = await tempBridge("find-cape");
	const repo = greetCapeRepo();
	await registerRepo(bridge, "greet-cape", repo);
	setCapes(bridge, ["greet-cape"]);
	assert.equal(await findCape(ctxAt(bridge), "greet", core), undefined, "nothing is built yet");
	ok(await run(["seed"], bridge));

	const cape = (await findCape(ctxAt(bridge), "greet", core))!;
	const commit = git(["rev-parse", "HEAD"], repo);
	assert.equal(cape.name, "greet-cape");
	assert.equal(cape.commit, commit);
	assert.equal(Object.values(cape.docs)[0]!.name, "greet");

	setCapes(bridge, [`greet-cape@${commit}`]);
	assert.equal((await findCape(ctxAt(bridge), "greet", core))!.id, cape.id);
});
