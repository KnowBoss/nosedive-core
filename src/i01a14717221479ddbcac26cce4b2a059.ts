import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";

/** `update` may throw to refuse the change; an edit that refuses is never committed. */
export function i01a14717221479ddbcac26cce4b2a059(
	edit: KbEdit,
	id: string,
	update: (body: string, doc: { fm: Record<string, unknown> }) => string,
): void {
	const doc = edit.doc(id);
	doc.body = update(doc.body, doc);
	edit.change(doc);
}
