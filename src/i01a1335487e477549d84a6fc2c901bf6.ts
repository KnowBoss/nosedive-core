import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CapeDoc } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a14fdf275b70b48f86f7f5c651719d as kbDocKind } from "./i01a14fdf275b70b48f86f7f5c651719d.ts";
import { i01a133548178739398941123114401ad as usageId } from "./i01a133548178739398941123114401ad.ts";

export type CapeSource = {
	docs: Record<string, CapeDoc>;
	/** Each action's and function's entrypoint: its doc id, export name and file. */
	entries: { id: string; name: string; file: string }[];
	/** Each kind the repo declares: its name, to its declaration's meta (schema, durable) and links. */
	kinds: Record<string, unknown>;
};

const READ = new Set(["action", "function", "kind"]);
const QUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/** `fromSrc` reads only the docs whose ids name files in `src/`, never the rest of the kb: a doc with no code yet is left out. */
export function i01a1335487e477549d84a6fc2c901bf6(repoDir: string, fromSrc = false): CapeSource {
	const docs: Record<string, CapeDoc> = {};
	const entries: CapeSource["entries"] = [];
	const kinds: CapeSource["kinds"] = {};
	const parents = new Map<string, string[]>();
	const kbDir = readRepoConfig(repoDir)?.kbDir ?? join(repoDir, "kb");
	for (const doc of codeDocs(kbDir, fromSrc ? srcDocFiles(repoDir) : undefined)) {
		if (doc.fm.kind === "kind") kinds[String(doc.fm.name)] = { ...((doc.fm.meta ?? {}) as object), links: doc.fm.links ?? [] };
		if (doc.fm.kind !== "action" && doc.fm.kind !== "function") continue;
		const id = String(doc.fm.id);
		const meta = (doc.fm.meta ?? {}) as { usages?: unknown };
		const usages = Array.isArray(meta.usages) ? meta.usages.map(String) : [];
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
		const name = `i${id.replace(/-/g, "")}`;
		entries.push({ id, name, file: join(repoDir, "src", `${name}.ts`) });
	}
	// An action under another action is nested: reachable by name, not listed.
	for (const [id, ids] of parents) docs[id]!.top = !ids.some((parent) => parent in docs);
	return { docs, entries, kinds };
}

/** The doc files `src/` names: one per code file named by an id, which a usage's file, named by a hash, never matches. */
function srcDocFiles(repoDir: string): string[] {
	const src = join(repoDir, "src");
	if (!existsSync(src)) return [];
	return readdirSync(src).flatMap((file) => {
		const hex = /^i([0-9a-f]{32})\.ts$/.exec(file)?.[1];
		return hex ? [`${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}.md`] : [];
	});
}

/** The kb's actions, functions and kinds, read whole; every other doc is read only as far as its kind. */
function codeDocs(kbDir: string, files?: string[]) {
	return (files ?? readdirSync(kbDir))
		.filter((file) => file.endsWith(".md") && (!files || existsSync(join(kbDir, file))))
		.sort()
		.flatMap((file) => {
			const path = join(kbDir, file);
			if (!READ.has(kbDocKind(path) ?? "")) return [];
			const text = readFileSync(path, "utf8");
			try {
				return [{ ...readKbDoc(text, path), text }];
			} catch {
				return [];
			}
		});
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
