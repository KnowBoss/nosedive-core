import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { Cape } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "./a01a1335487e477549d84a6fc2c901bf6.ts";
import { a01a133588c7971b5b116d9c8c1706e04 as capeIndex } from "./a01a133588c7971b5b116d9c8c1706e04.ts";

export async function a01a135419cdf7f3ba72a31c4092c5bb5(repoDir: string, id: string, name: string): Promise<Cape> {
	const source = describeCapeSource(repoDir);
	const { names, entries } = capeIndex(source, id);
	const index: Cape["index"] = { ...names };
	for (const [key, entry] of Object.entries(entries)) {
		if (existsSync(entry.file)) index[key] = (await import(pathToFileURL(entry.file).href))[entry.name];
	}
	return { id, name, commit: "source", version: "source", docs: source.docs, index, kinds: source.kinds };
}
