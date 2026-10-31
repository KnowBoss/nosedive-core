// baseline
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a175dbf8d67926b24029e8caa38e94 as baseline } from "./i01a175dbf8d67926b24029e8caa38e94.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { tempDir } from "../test/harness.ts";

const ROOT = "01a175ca-d288-7c2e-be40-006f50fd720f";
const BRIDGE = "01a175ca-d2c3-71ab-9682-1de4ef512e47";
const KIND = "01a175ca-d2c3-71ab-9682-1de4ef512e48";
const MEMO = "01a175ca-d2c3-71ab-9682-1de4ef512e49";

function repo(label: string, config: string, docs: Record<string, string>): string {
	const dir = tempDir(label);
	mkdirSync(join(dir, ".nosedive"), { recursive: true });
	mkdirSync(join(dir, "kb"));
	writeFileSync(join(dir, ".nosedive", "config.yaml"), config);
	for (const [id, fm] of Object.entries(docs)) writeFileSync(join(dir, "kb", `${id}.md`), `---\nid: ${id}\n${fm}---\n\n# ${id}\n`);
	return dir;
}

test("takes legacy nosedive's config to one that lists its root, keeping its other keys, and moves kinds and repos into .nosedive/", () => {
	const dir = repo(
		"baseline-legacy",
		`compatibility-level: 2\nworkspace: ./workspace\nbacklog: ${ROOT}\nkb: ./kb\nbridge: ${BRIDGE}\nwork-branch-prefix: work/\n`,
		{
			[ROOT]: `kind: memo\nname: backlog.legacy\ngist: "Current backlog"\n`,
			[BRIDGE]: `kind: repo\nname: legacy\nmeta:\n  path: "workspace/__self"\n`,
			[KIND]: `kind: kind\nname: idea\nmeta:\n  schema:\n    type: object\n`,
			[MEMO]: `kind: memo\nname: kept\n`,
		},
	);
	const changed = baseline(dir);
	assert.ok(changed.length > 0);
	assert.equal(
		readFileSync(join(dir, ".nosedive", "config.yaml"), "utf8"),
		`compatibility-level: 2\nworkspace: ./workspace\nbridge: ${BRIDGE}\nwork-branch-prefix: work/\nid: ${ROOT}\nroots:\n  - kb/${ROOT}.md\n`,
	);
	assert.match(readFileSync(join(dir, "kb", `${ROOT}.md`), "utf8"), /^---\nkind: base\nid: [^\n]+\nname: backlog\.legacy\n/, "a memo root becomes a base");
	assert.equal(existsSync(join(dir, ".nosedive", "repos", `${BRIDGE}.md`)), true);
	assert.equal(existsSync(join(dir, ".nosedive", "kinds", `${KIND}.md`)), true);
	assert.equal(existsSync(join(dir, "kb", `${KIND}.md`)), false);
	assert.equal(existsSync(join(dir, "kb", `${MEMO}.md`)), true, "other docs stay");
	const bridge = readRepoConfig(dir)!;
	assert.equal(bridge.id, ROOT, "the root's id, so home copies keep their names");
	assert.equal(bridge.workspace, join(dir, "workspace"));
	assert.deepEqual(baseline(dir), [], "a config listing roots is left as it is");
});

test("keeps a cape root's kind, and takes the workspace from an existing ./workspace when config names none", () => {
	const cape = repo("baseline-cape", `kb: ./kb\nbacklog: ${ROOT}\n`, { [ROOT]: `kind: cape\nname: a-cape\n` });
	baseline(cape);
	assert.equal(readFileSync(join(cape, ".nosedive", "config.yaml"), "utf8"), `id: ${ROOT}\nroots:\n  - kb/${ROOT}.md\n`);
	assert.match(readFileSync(join(cape, "kb", `${ROOT}.md`), "utf8"), /\nkind: cape\n/);

	const base = repo("baseline-base", `kb: ./kb\nbacklog: ${ROOT}\n`, { [ROOT]: `kind: base\nname: mi\nmeta:\n  workspace: ./workspace\n` });
	mkdirSync(join(base, "workspace"));
	baseline(base);
	assert.equal(readRepoConfig(base)!.workspace, join(base, "workspace"));
	assert.doesNotMatch(readFileSync(join(base, "kb", `${ROOT}.md`), "utf8"), /meta:/, "the root kind declares no meta");
	assert.throws(() => baseline(repo("baseline-none", "kb: ./kb\n", {})), /names no backlog/);
});
