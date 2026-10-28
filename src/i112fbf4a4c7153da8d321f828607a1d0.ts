import { relative } from "node:path";
import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a133588b1f7d4ea13f1b5e79f02e4c as mergeKeyedEntries } from "./i01a133588b1f7d4ea13f1b5e79f02e4c.ts";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";

const LOCAL = /^(?:[^:]*\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.md)?$/;

export function i112fbf4a4c7153da8d321f828607a1d0(edit: KbEdit, quid: string, parent: string): void {
	if (parent === quid) throw new Error(`${quid} cannot be its own parent`);
	const child = edit.doc(quid);
	const target = edit.doc(parent);
	if (target.kbDir !== child.kbDir) throw new Error(`${parent} is in another kb than ${quid}, and links stay in one kb`);
	const seen = new Set<string>();
	for (let above: string | undefined = parent; above && !seen.has(above) && locate(edit, above); above = parentsOf(edit, above)[0]?.id) {
		if (above === quid) throw new Error(`${parent} is under ${quid}, so it cannot be its parent`);
		seen.add(above);
	}

	for (const old of parentsOf(edit, quid).filter(({ id }) => id !== parent)) {
		updateKbDocField(edit, quid, "links", (links) => mergeKeyedEntries(links, { [old.key]: null }));
		if (!locate(edit, old.id)) continue;
		const back = linksOf(edit, old.id).filter(({ id, rel }) => id === quid && rel === "child.feat");
		for (const { key } of back) updateKbDocField(edit, old.id, "links", (links) => mergeKeyedEntries(links, { [key]: null }));
	}
	if (!linksOf(edit, quid).some(({ id, rel }) => id === parent && rel === "parent.feat")) {
		const key = linksOf(edit, quid).find(({ id }) => id === parent)?.key ?? keyOf(target);
		updateKbDocField(edit, quid, "links", (links) => mergeKeyedEntries(links, { [key]: { rel: "parent.feat" } }));
	}
	if (!linksOf(edit, parent).some(({ id, rel }) => id === quid && rel === "child.feat")) {
		const key = linksOf(edit, parent).find(({ id }) => id === quid)?.key ?? keyOf(child);
		updateKbDocField(edit, parent, "links", (links) => mergeKeyedEntries(links, { [key]: { rel: "child.feat" } }));
	}
}

/** A link's key: the doc's path from the root of its repo, as bridge/<id>.md in a hero repo. */
function keyOf(doc: { path: string; repoDir: string }): string {
	return relative(doc.repoDir, doc.path).replace(/\\/g, "/");
}

function linksOf(edit: KbEdit, id: string): { key: string; id: string | undefined; rel: unknown }[] {
	const links = edit.doc(id).fm.links;
	return (Array.isArray(links) ? links : []).flatMap((item) =>
		item && typeof item === "object"
			? Object.entries(item as Record<string, unknown>).map(([key, value]) => ({ key, id: LOCAL.exec(key)?.[1], rel: (value as { rel?: unknown } | null)?.rel }))
			: [],
	);
}

function parentsOf(edit: KbEdit, id: string): { key: string; id: string }[] {
	return linksOf(edit, id).flatMap(({ key, id: target, rel }) => (target && rel === "parent.feat" ? [{ key, id: target }] : []));
}

/** A parent that is gone, or that crud may not edit, only loses the link to it. */
function locate(edit: KbEdit, id: string): boolean {
	try {
		edit.doc(id);
		return true;
	} catch {
		return false;
	}
}
