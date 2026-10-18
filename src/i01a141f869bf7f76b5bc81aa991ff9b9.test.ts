// configured-capes
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { git, greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge } from "../test/harness.ts";

const core: Cape = await sourceCape();

test("lists each configured cape with its repo, and its build once there is one", async () => {
	const bridge = await tempBridge("configured-capes");
	const repo = greetCapeRepo();
	const id = await registerRepo(bridge, "greet-cape", repo);
	setCapes(bridge, ["greet-cape", "unknown-cape@v1"]);
	const before = configuredCapes(findBridge(bridge)!, core);
	assert.deepEqual(
		before.map(({ spec, name, ref, repo, build }) => ({ spec, name, ref, repo: repo?.id, build })),
		[
			{ spec: "greet-cape", name: "greet-cape", ref: "", repo: id, build: undefined },
			{ spec: "unknown-cape@v1", name: "unknown-cape", ref: "v1", repo: undefined, build: undefined },
		],
	);
	setCapes(bridge, ["greet-cape"]);
	ok(await run(["seed"], bridge));
	const [built] = configuredCapes(findBridge(bridge)!, core);
	assert.equal(built!.build!.commit, git(["rev-parse", "HEAD"], repo));
	assert.deepEqual(built!.build!.actions, { greet: "Greets" });
});

test("refuses a cape listed twice, and capes that are not a list", async () => {
	const bridge = await tempBridge("configured-capes-bad");
	setCapes(bridge, ["greet-cape", "greet-cape@v1"]);
	assert.throws(() => configuredCapes(findBridge(bridge)!, core), /config names greet-cape more than once/);
	const at = findBridge(bridge)!;
	assert.throws(() => configuredCapes({ ...at, config: { capes: { greet: "greet-cape" } } }, core), /config `capes` lists cape repos/);
});
