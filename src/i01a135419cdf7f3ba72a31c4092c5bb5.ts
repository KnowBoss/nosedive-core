import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335487e477549d84a6fc2c901bf6 as describeCapeSource, namedExports } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a133588c7971b5b116d9c8c1706e04 as capeIndex } from "./i01a133588c7971b5b116d9c8c1706e04.ts";

export async function i01a135419cdf7f3ba72a31c4092c5bb5(repoDir: string, id: string, name: string): Promise<Cape> {
	const source = describeCapeSource(repoDir);
	const { names, entries } = capeIndex(source, id);
	const index: Cape["index"] = { ...names };
	const present = Object.values(entries).filter((entry) => existsSync(entry.file));
	for (const [key, entry] of Object.entries(entries)) {
		if (existsSync(entry.file)) index[key] = (await import(pathToFileURL(entry.file).href))[entry.name];
	}
	const named: Record<string, unknown> = {};
	for (const { file, values } of namedExports(repoDir)) {
		if (values.length === 0) continue;
		const module = await import(pathToFileURL(join(repoDir, "src", file)).href);
		for (const value of values) named[value] = module[value];
	}
	// What a built cape's own file is: a module exporting its functions by id.
	const url = join(mkdtempSync(join(tmpdir(), "nosedive-source-")), "exports.mjs");
	writeFileSync(url, present.map((entry) => `export { ${entry.name} } from ${JSON.stringify(pathToFileURL(entry.file).href)};`).join("\n"));
	const root = findRoot(repoDir);
	const shortName = root ? String(root.fm.name) : undefined;
	return { id, owner: readRepoConfig(repoDir)?.id, name, shortName, repoDir, commit: "source", version: "source", docs: source.docs, index, kinds: source.kinds, named, url: pathToFileURL(url).href };
}
