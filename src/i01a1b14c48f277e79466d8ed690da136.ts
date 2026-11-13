import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseDocument } from "yaml";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./i01a1335483aa776cb84df698b04adc06.ts";
import { i01a133588b1f7d4ea13f1b5e79f02e4c as mergeKeyedEntries } from "./i01a133588b1f7d4ea13f1b5e79f02e4c.ts";
import type { MigrationCtx } from "./i01a175dbf4517dafa3a9048ecd98ab84.ts";

/** The capes a legacy hero comes to wear, each pinned to the commit this core names. */
export const LEGACY_CAPES = [
	{
		id: "01a1b13e-111d-73de-8f7d-41b47af07703",
		name: "nosedive-legacy",
		gist: "The cape holding jump, pack, land, bail and legacy nosedive's test, hydrate-repo.workspace, dehydrate-repo.workspace, record.gate and note",
		origin: "https://github.com/KnowBoss/nosedive-legacy.git",
		commit: "11f106bb8f71c7205781e081cf81ff1953dfad1c",
	},
];

export function i01a1b14c48f277e79466d8ed690da136(dir: string, ctx: MigrationCtx): string[] {
	const configPath = join(dir, ".nosedive", "config.yaml");
	if (!existsSync(configPath)) return [];
	const config = parseDocument(readFileSync(configPath, "utf8"));
	const backlog = config.get("backlog");
	if (config.has("roots") || typeof backlog !== "string") return [];
	const kbDir = join(dir, typeof config.get("kb") === "string" ? String(config.get("kb")) : "./kb");
	const root = findKbDoc(kbDir, backlog);
	// Baseline refuses a backlog that is not there, naming it.
	if (!root) return [];

	const changed: string[] = [];
	const linked = new Set(JSON.stringify(root.fm.links ?? []).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) ?? []);
	const links: Record<string, unknown> = {};
	for (const cape of LEGACY_CAPES) {
		const path = join(kbDir, `${cape.id}.md`);
		if (!existsSync(path) && !existsSync(join(dir, ".nosedive", "repos", `${cape.id}.md`))) {
			writeFileSync(path, `---\nkind: repo\nid: ${cape.id}\nname: ${cape.name}\ngist: ${JSON.stringify(cape.gist)}\nmeta:\n  trunk: main\n  remotes:\n    origin: ${cape.origin}\n---\n\n# ${cape.name}\n`);
			changed.push(path);
		}
		if (linked.has(cape.id)) continue;
		links[relative(dir, path).replace(/\\/g, "/")] = { rel: ".cape", commit: cape.commit };
		ctx.out(`legacy-capes: ${String(root.fm.name)} wears ${cape.name} at ${cape.commit.slice(0, 7)}`);
	}
	if (Object.keys(links).length > 0) {
		root.yaml.set("links", mergeKeyedEntries(root.fm.links, links));
		writeKbDoc(root.path, root.yaml, root.body);
		changed.push(root.path);
	}
	return changed;
}
