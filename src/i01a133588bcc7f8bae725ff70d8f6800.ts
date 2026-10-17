import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";

/** `update` may throw to refuse the change; an edit that refuses is never committed. */
export function i01a133588bcc7f8bae725ff70d8f6800(
	edit: KbEdit,
	id: string,
	field: string,
	update: (current: unknown, doc: { fm: Record<string, unknown>; kbDir: string }) => unknown,
): void {
	const doc = edit.doc(id);
	const next = update(doc.fm[field], doc);
	const empty = next === undefined || next === null || (typeof next === "object" && Object.keys(next).length === 0);
	if (empty) {
		doc.yaml.delete(field);
		delete doc.fm[field];
	} else {
		doc.yaml.set(field, next);
		doc.fm[field] = next;
	}
	edit.change(doc);
}
