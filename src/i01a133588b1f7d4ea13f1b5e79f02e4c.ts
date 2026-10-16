import { i01a13354867d7a528cbad55b80708e50 as mergePatch } from "./i01a13354867d7a528cbad55b80708e50.ts";

export function i01a133588b1f7d4ea13f1b5e79f02e4c(list: unknown, patch: Record<string, unknown>): unknown[] {
	const entries = new Map<string, unknown>();
	for (const item of Array.isArray(list) ? list : []) {
		if (typeof item === "string") entries.set(item, null);
		else if (item && typeof item === "object") {
			for (const [key, value] of Object.entries(item)) entries.set(key, value);
		}
	}
	for (const [key, value] of Object.entries(patch)) {
		if (value === null) entries.delete(key);
		else entries.set(key, mergePatch(entries.get(key) ?? {}, value));
	}
	return [...entries].map(([key, value]) => ({ [key]: isEmpty(value) ? null : value }));
}

function isEmpty(value: unknown): boolean {
	return value === null || value === undefined || (typeof value === "object" && Object.keys(value).length === 0);
}
