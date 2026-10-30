// canonical-kinds
import assert from "node:assert/strict";
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "./i01a1335480c776ba8945020d0af333eb.ts";
import { MIGRATIONS } from "./i01a175dbf4517dafa3a9048ecd98ab84.ts";
import { i01a1337c810a7456876b831d0c873396 as capeManifest } from "./i01a1337c810a7456876b831d0c873396.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { versionOf } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { i01a18e8044c97daeb0498ee7ad07bf43 as canonicalKinds } from "./i01a18e8044c97daeb0498ee7ad07bf43.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { CORE, git, gitRepo, kbOf, ok, registerRepo, run, setCapes, tempBridge } from "../test/harness.ts";

const core: Cape = await sourceCape();
const OWNER = "01a18e8a-0000-7000-8000-000000000001";
const SCHEMA_COMMIT = "a".repeat(40);
const QUID = MIGRATIONS.at(-1)!.id;

/** Runs the migration with core, collecting what it says. */
function migrate(dir: string): { changed: string[]; said: string[] } {
	const said: string[] = [];
	return { changed: canonicalKinds(dir, { capes: [core], out: (text) => said.push(text) }), said };
}

/** Writes a doc as a legacy repo would have it: a kind and meta, no scopes unless given. */
function legacy(directory: string, kind: string, extra = ""): string {
	const id = mintUuid();
	writeFileSync(join(directory, `${id}.md`), `---\nkind: ${kind}\nid: ${id}\nname: ${kind}-${id.slice(-6)}\n${extra}---\n\n# ${kind}\n`);
	return id;
}

const read = (directory: string, id: string) => readFileSync(join(directory, `${id}.md`), "utf8");
const fmOf = (text: string) => parse(/^---\n([\s\S]*?)\n---/.exec(text)![1]!) as { kind: string; scopes?: Record<string, { canonical?: boolean; version?: string }>[]; meta?: Record<string, unknown> };
const kindDocs = (dir: string) => (existsSync(join(dir, ".nosedive", "kinds")) ? readdirSync(join(dir, ".nosedive", "kinds")) : []).map((file) => readFileSync(join(dir, ".nosedive", "kinds", file), "utf8"));

/** A second root of the repo, in its own directory. */
function addRoot(dir: string, path: string): string {
	const id = mintUuid();
	mkdirSync(join(dir, path), { recursive: true });
	writeFileSync(join(dir, path, `${id}.md`), `---\nkind: base\nid: ${id}\nname: away\n---\n\n# away\n`);
	appendFileSync(join(dir, ".nosedive", "config.yaml"), `  - ${path}/${id}.md\n`);
	return join(dir, path);
}

test("declares one open kind for a legacy name across all roots, listing the meta fields seen in either with a sample each", async () => {
	const dir = await tempBridge("canonical-kinds-legacy");
	const home = kbOf(dir);
	const away = addRoot(dir, "away");
	const one = legacy(home, "feat", "meta:\n  owner: dan\n");
	const two = legacy(away, "feat", "meta:\n  priority: 3\n  owner: ann\n");
	const before = [read(home, one), read(away, two)];
	const kinds = kindDocs(dir).length;

	const { changed, said } = migrate(dir);
	assert.deepEqual([read(home, one), read(away, two)], before, "its docs are not touched");
	const minted = kindDocs(dir).filter((text) => /^name: feat$/m.test(text));
	assert.equal(kindDocs(dir).length, kinds + 1, "one kind doc for both roots");
	assert.equal(minted.length, 1);
	const kind = fmOf(minted[0]!);
	assert.deepEqual(kind.meta, { schema: { type: "object" }, durable: false }, "open, and not durable");
	assert.match(minted[0]!, /Pilot: say what feat is for/);
	assert.match(minted[0]!, /^- `owner`: `"dan"`$/m, "the first sample seen");
	assert.match(minted[0]!, /^- `priority`: `3`$/m, "a field only the other root's doc has");
	assert.equal(changed.some((path) => path.includes(".nosedive")), true);
	assert.match(said.join("\n"), /declared kind feat here, open, for 2 docs/);

	// The kind is the repo's own now, so crud writes it.
	ok(await run(["crud", "feat", "a thing to do"], dir));
});

test("leaves the repo's own kinds, and docs that already carry a canonical entry, alone", async () => {
	const dir = await tempBridge("canonical-kinds-own");
	const home = kbOf(dir);
	ok(await run(["crud", "core:kind", "an idea", "--name", "idea", "--meta", "-"], dir, "schema:\n  type: object\n  additionalProperties: true\n"));
	const own = legacy(home, "idea");
	const owned = legacy(home, "function", `scopes:\n  - ${OWNER}:\n      canonical: true\n      version: ${SCHEMA_COMMIT}\n`);
	const before = [read(home, own), read(home, owned)];
	const kinds = kindDocs(dir).length;
	const { changed } = migrate(dir);
	assert.deepEqual([read(home, own), read(home, owned)], before);
	assert.equal(kindDocs(dir).length, kinds);
	assert.deepEqual(changed, []);
});

test("gives the docs of a name a worn cape declares that cape's entry, with the version its build recorded, and says when a version is not published", async () => {
	const dir = await tempBridge("canonical-kinds-cape");
	const home = kbOf(dir);
	const repo = await registerRepo(dir, "task-cape");
	await registerRepo(dir, "unbuilt-cape");
	setCapes(dir, ["task-cape", "unbuilt-cape"]);
	capeManifest(dir, {
		id: "build-1",
		owner: OWNER,
		shortName: "tasks",
		repo,
		ref: "",
		commit: SCHEMA_COMMIT,
		core: core.id,
		coreVersion: core.version,
		actions: {},
		kinds: { task: { schema: { type: "object" }, version: SCHEMA_COMMIT, published: true }, epic: { schema: { type: "object" }, version: "b".repeat(40), published: false } },
		needs: {},
		version: "1",
		builtAt: "2026-10-30T00:00:00.000Z",
	});
	const task = legacy(home, "task", "meta:\n  due: soon\n");
	const epic = legacy(home, "epic");
	const other = legacy(home, "wish");

	const { said } = migrate(dir);
	assert.deepEqual(fmOf(read(home, task)).scopes, [{ [OWNER]: { canonical: true, version: SCHEMA_COMMIT } }]);
	assert.deepEqual(fmOf(read(home, epic)).scopes, [{ [OWNER]: { canonical: true, version: "b".repeat(40) } }], "still written with the version it has");
	assert.equal(fmOf(read(home, other)).scopes, undefined, "a name no cape declares is the repo's");
	assert.equal(kindDocs(dir).some((text) => /^name: task$/m.test(text) || /^name: epic$/m.test(text)), false, "no kind doc for a cape's name");
	assert.equal(kindDocs(dir).some((text) => /^name: wish$/m.test(text)), true);
	assert.match(said.join("\n"), /the schema of tasks:epic is not published, so its entries carry the unpublished version bbbbbbb/);
	assert.match(said.join("\n"), /unbuilt-cape has no build here/);
});

test("gives the docs of a kind core's code reads core's entry, and declares memo in the repo like any other name", async () => {
	const dir = await tempBridge("canonical-kinds-core");
	const home = kbOf(dir);
	const fn = legacy(home, "function");
	const memo = legacy(home, "memo", "meta:\n  note: hi\n");
	const { said } = migrate(dir);
	const version = versionOf({ ...(core.kinds.function as object), name: "function", owner: CORE, repoDir: core.repoDir });
	assert.deepEqual(fmOf(read(home, fn)).scopes, [{ [CORE]: { canonical: true, ...(version ? { version } : {}) } }]);
	assert.equal(fmOf(read(home, memo)).scopes, undefined);
	assert.equal(kindDocs(dir).filter((text) => /^name: memo$/m.test(text)).length, 1);
	assert.match(said.join("\n"), /1 doc of function now name core as its owner/);
});

test("turns a doc of kind root into base, with the version of base, and declares no kind root", async () => {
	const dir = await tempBridge("canonical-kinds-root");
	const home = kbOf(dir);
	const stale = legacy(home, "root", `scopes:\n  - ${CORE}:\n      canonical: true\n      version: ${SCHEMA_COMMIT}\n  - ${OWNER}:\n      work-branch: x\n`);
	const bare = legacy(addRoot(dir, "away"), "root");
	migrate(dir);
	const version = versionOf({ ...(core.kinds.base as object), name: "base", owner: CORE, repoDir: core.repoDir });
	const entry = { [CORE]: { canonical: true, ...(version ? { version } : {}) } };
	assert.equal(fmOf(read(home, stale)).kind, "base");
	assert.deepEqual(fmOf(read(home, stale)).scopes, [{ [OWNER]: { "work-branch": "x" } }, entry], "another scope entry is kept");
	assert.equal(fmOf(read(join(dir, "away"), bare)).kind, "base");
	assert.deepEqual(fmOf(read(join(dir, "away"), bare)).scopes, [entry]);
	assert.equal(kindDocs(dir).some((text) => /^name: root$/m.test(text)), false);
});

test("skips docs in .nosedive, which are core's by place, and docs of kind kind or repo", async () => {
	const dir = await tempBridge("canonical-kinds-place");
	const repo = await registerRepo(dir, "a-repo");
	const stray = legacy(kbOf(dir), "kind");
	const before = [readFileSync(join(dir, ".nosedive", "repos", `${repo}.md`), "utf8"), read(kbOf(dir), stray)];
	const kinds = kindDocs(dir);
	const { changed } = migrate(dir);
	assert.deepEqual([readFileSync(join(dir, ".nosedive", "repos", `${repo}.md`), "utf8"), read(kbOf(dir), stray)], before);
	assert.deepEqual(kindDocs(dir), kinds);
	assert.deepEqual(changed, []);
});

test("changes nothing in core's own repo, whose kinds it declares itself", () => {
	const dir = gitRepo("canonical-kinds-core-repo");
	const source = join(import.meta.dirname, "..");
	cpSync(join(source, ".nosedive"), join(dir, ".nosedive"), { recursive: true, filter: (path) => !/[\\/]\.nosedive[\\/](cache|capes|local)/.test(path) });
	cpSync(join(source, "kb"), join(dir, "kb"), { recursive: true });
	assert.equal(readRepoConfig(dir)!.id, CORE);
	const { changed, said } = migrate(dir);
	assert.deepEqual(changed, []);
	assert.deepEqual(said, []);
});

test("changes nothing when it runs again, and is one commit when seed runs it", async () => {
	const dir = await tempBridge("canonical-kinds-again");
	const home = kbOf(dir);
	legacy(home, "feat", "meta:\n  a: 1\n");
	legacy(home, "action");
	legacy(home, "root");
	const first = migrate(dir);
	assert.notDeepEqual(first.changed, []);
	git(["add", "-A"], dir);
	git(["commit", "-qm", "migrated by hand"], dir);
	const again = migrate(dir);
	assert.deepEqual(again.changed, []);
	assert.equal(git(["status", "--porcelain"], dir), "");

	// Forgotten, it runs on a repo it already changed and still changes nothing; seed commits what it does change once.
	const config = join(dir, ".nosedive", "config.yaml");
	const listed = readFileSync(config, "utf8").split("\n").filter((line) => !line.includes(QUID));
	writeFileSync(config, listed.join("\n"));
	legacy(home, "bug");
	git(["add", "-A"], dir);
	git(["commit", "-qm", "forgot"], dir);
	const before = git(["rev-list", "--count", "HEAD"], dir);
	assert.match(ok(await run(["seed", "--no-capes"], dir)), /migrated .+: canonical-kinds/);
	assert.equal(Number(git(["rev-list", "--count", "HEAD"], dir)) - Number(before), 1);
	assert.equal(git(["log", "--format=%s", "-1"], dir), "migrate: canonical-kinds");
	assert.match(readFileSync(config, "utf8"), new RegExp(QUID));
	assert.equal(git(["status", "--porcelain"], dir), "");
});
