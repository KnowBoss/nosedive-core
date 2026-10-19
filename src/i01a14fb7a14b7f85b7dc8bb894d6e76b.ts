import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./i01a1335480147d0686528aee80f8ee34.ts";
import type { CapeSource } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { i01a133588c7971b5b116d9c8c1706e04 as capeIndex } from "./i01a133588c7971b5b116d9c8c1706e04.ts";

const CORE = "nosedive-core";
const TEXT = new Set([".html", ".css", ".svg", ".md", ".txt"]);
// Packages written as CommonJS call require, which an ES module lacks.
const REQUIRE = 'import { createRequire as __nosediveRequire } from "node:module"; const require = __nosediveRequire(import.meta.url);';

/** What a bundle exports besides its docs, kinds and index. */
export type BundleExports = { id: string; name: string; commit: string; version: string; core: string; needs: Record<string, string> };
/** A bare specifier the source imports from: core, or a cape, by its build id, with the doc ids it may take. */
export type BundleSource = { specifier: string; capeId: string; ids: Iterable<string> };

/** `repoDir` is the repo the source is in, whose `node_modules` and `assets/` the bundle takes what the code imports from. */
export async function i01a14fb7a14b7f85b7dc8bb894d6e76b(repoDir: string, source: CapeSource, exports: BundleExports, sources: BundleSource[], outfile: string): Promise<void> {
	const { names, entries } = capeIndex(source, exports.id);
	const buildDir = `${outfile}.build`;
	rmSync(buildDir, { recursive: true, force: true });
	mkdirSync(buildDir, { recursive: true });
	const toEntry = (file: string) => `./${relative(buildDir, file).replace(/\\/g, "/")}`;
	writeFileSync(
		`${buildDir}/entry.ts`,
		[
			...Object.values(entries).map((entry) => `import { ${entry.name} } from ${JSON.stringify(toEntry(entry.file))};`),
			...Object.entries(exports).map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`),
			`export const docs = ${JSON.stringify(source.docs)};`,
			`export const kinds = ${JSON.stringify(source.kinds)};`,
			"export const index = {",
			...Object.entries(names).map(([key, docId]) => `\t${JSON.stringify(key)}: ${JSON.stringify(docId)},`),
			...Object.entries(entries).map(([key, entry]) => `\t${JSON.stringify(key)}: ${entry.name},`),
			"};",
			"",
		].join("\n"),
	);

	const esbuild = await import("esbuild").catch(() => {
		throw new Error("building capes needs esbuild: install it next to nosedive (`npm install esbuild`)");
	});
	const bySpecifier = new Map(sources.map((from) => [from.specifier, from]));
	const rebuild = `${exports.name} was built against other capes than these: run \`nosedive seed\``;
	const shim = ({ specifier, capeId: from, ids }: BundleSource) =>
		[
			specifier === CORE
				? "const from = globalThis.__nosediveCore;"
				: `const from = globalThis.__nosediveCapes?.[${JSON.stringify(from)}];`,
			`if (from?.id !== ${JSON.stringify(from)}) throw new Error(${JSON.stringify(rebuild)});`,
			...[...ids].map((docId) => `export const i${docId.replace(/-/g, "")} = from.index[${JSON.stringify(namespacedUuid(docId, from))}];`),
		].join("\n");
	try {
		await esbuild.build({
			entryPoints: [`${buildDir}/entry.ts`],
			bundle: true,
			platform: "node",
			format: "esm",
			target: "node24",
			outfile,
			logLevel: "warning",
			banner: { js: REQUIRE },
			plugins: [
				assets(esbuild, join(repoDir, "assets") + sep),
				{
					name: "nosedive-capes",
					setup(build) {
						build.onResolve({ filter: /^[^./]/ }, (args) => (bySpecifier.has(args.path) ? { path: args.path, namespace: "cape" } : undefined));
						build.onLoad({ filter: /.*/, namespace: "cape" }, (args) => ({ contents: shim(bySpecifier.get(args.path)!), loader: "js" }));
					},
				},
			],
		});
	} finally {
		rmSync(buildDir, { recursive: true, force: true });
	}
}

type Esbuild = typeof import("esbuild");

/** Imports a file under `assets/` as a string or bytes, and a `.client.ts` one as the text of its own browser bundle. */
function assets(esbuild: Esbuild, dir: string): import("esbuild").Plugin {
	return {
		name: "nosedive-assets",
		setup(build) {
			build.onLoad({ filter: /.*/, namespace: "file" }, async (args) => {
				if (!args.path.toLowerCase().startsWith(dir.toLowerCase())) return undefined;
				if (args.path.endsWith(".client.ts")) {
					const client = await esbuild.build({ entryPoints: [args.path], bundle: true, platform: "browser", format: "esm", target: "es2022", write: false, logLevel: "warning" });
					return { contents: client.outputFiles[0]!.text, loader: "text" };
				}
				const ext = args.path.slice(args.path.lastIndexOf(".")).toLowerCase();
				return { contents: await readFile(args.path), loader: TEXT.has(ext) ? "text" : "binary" };
			});
		},
	};
}
