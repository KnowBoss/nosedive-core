// list-kinds
import assert from "node:assert/strict";
import { basename } from "node:path";
import { test } from "node:test";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a18e40518e7f15a2066909dca2be43 as listKinds } from "./i01a18e40518e7f15a2066909dca2be43.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { CORE, ok, run, tempBridge } from "../test/harness.ts";

const core: Cape = await sourceCape();
const cape = (owner: string, name: string, shortName: string, kinds: Record<string, unknown>) => ({ ...core, owner, name, shortName, kinds, repoDir: undefined }) as Cape;

test("lists the repo's own kinds, bare, then core's, with every spelling that reaches each", async () => {
	const dir = await tempBridge("list-kinds");
	ok(await run(["crud", "core:kind", "An", "idea", "--name", "idea", "--meta", "-"], dir, "schema:\n  type: object\n  additionalProperties: true\n"));
	const hero = findBridge(dir)!;
	const [own, theirs, ...rest] = listKinds(hero, [core]);
	assert.equal(rest.length, 0);
	assert.deepEqual([own!.owner, own!.name, own!.kinds.map((kind) => [kind.name, kind.spellings])], [hero.id, basename(dir), [["idea", ["idea"]]]]);
	assert.deepEqual([theirs!.owner, theirs!.name, theirs!.longName], [CORE, "core", "nosedive-core"]);
	assert.deepEqual(theirs!.kinds.find((kind) => kind.name === "memo")!.spellings, ["core:memo", "nosedive-core:memo", `${CORE}:memo`]);
	assert.equal(theirs!.kinds.find((kind) => kind.name === "memo")!.meta.owner, CORE);
});

test("leaves out a spelling two capes answer to, core first among the capes", async () => {
	const hero = findBridge(await tempBridge("list-kinds-clash"))!;
	const [one, two] = ["01a18e62-0000-7000-8000-0000000000d1", "01a18e62-0000-7000-8000-0000000000d2"];
	const groups = listKinds(hero, [cape(one!, "alpha-cape", "shared", { thing: {} }), core, cape(two!, "beta-cape", "shared", { thing: {} })]);
	assert.deepEqual(groups.map((group) => group.name), [basename(hero.dir), "core", "shared", "shared"]);
	assert.deepEqual(groups[2]!.kinds[0]!.spellings, ["alpha-cape:thing", `${one}:thing`]);
	assert.deepEqual(groups[3]!.kinds[0]!.spellings, ["beta-cape:thing", `${two}:thing`]);
});
