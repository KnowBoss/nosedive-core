// bundle-cape
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./i01a1335480147d0686528aee80f8ee34.ts";
import { i01a133548178739398941123114401ad as usageId } from "./i01a133548178739398941123114401ad.ts";
import { i01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { i01a14fb7a14b7f85b7dc8bb894d6e76b as bundleCape } from "./i01a14fb7a14b7f85b7dc8bb894d6e76b.ts";
import { CANONICAL, tempDir } from "../test/harness.ts";

const FN = "01a14fba-1f87-7c38-9b88-a0961c31ea77";
const BUNDLE = "01a14fba-ec49-7d5c-8b14-033dbddfd827";
const CORE = "01a14fba-ec4a-7f33-afc7-44b93284d8f1";
const HEX = FN.replace(/-/g, "");

test("bundles a source into one module of its exports, docs and index, its core imports read from the loaded core, and leaves no build files", async () => {
	const dir = tempDir("bundle-cape");
	for (const sub of ["kb", "src"]) mkdirSync(join(dir, sub));
	writeFileSync(join(dir, "kb", `${FN}.md`), `---\nkind: function\nid: ${FN}\nname: twice\n${CANONICAL}---\n`);
	writeFileSync(join(dir, "src", `i${HEX}.ts`), `import { i0 as core } from "nosedive-core";\n\nexport function i${HEX}(text: string): string {\n\treturn core(text) + core(text);\n}\n`);
	const outfile = join(dir, "out", "bundle.js");
	const exports = { id: BUNDLE, name: "twice-cape", commit: "", version: "v", core: CORE, needs: {} };
	await bundleCape(dir, describeCapeSource(dir), exports, [{ specifier: "nosedive-core", capeId: CORE, ids: ["0"] }], outfile);
	assert.equal(existsSync(`${outfile}.build`), false);

	(globalThis as { __nosediveCore?: unknown }).__nosediveCore = { id: CORE, index: { [namespacedUuid("0", CORE)]: (text: string) => text.toUpperCase() } };
	const bundle = await import(pathToFileURL(outfile).href);
	assert.equal(bundle.name, "twice-cape");
	assert.equal(bundle.docs[FN].name, "twice");
	assert.equal(bundle.index[namespacedUuid(FN, exports.id)]("ab"), "ABAB");
});

test("a named import from core is read from the loaded core's named exports", async () => {
	const dir = tempDir("bundle-cape-named");
	for (const sub of ["kb", "src"]) mkdirSync(join(dir, sub));
	writeFileSync(join(dir, "kb", `${FN}.md`), `---\nkind: function\nid: ${FN}\nname: shout\n${CANONICAL}---\n`);
	writeFileSync(join(dir, "src", `i${HEX}.ts`), `import { shout, type Loud } from "nosedive-core";\n\nexport function i${HEX}(text: string): Loud {\n\treturn shout(text);\n}\n`);
	const outfile = join(dir, "out", "bundle.js");
	const exports = { id: BUNDLE, name: "shout-cape", commit: "", version: "v", core: CORE, needs: {} };
	await bundleCape(dir, describeCapeSource(dir), exports, [{ specifier: "nosedive-core", capeId: CORE, ids: [], names: ["shout"] }], outfile);

	(globalThis as { __nosediveCore?: unknown }).__nosediveCore = { id: CORE, index: {}, named: { shout: (text: string) => `${text}!` } };
	const bundle = await import(pathToFileURL(outfile).href);
	assert.equal(bundle.index[namespacedUuid(FN, exports.id)]("hey"), "hey!");
});

test("a bundle carries each usage's description, so it stays with the build when the source is gone", async () => {
	const dir = tempDir("bundle-cape-usage-block");
	for (const sub of ["kb", "src"]) mkdirSync(join(dir, sub));
	const usage = usageId("twice <text>", FN);
	writeFileSync(join(dir, "kb", `${FN}.md`), `---\nkind: action\nid: ${FN}\nname: twice\nmeta:\n  usages:\n    - twice <text>\n${CANONICAL}---\n`);
	writeFileSync(join(dir, "src", `i${HEX}.ts`), `import { i${usage} } from "./i${usage}.ts";\n\nexport async function i${HEX}() {\n\treturn i${usage}();\n}\n`);
	writeFileSync(join(dir, "src", `i${usage}.ts`), `/**\n * Says it twice.\n *\n * Whatever it is given.\n *\n * @param args The text.\n * @returns Nothing.\n * @nosedive-feat ${BUNDLE}\n */\nexport async function i${usage}() {\n\treturn 1;\n}\n`);
	const outfile = join(dir, "out", "bundle.js");
	const exports = { id: BUNDLE, name: "twice-cape", commit: "", version: "v", core: CORE, needs: {} };
	await bundleCape(dir, describeCapeSource(dir), exports, [], outfile);
	rmSync(join(dir, "src"), { recursive: true });
	rmSync(join(dir, "kb"), { recursive: true });

	const bundle = await import(pathToFileURL(outfile).href);
	assert.deepEqual(bundle.docs[FN].usages, [
		{
			id: usage,
			text: "twice <text>",
			description: { summary: "Says it twice.", body: "Whatever it is given.", params: [{ name: "args", text: "The text." }], returns: "Nothing.", attributes: [{ key: "feat", value: BUNDLE }] },
		},
	]);
});

test("the same source bundles to the same bytes from different directories, so a bundle names no path of where it was built", async () => {
	const built: string[] = [];
	for (const label of ["bundle-cape-same-a", "bundle-cape-same-b"]) {
		const dir = tempDir(label);
		for (const sub of ["kb", "src"]) mkdirSync(join(dir, sub), { recursive: true });
		writeFileSync(join(dir, "kb", `${FN}.md`), `---\nkind: function\nid: ${FN}\nname: twice\n${CANONICAL}---\n`);
		writeFileSync(join(dir, "src", `i${HEX}.ts`), `export function i${HEX}(text: string): string {\n\treturn text + text;\n}\n`);
		const outfile = join(dir, "out", "bundle.js");
		await bundleCape(dir, describeCapeSource(dir), { id: BUNDLE, name: "twice-cape", commit: "", version: "v", core: CORE, needs: {} }, [], outfile);
		built.push(readFileSync(outfile, "utf8"));
	}
	assert.equal(built[0], built[1]);
});
