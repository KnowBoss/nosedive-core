// canonical-kinds
import assert from "node:assert/strict";
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "./i01a1335480c776ba8945020d0af333eb.ts";
import { MIGRATIONS } from "./i01a175dbf4517dafa3a9048ecd98ab84.ts";
import { schemaDigest } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { i01a1337c810a7456876b831d0c873396 as capeManifest } from "./i01a1337c810a7456876b831d0c873396.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { digestOf, versionOf } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { i01a18e8044c97daeb0498ee7ad07bf43 as canonicalKinds } from "./i01a18e8044c97daeb0498ee7ad07bf43.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { CANONICAL, CORE, git, gitRepo, greetCapeRepo, kbOf, ok, registerRepo, run, setCapes, tempBridge } from "../test/harness.ts";

const core: Cape = await sourceCape();
const OWNER = "01a18e8a-0000-7000-8000-000000000001";
const SCHEMA_COMMIT = "a".repeat(40);
const OBJECT_DIGEST = schemaDigest({ type: "object" });
const QUID = MIGRATIONS.find((migration) => migration.name === "canonical-kinds")!.id;

/** Runs the migration with core, collecting what it says. */
function migrate(dir: string): { changed: string[]; waiting: boolean; said: string[] } {
	const said: string[] = [];
	const changed = canonicalKinds(dir, { capes: [core], out: (text) => said.push(text) });
	return { changed: changed ?? [], waiting: changed === undefined, said };
}

/** Writes a doc as a legacy repo would have it: a kind and meta, no scopes unless given. */
function legacy(directory: string, kind: string, extra = ""): string {
	const id = mintUuid();
	writeFileSync(join(directory, `${id}.md`), `---\nkind: ${kind}\nid: ${id}\nname: ${kind}-${id.slice(-6)}\n${extra}---\n\n# ${kind}\n`);
	return id;
}

const read = (directory: string, id: string) => readFileSync(join(directory, `${id}.md`), "utf8");
const fmOf = (text: string) => parse(/^---\n([\s\S]*?)\n---/.exec(text)![1]!) as { kind: string; scopes?: Record<string, { canonical?: boolean; version?: string; schema?: string }>[]; meta?: Record<string, unknown> };
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

test("gives the docs of a name a worn cape declares that cape's entry, with the version its build recorded, and waits while a version is not published", async () => {
	const dir = await tempBridge("canonical-kinds-cape");
	const home = kbOf(dir);
	const repo = await registerRepo(dir, "task-cape");
	setCapes(dir, ["task-cape"]);
	const build = {
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
	};
	capeManifest(dir, build);
	const task = legacy(home, "task", "meta:\n  due: soon\n");
	const epic = legacy(home, "epic");
	const other = legacy(home, "wish");

	const before = [read(home, task), read(home, epic), read(home, other)];
	const waiting = migrate(dir);
	assert.equal(waiting.waiting, true, "epic's schema is not published");
	assert.match(waiting.said.join("\n"), /waiting for the schema of tasks:epic to be pushed/);
	assert.doesNotMatch(waiting.said.join("\n"), /tasks:task/);
	assert.deepEqual([read(home, task), read(home, epic), read(home, other)], before, "not even task is written");
	assert.equal(kindDocs(dir).length, 0, "nothing declared");

	capeManifest(dir, { ...build, id: "build-1b", kinds: { ...build.kinds, epic: { schema: { type: "object" }, version: "b".repeat(40), published: true } }, builtAt: "2026-10-30T01:00:00.000Z" });
	const { said, waiting: stillWaiting } = migrate(dir);
	assert.equal(stillWaiting, false);
	assert.deepEqual(fmOf(read(home, task)).scopes, [{ [OWNER]: { canonical: true, version: SCHEMA_COMMIT, schema: OBJECT_DIGEST } }]);
	assert.deepEqual(fmOf(read(home, epic)).scopes, [{ [OWNER]: { canonical: true, version: "b".repeat(40), schema: OBJECT_DIGEST } }]);
	assert.equal(fmOf(read(home, other)).scopes, undefined, "a name no cape declares is the repo's");
	assert.equal(kindDocs(dir).some((text) => /^name: task$/m.test(text) || /^name: epic$/m.test(text)), false, "no kind doc for a cape's name");
	assert.equal(kindDocs(dir).some((text) => /^name: wish$/m.test(text)), true);
	assert.match(said.join("\n"), /1 doc of task now name tasks/);
});

test("gives core's entry for a structural name even when a worn cape declares it, and says so", async () => {
	const dir = await tempBridge("canonical-kinds-clash");
	const home = kbOf(dir);
	const repo = await registerRepo(dir, "clash-cape");
	setCapes(dir, ["clash-cape"]);
	capeManifest(dir, {
		id: "build-3",
		owner: OWNER,
		shortName: "clash",
		repo,
		ref: "",
		commit: SCHEMA_COMMIT,
		core: core.id,
		coreVersion: core.version,
		actions: {},
		kinds: { cape: { schema: { type: "object" }, version: SCHEMA_COMMIT, published: true } },
		needs: {},
		version: "1",
		builtAt: "2026-10-30T00:00:00.000Z",
	});
	const doc = legacy(home, "cape");
	const { said } = migrate(dir);
	const kind = { ...(core.kinds.cape as object), name: "cape", owner: CORE, repoDir: core.repoDir };
	assert.deepEqual(fmOf(read(home, doc)).scopes, [{ [CORE]: { canonical: true, version: versionOf(kind), schema: digestOf(kind) } }]);
	assert.match(said.join("\n"), /clash declares cape, which is core's, so core's entry was given/);
	assert.equal(kindDocs(dir).some((text) => /^name: cape$/m.test(text)), false);
});

test("waits, writing nothing, while a worn cape has no build here or a build that records no kinds, and runs once it has", async () => {
	const dir = await tempBridge("canonical-kinds-waits");
	const home = kbOf(dir);
	const repo = await registerRepo(dir, "late-cape");
	setCapes(dir, ["late-cape"]);
	const gizmo = legacy(home, "gizmo");
	const feat = legacy(home, "feat");
	const before = [read(home, gizmo), read(home, feat)];
	const build = { id: "build-2", repo, ref: "", commit: SCHEMA_COMMIT, core: core.id, coreVersion: core.version, actions: {}, needs: {}, version: "1", builtAt: "2026-10-30T00:00:00.000Z" };

	const unbuilt = migrate(dir);
	assert.equal(unbuilt.waiting, true);
	assert.match(unbuilt.said.join("\n"), /waiting for late-cape to build/);
	capeManifest(dir, build);
	assert.equal(migrate(dir).waiting, true, "a build from before kinds are recorded does not do");
	assert.deepEqual([read(home, gizmo), read(home, feat)], before);
	assert.equal(kindDocs(dir).length, 0, "nothing declared");

	capeManifest(dir, { ...build, owner: OWNER, kinds: { gizmo: { schema: { type: "object" }, version: SCHEMA_COMMIT, published: true } } });
	assert.equal(migrate(dir).waiting, false);
	assert.deepEqual(fmOf(read(home, gizmo)).scopes, [{ [OWNER]: { canonical: true, version: SCHEMA_COMMIT, schema: OBJECT_DIGEST } }]);
	assert.equal(kindDocs(dir).filter((text) => /^name: feat$/m.test(text)).length, 1);
});

test("seed leaves it unrecorded until the capes it needs are built, then runs it in the same seed with the cape's entries", async () => {
	const dir = await tempBridge("canonical-kinds-seed-waits");
	const home = kbOf(dir);
	const repo = greetCapeRepo();
	const owner = readRepoConfig(repo)!.id!;
	writeFileSync(join(repo, "kb", `${mintUuid()}.md`), `---\nkind: kind\nid: ${mintUuid()}\nname: gizmo\ngist: "A gizmo"\nmeta:\n  schema:\n    type: object\n    additionalProperties: true\n${CANONICAL}---\n\n# Gizmo\n`);
	git(["add", "-A"], repo);
	git(["commit", "-qm", "a gizmo kind"], repo);
	await registerRepo(dir, "greet-cape", repo);
	setCapes(dir, ["greet-cape"]);
	const gizmo = legacy(home, "gizmo");
	const config = join(dir, ".nosedive", "config.yaml");
	writeFileSync(config, readFileSync(config, "utf8").split("\n").filter((line) => !line.includes(QUID)).join("\n"));
	git(["add", "-A"], dir);
	git(["commit", "-qm", "forgot"], dir);

	const waiting = migrate(dir);
	assert.equal(waiting.waiting, true);
	assert.doesNotMatch(readFileSync(config, "utf8"), new RegExp(QUID));
	assert.equal(fmOf(read(home, gizmo)).scopes, undefined);

	const out = ok(await run(["seed"], dir));
	assert.ok(out.indexOf("built cape greet-cape") !== -1 && out.indexOf("built cape greet-cape") < out.indexOf("migrated "), out);
	assert.match(out, /migrated .+: canonical-kinds/);
	assert.equal(fmOf(read(home, gizmo)).scopes?.[0]?.[owner]?.canonical, true);
	assert.equal(kindDocs(dir).some((text) => /^name: gizmo$/m.test(text)), false);
	assert.match(readFileSync(config, "utf8"), new RegExp(QUID));
	assert.equal(git(["log", "--format=%s"], dir).split("\n").filter((subject) => subject === "migrate: canonical-kinds").length, 1);
});

test("gives the docs of a kind core's code reads core's entry, and declares memo in the repo like any other name", async () => {
	const dir = await tempBridge("canonical-kinds-core");
	const home = kbOf(dir);
	const fn = legacy(home, "function");
	const memo = legacy(home, "memo", "meta:\n  note: hi\n");
	const { said } = migrate(dir);
	const kind = { ...(core.kinds.function as object), name: "function", owner: CORE, repoDir: core.repoDir };
	const version = versionOf(kind);
	assert.deepEqual(fmOf(read(home, fn)).scopes, [{ [CORE]: { canonical: true, ...(version ? { version } : {}), schema: digestOf(kind) } }]);
	assert.equal(fmOf(read(home, memo)).scopes, undefined);
	const minted = kindDocs(dir).filter((text) => /^name: memo$/m.test(text));
	assert.equal(minted.length, 1);
	const declared = core.kinds.memo as { schema: unknown; durable?: boolean };
	assert.equal(declared.durable, true, "core's memo is durable");
	assert.deepEqual(fmOf(minted[0]!).meta, { schema: declared.schema, durable: true }, "copied from core, not open");
	assert.doesNotMatch(minted[0]!, /open schema/);
	assert.match(said.join("\n"), /declared kind memo here, as core declares it, for 1 doc/);
	assert.match(said.join("\n"), /1 doc of function now name core as its owner/);
});

test("turns a doc of kind root into base, with the version of base, and declares no kind root", async () => {
	const dir = await tempBridge("canonical-kinds-root");
	const home = kbOf(dir);
	const stale = legacy(home, "root", `scopes:\n  - ${CORE}:\n      canonical: true\n      version: ${SCHEMA_COMMIT}\n  - ${OWNER}:\n      work-branch: x\n`);
	const bare = legacy(addRoot(dir, "away"), "root");
	migrate(dir);
	const kind = { ...(core.kinds.base as object), name: "base", owner: CORE, repoDir: core.repoDir };
	const version = versionOf(kind);
	const entry = { [CORE]: { canonical: true, ...(version ? { version } : {}), schema: digestOf(kind) } };
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
