// configured-capes
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { git, greetCapeRepo, ok, registerRepo, run, setCapes, tempBridge, kbPath } from "../test/harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");

const core: Cape = await sourceCape();

test("lists each cape the base wears with its repo, and its build once there is one", async () => {
	const bridge = await tempBridge("configured-capes");
	const repo = greetCapeRepo();
	const id = await registerRepo(bridge, "greet-cape", repo);
	await registerRepo(bridge, "unknown-cape");
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

test("pass --attach-cape builds a registered cape and links it from the base, --detach-cape detaches it, and drop needs it off", async () => {
	const bridge = await tempBridge("configured-capes-attach");
	const id = await registerRepo(bridge, "greet-cape", greetCapeRepo());
	git(["add", "-A"], bridge);
	git(["commit", "-qm", "register greet-cape"], bridge);
	assert.match(ok(await run(["pass", "--attach-cape", id], bridge)), /attached greet-cape \S+ \([0-9a-f]{7}\)/);
	assert.deepEqual(configuredCapes(findBridge(bridge)!, core).map(({ name, build }) => [name, build?.actions]), [["greet-cape", { greet: "Greets" }]]);
	assert.equal(git(["log", "-1", "--format=%s"], bridge), "pass: attach-cape");
	assert.match((await run(["pass", "--attach-cape", id], bridge)).err, /the base already wears greet-cape/);
	assert.match((await run(["crud", "--drop", id, "--hard"], bridge)).err, /still linked/);
	assert.match(ok(await run(["pass", "--detach-cape", id], bridge)), /detached greet-cape/);
	assert.deepEqual(configuredCapes(findBridge(bridge)!, core), []);
	assert.match((await run(["pass", "--detach-cape", id], bridge)).err, /the base does not wear greet-cape/);
});

test("pass --attach-cape takes whatever name the hero gave the repo, and refuses a repo that is no cape", async () => {
	const bridge = await tempBridge("configured-capes-local-name");
	const id = await registerRepo(bridge, "tools-from-acme", greetCapeRepo({ name: "greeter" }));
	const plain = await registerRepo(bridge, "not-a-cape", greetCapeRepo({ plain: true }));
	git(["add", "-A"], bridge);
	git(["commit", "-qm", "register"], bridge);
	assert.match(ok(await run(["pass", "--attach-cape", id], bridge)), /attached tools-from-acme \S+ \([0-9a-f]{7}\)/);
	assert.match((await run(["pass", "--attach-cape", plain], bridge)).err, /not-a-cape is not a cape: it has no root/);
});

test("refuses a .cape link to a doc that is no repo, and reads only the selected base's", async () => {
	const bridge = await tempBridge("configured-capes-bad");
	await registerRepo(bridge, "greet-cape", greetCapeRepo());
	setCapes(bridge, ["greet-cape"]);
	const at = findBridge(bridge)!;
	const memo = idOf(ok(await run(["crud", "core:memo", "Not a repo"], bridge)));
	const root = at.roots[0]!.path;
	writeFileSync(root, readFileSync(root, "utf8").replace(/\.nosedive\/repos\/[0-9a-f-]{36}\.md:\n {6}rel: \.cape/, `${kbPath(bridge, memo)}:\n      rel: .cape`));
	assert.throws(() => configuredCapes(findBridge(bridge)!, core), new RegExp(`wears ${kbPath(bridge, memo)}, which is no repo doc`));
	assert.deepEqual(configuredCapes({ ...at, base: undefined }, core), [], "no base selected, no capes");
});
