import { readFileSync } from "node:fs";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./i01a1335483aa776cb84df698b04adc06.ts";
import { CORE_OWNER, scopeEntries, i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import { pinOf } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import type { MigrationCtx } from "./i01a175dbf4517dafa3a9048ecd98ab84.ts";

export function i01a1928d0d6873538e60181957211490(dir: string, ctx: MigrationCtx): string[] | undefined {
	const repo = readRepoConfig(dir);
	if (!repo?.workspace) return [];
	const primary = repo.roots.find((root) => root.id === repo.root);
	if (!primary) return [];
	const doc = { ...readKbDoc(readFileSync(primary.path, "utf8"), primary.path), path: primary.path };
	const kind = docKind(doc, repo.id);
	if (kind.owner !== CORE_OWNER || kind.name !== "base") return [];
	const core = ctx.capes[0]!;
	let pin: { version: string; schema: string };
	try {
		pin = pinOf({ ...(core.kinds.hero as object), name: "hero", owner: CORE_OWNER, repoDir: core.repoDir }, repo);
	} catch {
		ctx.out("hero-self: waiting for core:hero schema to be published");
		return undefined;
	}
	const scopes = scopeEntries(doc.fm.scopes);
	scopes.set(CORE_OWNER, { ...scopes.get(CORE_OWNER), canonical: true, ...pin });
	doc.yaml.set("kind", "hero");
	doc.yaml.set("scopes", [...scopes].map(([id, entry]) => ({ [id]: entry })));
	writeKbDoc(primary.path, doc.yaml, doc.body);
	return [primary.path];
}
