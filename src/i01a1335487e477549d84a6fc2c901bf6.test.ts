// describe-cape-source
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1335487e477549d84a6fc2c901bf6 as describeCapeSource, namedExports, schemaDigest } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { repoDir } from "../scripts/source-cape.mjs";
import { CANONICAL, git, gitRepo, ok, run, tempDir } from "../test/harness.ts";

const SCAF = "01a13354-7f5f-7c45-a3fb-2ac0e3a7678e";

test("describes this repo's actions, skipping docs of other kinds", () => {
	const { docs, entries } = describeCapeSource(repoDir);
	const scaf = docs[SCAF]!;
	assert.equal(scaf.name, "scaf");
	assert.deepEqual(scaf.usages[0], { id: "c984cd607bf9568d97eb5ffb0b7da854", text: "scaf [<quid>]" });
	assert.equal(scaf.top, true, "its parent is the backlog root, which is no action");
	assert.match(scaf.body, /^# Scaf\n/);
	assert.equal(docs["01a13354-7d34-72f3-ad11-9c44b4d5de6e"], undefined);
	assert.deepEqual(
		entries.find((entry) => entry.id === SCAF),
		{ id: SCAF, name: "i01a133547f5f7c45a3fb2ac0e3a7678e", file: join(repoDir, "src", "i01a133547f5f7c45a3fb2ac0e3a7678e.ts") },
	);
});

test("an action under another action is not top-level", () => {
	const dir = tempDir("describe-nested");
	mkdirSync(join(dir, "kb"));
	const parent = "01a1335b-f253-7b80-ab64-d2f9a03c9634";
	const child = "01a1335b-f30a-7dd2-a1d4-b675fd419238";
	writeFileSync(join(dir, "kb", `${parent}.md`), `---\nkind: action\nid: ${parent}\nname: tool\n${CANONICAL}---\n`);
	writeFileSync(
		join(dir, "kb", `${child}.md`),
		`---\nkind: action\nid: ${child}\nname: sub.tool\n${CANONICAL}links:\n  - kb/${parent}.md:\n      rel: parent.feat\n---\n`,
	);
	const { docs } = describeCapeSource(dir);
	assert.deepEqual([docs[parent]!.top, docs[child]!.top], [true, false]);
});

test("reads the kb its config names, and only code and kind docs whole", () => {
	const dir = tempDir("describe-configured-kb");
	mkdirSync(join(dir, ".nosedive"));
	mkdirSync(join(dir, "notes"));
	writeFileSync(join(dir, ".nosedive", "config.yaml"), "roots:\n  - notes/01a180ad-db95-70d2-b34d-add0b8f7ed41.md\n");
	writeFileSync(join(dir, "notes", `${SCAF}.md`), `---\nkind: action\nid: ${SCAF}\nname: scaf\nmeta:\n  usages:\n    - scaf\n${CANONICAL}---\n`);
	writeFileSync(join(dir, "notes", "memo.md"), "---\nkind: memo\nid: m\n---\n\nkind: action\n");
	const { docs, entries } = describeCapeSource(dir);
	assert.deepEqual(Object.keys(docs), [SCAF]);
	assert.equal(entries[0]!.file, join(dir, "src", "i01a133547f5f7c45a3fb2ac0e3a7678e.ts"));
});

test("reads the kinds a repo keeps in .nosedive/kinds/ as well as its kb's", () => {
	const dir = tempDir("describe-kinds-dir");
	mkdirSync(join(dir, ".nosedive", "kinds"), { recursive: true });
	mkdirSync(join(dir, "kb"));
	writeFileSync(join(dir, ".nosedive", "kinds", "01a175e2-0000-7000-8000-000000000001.md"), "---\nkind: kind\nid: 01a175e2-0000-7000-8000-000000000001\nname: idea\nmeta:\n  durable: false\n---\n");
	writeFileSync(join(dir, "kb", "01a175e2-0000-7000-8000-000000000002.md"), `---\nkind: kind\nid: 01a175e2-0000-7000-8000-000000000002\nname: goal\n${CANONICAL}---\n`);
	const { kinds } = describeCapeSource(dir);
	assert.deepEqual(Object.keys(kinds).sort(), ["goal", "idea"]);
	assert.equal((kinds.idea as { durable?: boolean }).durable, false);
});

test("counts a doc as an action only when its kind is core's: a canonical scope says so, and a repo's own kind of that name is another", async () => {
	const dir = gitRepo("describe-identity");
	ok(await run(["seed"], dir));
	const own = "01a18e62-0000-7000-8000-0000000000f1";
	const canonical = "01a18e62-0000-7000-8000-0000000000f2";
	const kb = join(dir, "kb");
	writeFileSync(join(kb, `${own}.md`), `---\nkind: action\nid: ${own}\nname: own\nmeta:\n  usages:\n    - own\n---\n`);
	writeFileSync(join(kb, `${canonical}.md`), `---\nkind: action\nid: ${canonical}\nname: canon\nmeta:\n  usages:\n    - canon\n${CANONICAL}---\n`);
	assert.deepEqual(Object.keys(describeCapeSource(dir).docs), [canonical]);
});

test("records each kind's version, the last commit that changed its schema and not its prose, when asked", async () => {
	const dir = gitRepo("describe-version");
	ok(await run(["seed"], dir));
	ok(await run(["crud", "core:kind", "An", "idea", "--name", "idea", "--meta", "-"], dir, "schema:\n  type: object\n  additionalProperties: true\n"));
	const versionOfIdea = () => (describeCapeSource(dir, false, true).kinds.idea as { version?: string }).version;
	const created = git(["rev-parse", "HEAD"], dir);
	assert.equal(versionOfIdea(), created);
	assert.equal((describeCapeSource(dir).kinds.idea as { version?: string }).version, undefined, "not unless asked");
	const published = () => (describeCapeSource(dir, false, true).kinds.idea as { published?: boolean }).published;
	assert.equal(published(), false, "no origin holds it");
	const origin = tempDir("describe-version-origin");
	git(["init", "-q", "--bare", "-b", "main"], origin);
	git(["remote", "add", "origin", origin], dir);
	git(["push", "-q", "origin", "main"], dir);
	assert.equal(published(), true, "recorded with it, whether it is on the trunk");
	const id = (describeCapeSource(dir).kinds.idea as { id: string }).id;
	ok(await run(["crud", id, "--body", "-"], dir, "Prose.\n"));
	ok(await run(["crud", id, "--gist", "Another gist"], dir));
	assert.equal(versionOfIdea(), created, "prose and gists are not the schema");
	ok(await run(["crud", id, "--meta", "-"], dir, "schema:\n  additionalProperties: false\n"));
	assert.equal(versionOfIdea(), git(["rev-parse", "HEAD"], dir));
	const file = join(dir, ".nosedive", "kinds", `${id}.md`);
	writeFileSync(file, readFileSync(file, "utf8").replace("additionalProperties: false", "additionalProperties: true"));
	assert.equal(versionOfIdea(), undefined, "a schema that is not committed has no version");
});

test("a schema's digest is 12 hex characters, the same for the same schema whatever the order of its keys", () => {
	const one = { type: "object", properties: { a: { type: "string" }, b: { enum: [1, 2] } }, required: ["a"] };
	const two = { required: ["a"], properties: { b: { enum: [1, 2] }, a: { type: "string" } }, type: "object" };
	assert.match(schemaDigest(one), /^[0-9a-f]{12}$/);
	assert.equal(schemaDigest(one), schemaDigest(two));
	assert.notEqual(schemaDigest(one), schemaDigest({ ...one, required: [] }));
	assert.notEqual(schemaDigest({ enum: [1, 2] }), schemaDigest({ enum: [2, 1] }), "an array's order is part of it");
	assert.equal(schemaDigest(undefined), schemaDigest(null), "a kind with no schema has one digest");
});

test("lists what each source file exports besides its default function", () => {
	const dir = tempDir("describe-named");
	mkdirSync(join(dir, "src"));
	const hex = "i01a1335487e477549d84a6fc2c901bf6";
	writeFileSync(join(dir, "src", `${hex}.ts`), `export type Shape = string;\nexport const LIMIT = 1;\nexport async function later() {}\nexport function ${hex}() {}\n`);
	writeFileSync(join(dir, "src", `${hex}.test.ts`), "export const hidden = 1;\n");
	writeFileSync(join(dir, "src", "plain.ts"), "const unexported = 1;\n");
	assert.deepEqual(namedExports(dir), [{ file: `${hex}.ts`, values: ["LIMIT", "later"], types: ["Shape"] }]);
	assert.ok(namedExports(repoDir).some((each) => each.values.includes("assertPublished") || each.values.includes("pinOf")));
});

test("records the digest of each kind's schema, with or without versions", async () => {
	const dir = gitRepo("describe-digest");
	ok(await run(["seed"], dir));
	ok(await run(["crud", "core:kind", "An", "idea", "--name", "idea", "--meta", "-"], dir, "schema:\n  type: object\n  additionalProperties: true\n"));
	const digest = schemaDigest({ type: "object", additionalProperties: true });
	assert.equal((describeCapeSource(dir).kinds.idea as { digest?: string }).digest, digest);
	assert.equal((describeCapeSource(dir, false, true).kinds.idea as { digest?: string }).digest, digest);
});
