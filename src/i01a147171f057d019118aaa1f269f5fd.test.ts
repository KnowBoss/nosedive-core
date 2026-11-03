// find-kind
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { schemaDigest } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { assertPublished, digestOf, i01a147171f057d019118aaa1f269f5fd as findKind, kindOfDoc, unknownKind, versionOf } from "./i01a147171f057d019118aaa1f269f5fd.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { CORE, checkedOut, git, gitRepo, ok, registerRepo, run, setCapes, tempBridge, tempDir } from "../test/harness.ts";

const core: Cape = await sourceCape();
const WORK = "01a18e62-0000-7000-8000-0000000000a1";
const cape = (owner: string, name: string, shortName: string, kinds: Record<string, unknown>) => ({ ...core, owner, name, shortName, kinds, repoDir: undefined }) as Cape;
const OPEN = "schema:\n  type: object\n  additionalProperties: true\n";

async function heroWithIdea(label: string): Promise<string> {
	const dir = await tempBridge(label);
	ok(await run(["crud", "core:kind", "an idea", "--name", "idea", "--meta", "-"], dir, OPEN));
	return dir;
}

test("a bare kind is the acting repo's own, never a cape's or core's", async () => {
	const dir = await heroWithIdea("find-kind-bare");
	const hero = findBridge(dir)!;
	assert.deepEqual([findKind("idea", hero, [core])?.owner, findKind("idea", hero, [core])?.name], [hero.id, "idea"]);
	assert.equal(findKind("memo", hero, [core]), undefined, "core's memo is core:memo");
	assert.equal(findKind("goal", hero, [core]), undefined);
	assert.equal(findKind(`${hero.id}:idea`, hero, [core])?.owner, hero.id, "a repo's own id reaches its own kinds too");
});

test("a cape's kind is spelled by its short name, its long name or its owner's id", async () => {
	const dir = await heroWithIdea("find-kind-spellings");
	const hero = findBridge(dir)!;
	const spellings = ["core:memo", "nosedive-core:memo", `${CORE}:memo`];
	for (const spelling of spellings) assert.equal(findKind(spelling, hero, [core])?.id, core.kinds.memo && (core.kinds.memo as { id: string }).id, spelling);
	assert.equal(findKind("core:memo", hero, [core])?.owner, CORE);
	assert.equal(findKind("core:idea", hero, [core]), undefined, "a cape declares only its own");
});

test("two capes with one short name answer to it neither; each is reached by its long name, else by its owner's id", async () => {
	const dir = await heroWithIdea("find-kind-clash");
	const hero = findBridge(dir)!;
	const [one, two] = ["01a18e62-0000-7000-8000-0000000000b1", "01a18e62-0000-7000-8000-0000000000b2"];
	const capes = [core, cape(one!, "alpha-cape", "shared", { thing: { id: "1" } }), cape(two!, "beta-cape", "shared", { thing: { id: "2" } })];
	assert.equal(findKind("shared:thing", hero, capes), undefined);
	assert.equal(findKind("alpha-cape:thing", hero, capes)?.id, "1");
	assert.equal(findKind("beta-cape:thing", hero, capes)?.id, "2");
	const same = [core, cape(one!, "same", "shared", { thing: { id: "1" } }), cape(two!, "same", "other", { thing: { id: "2" } })];
	assert.equal(findKind("same:thing", hero, same), undefined);
	assert.equal(findKind(`${two}:thing`, hero, same)?.id, "2");
	assert.equal(findKind("other:thing", hero, same)?.id, "2");
	assert.match(unknownKind("shared:thing", hero, capes).message, /shared:thing names no kind; thing is reached as alpha-cape:thing, 01a18e62-0000-7000-8000-0000000000b1:thing and beta-cape:thing, 01a18e62-0000-7000-8000-0000000000b2:thing/);
	assert.match(unknownKind("nope:zzz", hero, capes).message, /nope:zzz names no kind: `nosedive crud` lists the kinds there are/);
});

test("given a hero repo, finds a kind its configured capes' builds recorded, without loading them", async () => {
	const dir = await tempBridge("find-kind-hero");
	const repo = await registerRepo(dir, "kinded-cape", gitRepo("find-kind-cape"));
	setCapes(dir, ["kinded-cape"]);
	mkdirSync(join(dir, ".nosedive", "capes"), { recursive: true });
	const idea = { schema: { type: "object", additionalProperties: false }, doneWhen: "It is built or let go.", links: [] };
	const build = { id: "b", owner: WORK, shortName: "kinded", repo, ref: "", commit: "c", core: core.id, coreVersion: core.version, actions: {}, kinds: { idea }, needs: {}, version: "v", builtAt: "2026-01-01T00:00:00.000Z" };
	writeFileSync(join(dir, ".nosedive", "capes", "manifest.json"), JSON.stringify([build]));
	const hero = findBridge(dir)!;
	for (const spelling of ["kinded:idea", "kinded-cape:idea", `${WORK}:idea`]) assert.deepEqual({ ...findKind(spelling, hero, [core])! }, { ...idea, name: "idea", owner: WORK, repoDir: undefined, repoDocId: repo }, spelling);
});

test("reads a doc's kind in the terms of the repo that holds it when that is seeded, else of the acting repo", async () => {
	const dir = await heroWithIdea("find-kind-doc");
	const hero = findBridge(dir)!;
	const read = (minted: string) => ({ fm: readKbDoc(readFileSync(join(dir, minted), "utf8")).fm, path: join(dir, minted), repoDir: dir });
	const own = read(ok(await run(["crud", "idea", "mine"], dir)));
	const memo = read(ok(await run(["crud", "core:memo", "core's"], dir)));
	assert.equal(kindOfDoc(own, hero, [core]).kind?.owner, hero.id);
	assert.equal(kindOfDoc(own, hero, [core]).spelling, "idea");
	assert.deepEqual(kindOfDoc(memo, hero, [core]).identity, { owner: CORE, name: "memo" });
	assert.equal(kindOfDoc(memo, hero, [core]).spelling, `${CORE}:memo`);
	assert.equal(kindOfDoc(memo, hero, [core]).kind?.name, "memo");
	// A checkout that is seeded declares its own kinds, which are the ones its docs mean.
	const work = gitRepo("find-kind-work");
	ok(await run(["seed"], work));
	ok(await run(["crud", "core:kind", "a thing", "--name", "thing", "--meta", "-"], work, OPEN));
	const checkout = join(dir, "workspace", "work");
	git(["clone", "-q", work, checkout], dir);
	const workId = findBridge(checkout)!.id;
	const thing = { fm: { kind: "thing" }, path: join(checkout, "kb", "x.md"), repoDir: checkout };
	assert.equal(kindOfDoc(thing, hero, [core]).kind?.owner, workId, "work's own thing, not the hero's");
	assert.equal(kindOfDoc({ ...thing, fm: { kind: "idea" } }, hero, [core]).kind, undefined, "the hero's idea is no business of work's docs");
	// A checkout that is not seeded is read as the acting repo reads it.
	const loose = checkedOut(dir, "loose");
	const doc = { fm: { kind: "idea" }, path: join(loose, "kb", "y.md"), repoDir: loose };
	assert.equal(kindOfDoc(doc, hero, [core]).kind?.owner, hero.id);
});

test("a kind's version is the last commit that changed its schema, not its prose", async () => {
	const dir = await heroWithIdea("find-kind-version");
	const idea = () => findKind("idea", findBridge(dir)!, [core])!;
	const first = versionOf(idea());
	assert.equal(first, git(["log", "-1", "--format=%H"], dir));
	ok(await run(["crud", idea().id!, "--body", "-"], dir, "Now it has prose.\n"));
	assert.equal(versionOf(idea()), first, "prose edits leave it");
	ok(await run(["crud", idea().id!, "--gist", "A new gist"], dir));
	assert.equal(versionOf(idea()), first);
	ok(await run(["crud", idea().id!, "--meta", "-"], dir, "schema:\n  additionalProperties: false\n"));
	assert.equal(versionOf(idea()), git(["log", "-1", "--format=%H"], dir), "a schema edit makes a new one");
	assert.notEqual(versionOf(idea()), first);
});

test("a version is published only when it is on the owner's origin trunk or a work branch a feat names for it", async () => {
	const dir = await heroWithIdea("find-kind-published");
	const hero = findBridge(dir)!;
	const idea = () => findKind("idea", findBridge(dir)!, [core])!;
	assert.throws(() => assertPublished(idea(), hero), /the schema of kind idea is not on its owner's origin trunk or a feat's work branch: land or push it first/);
	const origin = tempDir("find-kind-origin");
	git(["init", "-q", "--bare", "-b", "main"], origin);
	git(["remote", "add", "origin", origin], dir);
	git(["push", "-q", "origin", "main"], dir);
	assert.equal(assertPublished(idea(), hero), versionOf(idea()));
	ok(await run(["crud", idea().id!, "--meta", "-"], dir, "schema:\n  additionalProperties: false\n"));
	assert.throws(() => assertPublished(idea(), hero), /land or push it first/, "the new schema is not pushed");
	assert.notEqual(git(["rev-parse", "HEAD"], dir), git(["rev-parse", "origin/main"], dir));
});

test("a build's published flag is trusted only when the owner's history is not here to ask", async () => {
	const dir = await heroWithIdea("find-kind-flag");
	const hero = findBridge(dir)!;
	const kind = findKind("idea", hero, [core])!;
	const claimed = { ...kind, version: versionOf(kind), published: true };
	assert.throws(() => assertPublished(claimed, hero), /land or push it first/, "with history, a version not on the trunk is refused though the build said published");
	assert.throws(() => assertPublished({ ...claimed, version: "f".repeat(40) }, hero), /land or push it first/, "so is one that history has never seen");
	for (const repoDir of [undefined, tempDir("find-kind-no-history")]) {
		assert.equal(assertPublished({ ...claimed, repoDir }, hero), claimed.version, "without history, the flag stands");
		assert.throws(() => assertPublished({ ...claimed, repoDir, published: false }, hero), /land or push it first/);
	}
});

test("core as a cape hands its named exports to the capes that import them", () => {
	assert.equal(core.named?.assertPublished, assertPublished);
	assert.equal(core.named?.digestOf, digestOf);
});

test("a scope entry's schema is the digest of the kind's schema, the build's when it recorded one", async () => {
	const dir = await heroWithIdea("find-kind-digest");
	const kind = findKind("idea", findBridge(dir)!, [core])!;
	assert.equal(digestOf(kind), schemaDigest({ type: "object", additionalProperties: true }));
	assert.equal(digestOf({ ...kind, digest: "0123456789ab" }), "0123456789ab");
});
