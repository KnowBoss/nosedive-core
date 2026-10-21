import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import { i01a1335480c776ba8945020d0af333eb as mintUuid } from "./i01a1335480c776ba8945020d0af333eb.ts";

export function i01a141f869c07c4da8288927a559c8ae(
	kbDir: string,
	doc: { kind: string; gist: string; id?: string; name?: string; meta?: Record<string, unknown>; title?: string },
): { id: string; name: string; path: string } {
	const id = doc.id ?? mintUuid();
	const name = doc.name ?? slugName(doc.gist, id);
	const path = join(kbDir, `${id}.md`);
	if (existsSync(path)) throw new Error(`${path} already exists`);
	const meta = doc.meta && Object.keys(doc.meta).length > 0 ? stringify({ meta: doc.meta }, { lineWidth: 0 }) : "";
	mkdirSync(kbDir, { recursive: true });
	// A JSON string is a valid YAML scalar, whatever the gist holds.
	writeFileSync(path, `---\nkind: ${doc.kind}\nid: ${id}\nname: ${name}\ngist: ${JSON.stringify(doc.gist)}\n${meta}---\n\n# ${doc.title ?? (doc.name ? titleOf(doc.name) : doc.gist)}\n`);
	return { id, name, path };
}

/** A name as a title: `build-ship` is `Build ship`. */
function titleOf(name: string): string {
	const words = name.replace(/-/g, " ");
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The gist's first words, slugged, then the id's last six characters so names stay unique. */
function slugName(gist: string, id: string): string {
	const words = gist
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.split(" ")
		.filter(Boolean)
		.slice(0, 6);
	return [...words, id.slice(-6)].join("-");
}
