// legacy-fence
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { i01a1b3c3531177d3a3b89d851c6b456c as legacyFence } from "./i01a1b3c3531177d3a3b89d851c6b456c.ts";
import { tempDir } from "../test/harness.ts";

const out: string[] = [];
const ctx = { capes: [] as never[], out: (text: string) => void out.push(text) };

function hero(label: string, config: string): string {
	const dir = tempDir(label);
	mkdirSync(join(dir, ".nosedive"), { recursive: true });
	writeFileSync(join(dir, ".nosedive", "config.yaml"), config);
	return dir;
}

const read = (dir: string) => readFileSync(join(dir, ".nosedive", "config.yaml"), "utf8");

test("a legacy level is raised past legacy nosedive's, every other key kept where it was", () => {
	const dir = hero("legacy-fence", "compatibility-level: 2\nworkspace: ./workspace\nroots:\n  - kb/root.md\n");
	assert.deepEqual(legacyFence(dir, ctx), [join(dir, ".nosedive", "config.yaml")]);
	assert.equal(read(dir), "compatibility-level: 3\nworkspace: ./workspace\nroots:\n  - kb/root.md\n");
	assert.ok(out.includes("legacy-fence: compatibility-level 2 raised to 3, so legacy nosedive will not seed this hero"));
	assert.deepEqual(legacyFence(dir, ctx), [], "running it again changes nothing");
});

test("a config with no level, or one already past the fence, is left as it is", () => {
	for (const config of ["roots:\n  - kb/root.md\n", "compatibility-level: 4\n"]) {
		const dir = hero("legacy-fence-kept", config);
		assert.deepEqual(legacyFence(dir, ctx), []);
		assert.equal(read(dir), config);
	}
});
