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

test("runs the migrations after last-migration, each that changes something committed alone, then records the last", () => {
	const dir = gitRepo("run-migrations");
	mkdirSync(join(dir, ".nosedive"));
	const config = join(dir, ".nosedive", "config.yaml");
	writeFileSync(config, "id: x\n");
	git(["add", "-A"], dir);
	git(["commit", "-qm", "start"], dir);
	const ran: string[] = [];
	const chain = [
		{ id: A, name: "first", run: (at: string) => (ran.push("first"), writeFileSync(join(at, "a.txt"), "a\n"), [join(at, "a.txt")]) },
		{ id: B, name: "second", run: () => (ran.push("second"), []) },
	];
	assert.deepEqual(runMigrations(dir, chain), ["first"], "only those that changed something");
	assert.deepEqual(ran, ["first", "second"]);
	assert.match(readFileSync(config, "utf8"), new RegExp(`^last-migration: ${B}$`, "m"));
	assert.deepEqual(git(["log", "--format=%s"], dir).split("\n").slice(0, 2), [`migrate: ${dir.split(/[\\/]/).at(-1)} at second`, "migrate: first"]);
	assert.equal(git(["status", "--porcelain"], dir), "");
	ran.length = 0;
	assert.deepEqual(runMigrations(dir, chain), []);
	assert.deepEqual(ran, [], "nothing after the last");
	writeFileSync(config, "last-migration: 01a175e0-0000-7000-8000-0000000000ff\n");
	assert.throws(() => runMigrations(dir, chain), /was migrated by a newer core, to 01a175e0-0000-7000-8000-0000000000ff/);
});

test("the chain in code is the chain the migration docs make: each names the one before it in meta.after", () => {
	const kb = join(import.meta.dirname, "..", "kb");
	const docs = readdirSync(kb)
		.map((file) => readKbDoc(readFileSync(join(kb, file), "utf8")).fm)
		.filter((fm) => fm.kind === "migration");
	const after = new Map(docs.map((fm) => [String(fm.id), (fm.meta as { after?: string } | undefined)?.after]));
	assert.equal(after.size, MIGRATIONS.length, "every migration doc is in the chain");
	MIGRATIONS.forEach((migration, at) => assert.equal(after.get(migration.id), at === 0 ? undefined : MIGRATIONS[at - 1]!.id, `${migration.name} follows its predecessor`));
});
