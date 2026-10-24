import { dirname, relative } from "node:path";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a14717207d7277a493c7adb10ed32f as splitTitle } from "./i01a14717207d7277a493c7adb10ed32f.ts";

const LOCAL = /^(?:[^:]*\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.md)?$/;

type Doc = { fm: Record<string, unknown>; body: string; path?: string };

/** The root's body: its title, then its tree. */
export function i01a14a5504467ef08586b828ebabc148(kbDir: string, root: Doc): string {
	const groups = new Map<string, string[]>();
	for (const { id, rel } of linksOf(root)) {
		const group = /^(.+)\.feat$/.exec(rel)?.[1];
		if (!group || group === "parent") continue;
		groups.set(group, [...(groups.get(group) ?? []), id]);
	}
	// A root kept in the bridge, as a cape's kind file, links into the kb from where it is.
	const from = root.path ? relative(dirname(root.path), kbDir).replace(/\\/g, "/") : "";
	const prefix = from ? `${from}/` : "";
	const lines = [`# ${titleOf(root)}`];
	for (const group of [...groups.keys()].sort()) {
		lines.push("", `## ${group[0]!.toUpperCase()}${group.slice(1)}`, "");
		lines.push(...entries(kbDir, prefix, groups.get(group)!, [String(root.fm.id)], 0));
	}
	return `\n${lines.join("\n")}\n`;
}

function entries(kbDir: string, prefix: string, ids: string[], path: string[], depth: number): string[] {
	const docs = ids
		.filter((id) => !path.includes(id))
		.flatMap((id) => {
			const doc = findKbDoc(kbDir, id);
			return doc ? [{ id, doc, title: titleOf(doc) }] : [];
		})
		.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
	return docs.flatMap(({ id, doc, title }) => [
		`${"  ".repeat(depth)}- [${title}](${prefix}${id}.md): ${String(doc.fm.gist ?? "")}`,
		...entries(
			kbDir,
			prefix,
			linksOf(doc).filter(({ rel }) => rel === "child.feat").map(({ id: child }) => child),
			[...path, id],
			depth + 1,
		),
	]);
}

function linksOf(doc: Doc): { id: string; rel: string }[] {
	const links = Array.isArray(doc.fm.links) ? doc.fm.links : [];
	return links.flatMap((link) =>
		link && typeof link === "object"
			? Object.entries(link as Record<string, { rel?: unknown } | null>).flatMap(([target, value]) => {
					const id = LOCAL.exec(target)?.[1];
					return id && typeof value?.rel === "string" ? [{ id, rel: value.rel }] : [];
				})
			: [],
	);
}

function titleOf(doc: Doc): string {
	return splitTitle(doc.body)?.title ?? String(doc.fm.name ?? doc.fm.id);
}
