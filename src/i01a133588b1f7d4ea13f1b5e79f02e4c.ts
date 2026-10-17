import { i01a13354867d7a528cbad55b80708e50 as mergePatch } from "./i01a13354867d7a528cbad55b80708e50.ts";

/** Entries the patch does not name keep their written form; one it adds or changes is a `{ key: value }` entry. */
export function i01a133588b1f7d4ea13f1b5e79f02e4c(list: unknown, patch: Record<string, unknown>): unknown[] {
	const entries = new Map<string, { value: unknown; item: unknown }>();
	for (const item of Array.isArray(list) ? list : []) {
		if (typeof item === "string") entries.set(item, { value: null, item });
		else if (item && typeof item === "object") {
			for (const [key, value] of Object.entries(item)) entries.set(key, { value, item: { [key]: value } });
		}
	}
	for (const [key, value] of Object.entries(patch)) {
		if (value === null) entries.delete(key);
		else {
			const merged = mergePatch(entries.get(key)?.value ?? {}, value);
			entries.set(key, { value: merged, item: { [key]: merged ?? {} } });
		}
	}
	return [...entries.values()].map(({ item }) => item);
}
