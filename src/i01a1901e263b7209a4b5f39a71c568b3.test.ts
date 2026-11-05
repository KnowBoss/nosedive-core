// feat-tree
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1901e263b7209a4b5f39a71c568b3 as featWalk, featRoot, featTree, linkedIds } from "./i01a1901e263b7209a4b5f39a71c568b3.ts";
import { git, ok, run, tempBridge, kbOf, kbPath } from "../test/harness.ts";

const idOf = (path: string) => path.replace(/^.*\/|\.md$/g, "");
const DIVE = "01a1901e-0000-7000-8000-000000000001";
const OVER = "01a1901e-0000-7000-8000-000000000002";

test("reads the feats the roots reach, not parent.feat, whatever their kind", async () => {
	const dir = await tempBridge("feat-tree");
	const hero = findBridge(dir)!;
	const feat = ok(await run(["crud", "core:memo", "ideas", "--name", "ideas"], dir));
	const loose = ok(await run(["crud", "core:memo", "loose", "--name", "loose"], dir));
	for (const [id, diver, outcome] of [[DIVE, "a@x#1", ""], [OVER, "a@x#1", "landed"]]) {
		writeFileSync(join(kbOf(dir), `${id}.md`), `---\nkind: dive\nid: ${id}\nname: d-${id.slice(-1)}\nmeta:\n  feat: ${idOf(feat)}\n  diver: ${diver}\n${outcome ? `  outcome: ${outcome}\n` : ""}---\n`);
	}
	git(["add", "-A"], dir);
	git(["commit", "-qm", "dives"], dir);
	ok(await run(["crud", hero.root!, "--links", "-"], dir, `${feat}: {rel: work.feat}\n`));
	ok(await run(["crud", idOf(feat), "--links", "-"], dir, `${loose}: {rel: parent.feat}\n`));
	ok(await run(["crud", idOf(feat), "--links", "-"], dir, `${kbPath(dir, DIVE)}: {rel: dives.feat}\n${kbPath(dir, OVER)}: {rel: dives.feat}\n`));

	const walk = featWalk(hero);
	assert.deepEqual([...walk.feats.keys()].sort(), [idOf(feat), DIVE, OVER].sort(), "the loose doc is no feat");
	assert.equal(walk.feats.get(DIVE)!.parents[0], idOf(feat));
	assert.equal(featTree(hero).size, 3);
	assert.equal(featRoot(hero, idOf(feat)), hero.kbDir);
	assert.equal(featRoot(hero, idOf(loose)), undefined);
});

test("lists the ids a doc links in its own repo, leaving out another repo's", () => {
	const links = [{ "kb/01a1901e-0000-7000-8000-000000000003.md": { rel: "child.feat" } }, { "other:01a1901e-0000-7000-8000-000000000004": { rel: "uses.function" } }, { "01a1901e-0000-7000-8000-000000000005": null }];
	assert.deepEqual(linkedIds({ fm: { links } }), [{ id: "01a1901e-0000-7000-8000-000000000003", rel: "child.feat" }, { id: "01a1901e-0000-7000-8000-000000000005", rel: undefined }]);
});
