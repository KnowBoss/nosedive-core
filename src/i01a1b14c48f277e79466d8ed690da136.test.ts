// legacy-capes
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1b14c48f277e79466d8ed690da136 as legacyCapes, LEGACY_CAPES } from "./i01a1b14c48f277e79466d8ed690da136.ts";
import { i01a175dbf4517dafa3a9048ecd98ab84 as runMigrations } from "./i01a175dbf4517dafa3a9048ecd98ab84.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { wornCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import { git, gitRepo } from "../test/harness.ts";

const ROOT = "01a1b14c-0000-7000-8000-000000000001";
const OTHER = "01a1b14c-0000-7000-8000-000000000002";
const WORK = "01a15ba8-0bff-7ce3-83dc-e08af3633e26";
const LEGACY = "01a1b13e-111d-73de-8f7d-41b47af07703";

function legacy(label: string, rootLinks = "") {
	const dir = gitRepo(label);
	mkdirSync(join(dir, ".nosedive"));
	mkdirSync(join(dir, "kb"));
	writeFileSync(join(dir, ".nosedive", "config.yaml"), `compatibility-level: 2\nworkspace: ./workspace\nbacklog: ${ROOT}\nkb: ./kb\n`);
	writeFileSync(join(dir, "kb", `${ROOT}.md`), `---\nkind: memo\nid: ${ROOT}\nname: backlog\ngist: "Backlog"\n${rootLinks}---\n\n# Backlog\n`);
	writeFileSync(join(dir, "kb", `${OTHER}.md`), `---\nkind: memo\nid: ${OTHER}\nname: other\ngist: "Other"\n---\n\n# Other\n`);
	git(["add", "-A"], dir);
	git(["commit", "-qm", "start"], dir);
	return dir;
}

const out: string[] = [];
const ctx = { capes: [{ version: "9.9.9" }] as never[], out: (text: string) => void out.push(text) };

test("a legacy repo gets the legacy cape at the commit core names", () => {
	const dir = legacy("legacy-capes");
	const changed = legacyCapes(dir, ctx);
	assert.deepEqual(changed.sort(), [join(dir, "kb", `${LEGACY}.md`), join(dir, "kb", `${ROOT}.md`)].sort());
	assert.match(readFileSync(join(dir, "kb", `${LEGACY}.md`), "utf8"), /^---\nkind: repo\nid: [^\n]+\nname: nosedive-legacy\n[^]*origin: https:\/\/github.com\/KnowBoss\/nosedive-legacy.git\n/);
	const root = readFileSync(join(dir, "kb", `${ROOT}.md`), "utf8");
	for (const cape of LEGACY_CAPES) assert.ok(root.includes(`  - kb/${cape.id}.md:\n      rel: .cape\n      commit: ${cape.commit}\n`), `${cape.name} is worn at its pin`);
	assert.ok(out.some((line) => line.startsWith("legacy-capes: backlog wears nosedive-legacy at ")));
	assert.deepEqual(legacyCapes(dir, ctx), [], "running it again changes nothing");
});

test("a cape the backlog already links keeps its pin, and a repo doc already in .nosedive/repos is not written again", () => {
	const dir = legacy("legacy-capes-kept", `links:\n  - .nosedive/repos/${WORK}.md:\n      rel: .cape\n      commit: abc1111111111111111111111111111111111111\n`);
	mkdirSync(join(dir, ".nosedive", "repos"));
	writeFileSync(join(dir, ".nosedive", "repos", `${WORK}.md`), `---\nkind: repo\nid: ${WORK}\nname: nosedive-work\ngist: "Mine"\n---\n\n# nosedive-work\n`);
	legacyCapes(dir, ctx);
	assert.equal(existsSync(join(dir, "kb", `${WORK}.md`)), false);
	const root = readFileSync(join(dir, "kb", `${ROOT}.md`), "utf8");
	assert.ok(root.includes("commit: abc1111111111111111111111111111111111111"));
	assert.equal(root.split("rel: .cape").length - 1, 2, "only the legacy cape is added");
});

test("a repo that is not legacy's is left as it is", () => {
	const dir = gitRepo("legacy-capes-modern");
	mkdirSync(join(dir, ".nosedive"));
	writeFileSync(join(dir, ".nosedive", "config.yaml"), `id: ${ROOT}\nroots:\n  - kb/${ROOT}.md\n`);
	assert.deepEqual(legacyCapes(dir, ctx), []);
	assert.equal(existsSync(join(dir, "kb")), false);
});

test("after the whole chain, a legacy hero wears only legacy from .nosedive/repos", () => {
	const dir = legacy("legacy-capes-chain");
	runMigrations(dir, ctx);
	assert.equal(existsSync(join(dir, ".nosedive", "repos", `${LEGACY}.md`)), true, "baseline moved the repo docs");
	const worn = wornCapes(findBridge(dir)!);
	assert.deepEqual(
		worn.map(({ name, ref }) => ({ name, ref })),
		[{ name: "nosedive-legacy", ref: LEGACY_CAPES[0]!.commit }],
	);
});
