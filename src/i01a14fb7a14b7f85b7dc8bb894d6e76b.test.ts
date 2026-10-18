// bundle-cape
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./i01a1335480147d0686528aee80f8ee34.ts";
import { i01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { i01a14fb7a14b7f85b7dc8bb894d6e76b as bundleCape } from "./i01a14fb7a14b7f85b7dc8bb894d6e76b.ts";
import { tempDir } from "../test/harness.ts";

const FN = "01a14fba-1f87-7c38-9b88-a0961c31ea77";
const BUNDLE = "01a14fba-ec49-7d5c-8b14-033dbddfd827";
const CORE = "01a14fba-ec4a-7f33-afc7-44b93284d8f1";
const HEX = FN.replace(/-/g, "");

test("bundles a source into one module of its exports, docs and index, its core imports read from the loaded core, and leaves no build files", async () => {
	const dir = tempDir("bundle-cape");
	for (const sub of ["kb", "src"]) mkdirSync(join(dir, sub));
	writeFileSync(join(dir, "kb", `${FN}.md`), `---\nkind: function\nid: ${FN}\nname: twice\n---\n`);
	writeFileSync(join(dir, "src", `i${HEX}.ts`), `import { i0 as core } from "nosedive-core";\n\nexport function i${HEX}(text: string): string {\n\treturn core(text) + core(text);\n}\n`);
	const outfile = join(dir, "out", "bundle.js");
	const exports = { id: BUNDLE, name: "twice-cape", commit: "", version: "v", core: CORE, needs: {} };
	await bundleCape(describeCapeSource(dir), exports, [{ specifier: "nosedive-core", capeId: CORE, ids: ["0"] }], outfile);
	assert.equal(existsSync(`${outfile}.build`), false);

	(globalThis as { __nosediveCore?: unknown }).__nosediveCore = { id: CORE, index: { [namespacedUuid("0", CORE)]: (text: string) => text.toUpperCase() } };
	const bundle = await import(pathToFileURL(outfile).href);
	assert.equal(bundle.name, "twice-cape");
	assert.equal(bundle.docs[FN].name, "twice");
	assert.equal(bundle.index[namespacedUuid(FN, exports.id)]("ab"), "ABAB");
});
