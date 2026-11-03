// Loads this repo's actions straight from its source, for development and tests; the build bakes the same index in.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "../src/i01a1335480147d0686528aee80f8ee34.ts";
import { i01a135419cdf7f3ba72a31c4092c5bb5 as loadSourceCape } from "../src/i01a135419cdf7f3ba72a31c4092c5bb5.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "../src/i01a13dee4b1d78f7a699c3777bf63587.ts";

export const repoDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The repo's seeded id, from its config, which namespaces the ids of its builds. */
export function repoId(dir = repoDir) {
	const id = readRepoConfig(dir)?.id;
	if (!id) throw new Error(`${join(dir, ".nosedive", "config.yaml")} has no id`);
	return id;
}

export async function sourceCape(dir = repoDir) {
	const { name } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
	return loadSourceCape(dir, namespacedUuid("source", repoId(dir)), name);
}
