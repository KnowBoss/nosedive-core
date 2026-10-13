// Loads a cape repo's actions straight from its source, for development and tests; the build bakes the same index in.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { a01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "../src/a01a1335480147d0686528aee80f8ee34.ts";
import { a01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "../src/a01a1335487e477549d84a6fc2c901bf6.ts";
import { a01a133588c7971b5b116d9c8c1706e04 as capeIndex } from "../src/a01a133588c7971b5b116d9c8c1706e04.ts";

export const repoDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function repoId(dir = repoDir) {
	const id = /^id:\s*(\S+)/m.exec(readFileSync(join(dir, ".nosedive-ref"), "utf8"))?.[1];
	if (!id) throw new Error(`${join(dir, ".nosedive-ref")} has no id`);
	return id;
}

export async function sourceCape(dir = repoDir) {
	const source = describeCapeSource(dir);
	const id = namespacedUuid("source", repoId(dir));
	const { names, entries } = capeIndex(source, id);
	const index = { ...names };
	for (const [key, entry] of Object.entries(entries)) {
		// A missing entrypoint is the check's to report, and scaf's to write.
		if (existsSync(entry.file)) index[key] = (await import(pathToFileURL(entry.file).href))[entry.name];
	}
	const { name } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
	return { id, name, commit: "source", version: "source", docs: source.docs, index };
}
