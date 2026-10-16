import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./i01a1335480147d0686528aee80f8ee34.ts";
import type { CapeSource } from "./i01a1335487e477549d84a6fc2c901bf6.ts";

export type CapeIndex = {
	/** Action name key to doc id. */
	names: Record<string, string>;
	/** Doc id key to the entrypoint's export name and file. */
	entries: Record<string, { name: string; file: string }>;
};

export function i01a133588c7971b5b116d9c8c1706e04(source: CapeSource, capeId: string): CapeIndex {
	const index: CapeIndex = { names: {}, entries: {} };
	for (const entry of source.entries) {
		index.names[namespacedUuid(source.docs[entry.id]!.name, capeId)] = entry.id;
		index.entries[namespacedUuid(entry.id, capeId)] = { name: entry.name, file: entry.file };
	}
	return index;
}
