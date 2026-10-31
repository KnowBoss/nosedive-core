import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { parse, parseDocument } from "yaml";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1928d0d6873538e60181957211490 as heroSelf } from "./i01a1928d0d6873538e60181957211490.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { digestOf, versionOf } from "./i01a147171f057d019118aaa1f269f5fd.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { sourceCape } from "../scripts/source-cape.mjs";
import { CORE, git, gitRepo, ok, run } from "../test/harness.ts";

const core: Cape = await sourceCape();
const MIGRATION = "01a1928d-0d68-7353-8e60-181957211490";
const PRIMARY = "01a1928d-0000-7000-8000-000000000001";
const AWAY = "01a1928d-0000-7000-8000-000000000002";
const OTHER = "01a1928d-0000-7000-8000-000000000003";

function oldRepo(folder: string, options: { workspace?: boolean; kind?: string; owner?: string } = {}) {
	const dir = gitRepo("hero-self-migration");
	mkdirSync(join(dir, ".nosedive"));
	const primary = `${folder}/${PRIMARY}.md`;
	const away = `away/${AWAY}.md`;
	for (const path of [primary, away]) mkdirSync(dirname(join(dir, path)), { recursive: true });
	writeFileSync(join(dir, primary), `---\nkind: ${options.kind ?? "base"}\nid: ${PRIMARY}\nname: old-hero\ngist: "Keep this"\nscopes:\n  - ${OTHER}:\n      work-branch: keep\n  - ${options.owner ?? CORE}:\n      canonical: true\n      version: old-version\n      schema: old-schema\nmeta: {}\nlinks:\n  - ${away}:\n      rel: knowledge.feat\n---\n\n# My old hero\n\nKeep this body.\n`);
	writeFileSync(join(dir, away), `---\nkind: base\nid: ${AWAY}\n---\n`);
	writeFileSync(join(dir, ".nosedive", "config.yaml"), `id: ${PRIMARY}\n${options.workspace === false ? "" : "workspace: ./workspace\n"}roots:\n  - ${away}\n  - ${primary}\n`);
	return { dir, primary: join(dir, primary), away: join(dir, away) };
}

test("migrates only the primary core base, preserving its configured path and all other content", () => {
	for (const folder of ["kb", "home", "custom/self"]) {
		const repo = oldRepo(folder);
		const before = readKbDoc(readFileSync(repo.primary, "utf8"));
		const config = readFileSync(join(repo.dir, ".nosedive", "config.yaml"), "utf8");
		const away = readFileSync(repo.away, "utf8");
		assert.deepEqual(heroSelf(repo.dir, { capes: [core], out() {} }), [repo.primary]);
		const after = readKbDoc(readFileSync(repo.primary, "utf8"));
		const kind = { ...(core.kinds.hero as object), name: "hero", owner: CORE, repoDir: core.repoDir };
		assert.equal(after.fm.kind, "hero");
		assert.deepEqual(after.fm.scopes, [{ [OTHER]: { "work-branch": "keep" } }, { [CORE]: { canonical: true, version: versionOf(kind), schema: digestOf(kind) } }]);
		for (const key of ["id", "name", "gist", "meta", "links"]) assert.deepEqual(after.fm[key], before.fm[key]);
		assert.equal(after.body, before.body);
		assert.equal(readFileSync(join(repo.dir, ".nosedive", "config.yaml"), "utf8"), config);
		assert.equal(readFileSync(repo.away, "utf8"), away);
		assert.deepEqual(heroSelf(repo.dir, { capes: [core], out() {} }), []);
	}
});

test("leaves data repos, cape roots, already hero roots, and another owner base untouched", () => {
	for (const options of [{ workspace: false }, { kind: "cape" }, { kind: "hero" }, { owner: "01a1928d-0000-7000-8000-000000000004" }]) {
		const repo = oldRepo("kb", options);
		const before = readFileSync(repo.primary, "utf8");
		assert.deepEqual(heroSelf(repo.dir, { capes: [core], out() {} }), []);
		assert.equal(readFileSync(repo.primary, "utf8"), before);
	}
});

test("waits without writes when the hero schema is not published", () => {
	const repo = oldRepo("home");
	const before = readFileSync(repo.primary, "utf8");
	const said: string[] = [];
	assert.equal(heroSelf(repo.dir, { capes: [{ ...core, kinds: { ...core.kinds, hero: {} } }], out: (text) => said.push(text) }), undefined);
	assert.match(said.join("\n"), /waiting.*hero.*published/);
	assert.equal(readFileSync(repo.primary, "utf8"), before);
});

test("seed records and commits the migration once while keeping an old hero directory", async () => {
	const dir = gitRepo("hero-self-seed");
	ok(await run(["seed"], dir));
	const configPath = join(dir, ".nosedive", "config.yaml");
	const config = parseDocument(readFileSync(configPath, "utf8"));
	config.set("workspace", "./workspace");
	config.set("migrations", (config.toJS() as { migrations: string[] }).migrations.filter((id) => id !== MIGRATION));
	writeFileSync(configPath, config.toString({ lineWidth: 0 }));
	git(["commit", "-qam", "old workspace hero"], dir);
	const root = (parse(readFileSync(configPath, "utf8")) as { roots: string[] }).roots[0]!;
	assert.match(ok(await run(["seed", "--no-capes"], dir)), /migrated .*: hero-self/);
	assert.equal(readKbDoc(readFileSync(join(dir, root), "utf8")).fm.kind, "hero");
	assert.match(root, /^kb\//);
	assert.equal((parse(readFileSync(configPath, "utf8")) as { migrations: string[] }).migrations.filter((id) => id === MIGRATION).length, 1);
	assert.doesNotMatch(ok(await run(["seed", "--no-capes"], dir)), /migrated/);
	assert.equal(git(["log", "--format=%s", "--grep", "^migrate: hero-self$"], dir).split("\n").length, 1);
});

test("an older data repo receiving pending migrations is promoted when the same seed enables its workspace", async () => {
	const dir = gitRepo("hero-self-old-data-promotion");
	ok(await run(["seed"], dir));
	const configPath = join(dir, ".nosedive", "config.yaml");
	const config = parseDocument(readFileSync(configPath, "utf8"));
	config.set("migrations", (config.toJS() as { migrations: string[] }).migrations.filter((id) => id !== MIGRATION));
	writeFileSync(configPath, config.toString({ lineWidth: 0 }));
	git(["commit", "-qam", "older data repo"], dir);
	ok(await run(["seed", "--workspace", "--no-capes"], dir));
	const final = parse(readFileSync(configPath, "utf8")) as { roots: string[]; migrations: string[] };
	assert.equal(readKbDoc(readFileSync(join(dir, final.roots[0]!), "utf8")).fm.kind, "hero");
	assert.match(final.roots[0]!, /^kb\//);
	assert.equal(final.migrations.filter((id) => id === MIGRATION).length, 1);
});
