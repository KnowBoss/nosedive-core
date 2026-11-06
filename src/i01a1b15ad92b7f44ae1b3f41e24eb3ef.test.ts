// legacy-repo-meta
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1b15ad92b7f44ae1b3f41e24eb3ef as legacyRepoMeta } from "./i01a1b15ad92b7f44ae1b3f41e24eb3ef.ts";
import { tempDir } from "../test/harness.ts";

const out: string[] = [];
const ctx = { capes: [{ version: "9.9.9" }] as never[], out: (text: string) => void out.push(text) };

function repos(label: string, docs: Record<string, string>): string {
	const dir = tempDir(label);
	mkdirSync(join(dir, ".nosedive", "repos"), { recursive: true });
	for (const [id, meta] of Object.entries(docs)) writeFileSync(join(dir, ".nosedive", "repos", `${id}.md`), `---\nkind: repo\nid: ${id}\nname: ${id}\ngist: "A repo"\nmeta:\n${meta}---\n\n# ${id}\n`);
	return dir;
}

const read = (dir: string, id: string) => readFileSync(join(dir, ".nosedive", "repos", `${id}.md`), "utf8");

test("an scp-style cloud remote becomes an ssh origin, and default-branch becomes trunk", () => {
	const dir = repos("legacy-repo-meta", {
		a: `  path: workspace/a-dir\n  default-branch: master\n  remotes:\n    cloud: ablcode@vs-ssh.visualstudio.com:v3/ablcode/Team/a\n  url: https://example.com/a\n`,
	});
	assert.deepEqual(legacyRepoMeta(dir, ctx), [join(dir, ".nosedive", "repos", "a.md")]);
	assert.equal(
		read(dir, "a"),
		`---\nkind: repo\nid: a\nname: a\ngist: "A repo"\nmeta:\n  path: workspace/a-dir\n  remotes:\n    origin: ssh://ablcode@vs-ssh.visualstudio.com/v3/ablcode/Team/a\n  url: https://example.com/a\n  trunk: master\n---\n\n# a\n`,
	);
	assert.ok(out.includes("legacy-repo-meta: rewrote 1 repo doc to core's origin and trunk"));
	assert.deepEqual(legacyRepoMeta(dir, ctx), [], "running it again changes nothing");
});

test("a url remote moves as it is, base-branch is a trunk too, and a doc's own trunk and origin win", () => {
	const dir = repos("legacy-repo-meta-kept", {
		url: `  base-branch: develop\n  remotes:\n    cloud: https://github.com/x/url.git\n`,
		own: `  trunk: main\n  default-branch: master\n  remotes:\n    origin: https://github.com/x/own.git\n    cloud: git@github.com:x/other.git\n`,
		core: `  trunk: main\n  remotes:\n    origin: https://github.com/x/core.git\n`,
	});
	legacyRepoMeta(dir, ctx);
	assert.match(read(dir, "url"), /\n  remotes:\n    origin: https:\/\/github.com\/x\/url.git\n  trunk: develop\n---/);
	assert.match(read(dir, "own"), /\n  trunk: main\n  remotes:\n    origin: https:\/\/github.com\/x\/own.git\n    cloud: git@github.com:x\/other.git\n---/, "only default-branch goes");
	assert.equal(read(dir, "core"), `---\nkind: repo\nid: core\nname: core\ngist: "A repo"\nmeta:\n  trunk: main\n  remotes:\n    origin: https://github.com/x/core.git\n---\n\n# core\n`, "a doc in core's shape is left as it is");
});

test("a repo with no .nosedive/repos has nothing to rewrite", () => {
	assert.deepEqual(legacyRepoMeta(tempDir("legacy-repo-meta-none"), ctx), []);
});
