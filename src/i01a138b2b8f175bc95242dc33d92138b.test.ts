// run-repo-tests
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a138b2b8f175bc95242dc33d92138b as runRepoTests } from "./i01a138b2b8f175bc95242dc33d92138b.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { git, greetCapeRepo, tempBridge, waveCapeRepo } from "../test/harness.ts";

const core: Cape = await sourceCape();

function gate(repoDir: string, bridgeDir: string) {
	const out: string[] = [];
	return { out, ctx: { core, repoDir, bridgeDir, out: (text: string) => void out.push(text), err: () => {} } };
}

test("runs a repo's tests against the running core, and fails when they fail", async () => {
	const bridge = await tempBridge("run-repo-tests");
	const passing = gate(greetCapeRepo(), bridge);
	runRepoTests(passing.ctx);
	assert.match(passing.out.join("\n"), /✔ greet <who>/);

	const failing = gate(greetCapeRepo({ failing: true }), bridge);
	assert.throws(() => runRepoTests(failing.ctx), /the tests of nosedive-core-greet-cape-\S+ failed/);
	assert.match(failing.out.join("\n"), /✖ greet <who>/);
});

test("resolves another cape by its name to its checkout beside the repo in the workspace", async () => {
	const bridge = await tempBridge("run-repo-tests-capes");
	const workspace = join(bridge, "workspace");
	git(["clone", "-q", greetCapeRepo(), join(workspace, "greet-cape")], bridge);
	git(["clone", "-q", waveCapeRepo(), join(workspace, "wave-cape")], bridge);
	const wave = gate(join(workspace, "wave-cape"), bridge);
	runRepoTests(wave.ctx);
	assert.match(wave.out.join("\n"), /✔ wave <who>/);
});
