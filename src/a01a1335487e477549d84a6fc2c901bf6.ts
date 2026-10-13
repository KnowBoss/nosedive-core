import { join } from "node:path";
import type { CapeDoc } from "./main.ts";
import { a01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./a01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import { a01a133548178739398941123114401ad as usageId } from "./a01a133548178739398941123114401ad.ts";

export type CapeSource = {
	docs: Record<string, CapeDoc>;
	/** Each action's entrypoint: its doc id, export name and file. */
	entries: { id: string; name: string; file: string }[];
};

export function a01a1335487e477549d84a6fc2c901bf6(repoDir: string): CapeSource {
	const docs: Record<string, CapeDoc> = {};
	const entries: CapeSource["entries"] = [];
	for (const doc of listKbDocs(join(repoDir, "kb"))) {
		if (doc.fm.kind !== "action") continue;
		const id = String(doc.fm.id);
		const usages = Array.isArray(doc.fm.usages) ? doc.fm.usages.map(String) : [];
		docs[id] = {
			name: String(doc.fm.name ?? ""),
			gist: String(doc.fm.gist ?? ""),
			usages: usages.map((text) => ({ id: usageId(text, id), text })),
			text: doc.text,
			body: doc.body.trim(),
		};
		const name = `a${id.replace(/-/g, "")}`;
		entries.push({ id, name, file: join(repoDir, "src", `${name}.ts`) });
	}
	return { docs, entries };
}
