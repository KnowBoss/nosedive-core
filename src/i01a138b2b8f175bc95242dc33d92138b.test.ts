// run-repo-tests
import assert from "node:assert/strict";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
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

test("loads what the code imports from assets/ as its text", async () => {
	const bridge = await tempBridge("run-repo-tests-assets");
	const repo = greetCapeRepo();
	mkdirSync(join(repo, "assets"), { recursive: true });
	writeFileSync(join(repo, "assets", "page.html"), "<p>hi</p>\n");
	writeFileSync(join(repo, "assets", "app.client.ts"), "const x: number = 1;\n");
	writeFileSync(
		join(repo, "src", "assets.test.ts"),
		'import assert from "node:assert/strict";\nimport { test } from "node:test";\nimport page from "../assets/page.html";\nimport app from "../assets/app.client.ts";\ntest("assets are text", () => {\n\tassert.equal(page, "<p>hi</p>\\n");\n\tassert.equal(app, "const x: number = 1;\\n");\n});\n',
	);
	const run = gate(repo, bridge);
	runRepoTests(run.ctx);
	assert.match(run.out.join("\n"), /✔ assets are text/);
});

test("resolves nosedive-core to the running core, even with core checked out in the workspace", async () => {
	const bridge = await tempBridge("run-repo-tests-core-checkout");
	// A cape checked out under core's name, which exports none of core's functions.
	cpSync(greetCapeRepo(), join(bridge, "workspace", core.name), { recursive: true });
	const repo = greetCapeRepo();
	writeFileSync(
		join(repo, "src", "core.test.ts"),
		'import assert from "node:assert/strict";\nimport { test } from "node:test";\nimport { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "nosedive-core";\ntest("core is the running one", () => {\n\tassert.equal(typeof namespacedUuid, "function");\n});\n',
	);
	const run = gate(repo, bridge);
	runRepoTests(run.ctx);
	assert.match(run.out.join("\n"), /✔ core is the running one/);
});
