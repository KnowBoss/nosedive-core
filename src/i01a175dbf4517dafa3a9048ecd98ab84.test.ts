// run-migrations
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a175dbf4517dafa3a9048ecd98ab84 as runMigrations, MIGRATIONS } from "./i01a175dbf4517dafa3a9048ecd98ab84.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { git, gitRepo } from "../test/harness.ts";

const A = "01a175e0-0000-7000-8000-00000000000a";
const B = "01a175e0-0000-7000-8000-00000000000b";
const NEWER = "01a175e0-0000-7000-8000-0000000000ff";
const ctx = { capes: [{ version: "9.9.9" }] as never[], out: () => {} };

/** A committed repo with a config, and a chain of two migrations of which `ran` records which ran: the first writes a file, the second nothing. */
function setup(label: string, config: string) {
	const dir = gitRepo(label);
	mkdirSync(join(dir, ".nosedive"));
	const configPath = join(dir, ".nosedive", "config.yaml");
	writeFileSync(configPath, config);
	git(["add", "-A"], dir);
	git(["commit", "-qm", "start"], dir);
	const ran: string[] = [];
	const chain = [
		{ id: A, name: "first", run: (at: string) => (ran.push("first"), writeFileSync(join(at, "a.txt"), "a\n"), [join(at, "a.txt")]) },
		{ id: B, name: "second", run: () => (ran.push("second"), []) },
	];
	return { dir, configPath, ran, chain };
}

test("runs the migrations the list lacks, each committed alone with its quid appended, whether or not it changed anything", () => {
	const { dir, configPath, ran, chain } = setup("run-migrations", "id: x\n");
	assert.deepEqual(runMigrations(dir, ctx, chain), ["first"], "only those that changed something");
	assert.deepEqual(ran, ["first", "second"]);
	assert.equal(readFileSync(configPath, "utf8"), `id: x\nmigrations:\n  - ${A}\n  - ${B}\n`);
	assert.deepEqual(git(["log", "--format=%s"], dir).split("\n").slice(0, 3), ["migrate: second", "migrate: first", "start"]);
	for (const rev of ["HEAD", "HEAD~1"]) {
		assert.equal(git(["log", "-1", "--format=%(trailers:only,unfold)", rev], dir), "Co-Authored-By: nosedive 9.9.9 <noreply@nosedive.dev>", "each migration's commit says nosedive made it, once");
	}
	assert.deepEqual(git(["show", "--name-only", "--format=", "HEAD~1"], dir).split("\n").sort(), [".nosedive/config.yaml", "a.txt"]);
	assert.deepEqual(git(["show", "--name-only", "--format=", "HEAD"], dir).split("\n"), [".nosedive/config.yaml"]);
	assert.equal(git(["status", "--porcelain"], dir), "");
	ran.length = 0;
	assert.deepEqual(runMigrations(dir, ctx, chain), []);
	assert.deepEqual(ran, [], "nothing the list lacks");
});

test("reads last-migration as having run that migration and every one before it, and swaps it for the list in the first commit", () => {
	const { dir, configPath, ran, chain } = setup("run-migrations-legacy", `id: x\nlast-migration: ${A}\n`);
	assert.deepEqual(runMigrations(dir, ctx, chain), []);
	assert.deepEqual(ran, ["second"], "the first had run");
	assert.equal(readFileSync(configPath, "utf8"), `id: x\nmigrations:\n  - ${A}\n  - ${B}\n`);
	assert.deepEqual(git(["log", "--format=%s"], dir).split("\n").slice(0, 2), ["migrate: second", "start"]);

	const alone = setup("run-migrations-legacy-alone", `id: x\nlast-migration: ${B}\n`);
	assert.deepEqual(runMigrations(alone.dir, ctx, alone.chain), []);
	assert.deepEqual(alone.ran, []);
	assert.equal(readFileSync(alone.configPath, "utf8"), `id: x\nmigrations:\n  - ${A}\n  - ${B}\n`);
	assert.match(git(["log", "--format=%s", "-1"], alone.dir), /^migrate: .+ lists its migrations$/);
});

test("runs a migration again once its quid is removed from the list", () => {
	const { dir, configPath, ran, chain } = setup("run-migrations-again", "id: x\n");
	runMigrations(dir, ctx, chain);
	ran.length = 0;
	writeFileSync(configPath, `id: x\nmigrations:\n  - ${A}\n`);
	git(["commit", "-qam", "forget the second"], dir);
	assert.deepEqual(runMigrations(dir, ctx, chain), []);
	assert.deepEqual(ran, ["second"]);
	assert.equal(readFileSync(configPath, "utf8"), `id: x\nmigrations:\n  - ${A}\n  - ${B}\n`);
});

test("refuses a quid core does not have, in the list or as last-migration, naming it", () => {
	const listed = setup("run-migrations-newer", `id: x\nmigrations:\n  - ${A}\n  - ${NEWER}\n`);
	assert.throws(() => runMigrations(listed.dir, ctx, listed.chain), new RegExp(`was migrated by a newer core, to ${NEWER}`));
	assert.deepEqual(listed.ran, []);
	const legacy = setup("run-migrations-newer-legacy", `last-migration: ${NEWER}\n`);
	assert.throws(() => runMigrations(legacy.dir, ctx, legacy.chain), new RegExp(`was migrated by a newer core, to ${NEWER}`));
});


test("the chain in code is the chain the migration docs make: each names the one before it in meta.after", () => {
	const kb = join(import.meta.dirname, "..", "kb");
	const docs = readdirSync(kb)
		.map((file) => readKbDoc(readFileSync(join(kb, file), "utf8")).fm)
		.filter((fm) => fm.kind === "migration");
	const after = new Map(docs.map((fm) => [String(fm.id), (fm.meta as { after?: string } | undefined)?.after]));
	assert.equal(after.size, MIGRATIONS.length, "every migration doc is in the chain");
	MIGRATIONS.forEach((migration, at) => assert.equal(after.get(migration.id), at === 0 ? undefined : MIGRATIONS[at - 1]!.id, `${migration.name} follows its predecessor`));
	const root = readFileSync(join(kb, "01a1336b-c0b8-7cde-b7c6-285196062297.md"), "utf8");
	for (const migration of MIGRATIONS) assert.match(root, new RegExp(`- kb/${migration.id}\\.md:\\n {6}rel: migrations\\.feat\\n`), `core's root lists ${migration.name}`);
});
