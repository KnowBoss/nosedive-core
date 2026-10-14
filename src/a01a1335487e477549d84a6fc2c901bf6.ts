import { join } from "node:path";
import type { CapeDoc } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./a01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import { a01a133548178739398941123114401ad as usageId } from "./a01a133548178739398941123114401ad.ts";

export type CapeSource = {
	docs: Record<string, CapeDoc>;
	/** Each action's and gate's entrypoint: its doc id, export name and file. */
	entries: { id: string; name: string; file: string }[];
	/** Each kind the repo declares: its name, to its meta schema. */
	kinds: Record<string, unknown>;
};

const QUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

export function a01a1335487e477549d84a6fc2c901bf6(repoDir: string): CapeSource {
	const docs: Record<string, CapeDoc> = {};
	const entries: CapeSource["entries"] = [];
	const kinds: CapeSource["kinds"] = {};
	const parents = new Map<string, string[]>();
	for (const doc of listKbDocs(join(repoDir, "kb"))) {
		if (doc.fm.kind === "kind") kinds[String(doc.fm.name)] = (doc.fm.meta as { schema?: unknown } | undefined)?.schema;
		if (doc.fm.kind !== "action" && doc.fm.kind !== "gate") continue;
		const id = String(doc.fm.id);
		const meta = (doc.fm.meta ?? {}) as { usages?: unknown };
		const usages = doc.fm.kind === "action" && Array.isArray(meta.usages) ? meta.usages.map(String) : [];
		docs[id] = {
			kind: doc.fm.kind,
			name: String(doc.fm.name ?? ""),
			gist: String(doc.fm.gist ?? ""),
			usages: usages.map((text) => ({ id: usageId(text, id), text })),
			top: true,
			text: doc.text,
			body: doc.body.trim(),
		};
		parents.set(id, parentIds(doc.fm.links));
		const name = `a${id.replace(/-/g, "")}`;
		entries.push({ id, name, file: join(repoDir, "src", `${name}.ts`) });
	}
	// An action under another action is nested: reachable by name, not listed.
	for (const [id, ids] of parents) docs[id]!.top = !ids.some((parent) => parent in docs);
	return { docs, entries, kinds };
}

function parentIds(links: unknown): string[] {
	if (!Array.isArray(links)) return [];
	return links.flatMap((link) =>
		link && typeof link === "object"
			? Object.entries(link as Record<string, { rel?: unknown } | null>)
					.filter(([, value]) => value?.rel === "parent.feat")
					.flatMap(([target]) => QUID.exec(target) ?? [])
			: [],
	);
}
