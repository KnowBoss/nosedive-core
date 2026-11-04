import { existsSync } from "node:fs";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./i01a1335483aa776cb84df698b04adc06.ts";
import { nestedRoot } from "./i01a1934563e77ed886f06d04416385ef.ts";
import { CORE_OWNER, i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import type { MigrationCtx } from "./i01a175dbf4517dafa3a9048ecd98ab84.ts";

const DONE = /^##[ \t]+done[ \t]+when[ \t]*$/im;
const DROP = /^##[ \t]+drop[ \t]+when[ \t]*$/im;

/**
 * Renames each of the repo's kind docs' `## Done when` heading to `## Drop when`, its text left for the pilot to reword (drop-when).
 * Returns undefined, writing nothing, while a doc has both headings, which only the pilot can settle.
 */
export function i01a1a7181a447bbb991c9a0f584f2549(dir: string, ctx: MigrationCtx): string[] | undefined {
	const repo = readRepoConfig(dir);
	if (!repo) return [];
	const places = [repo.kindsDir, ...repo.roots.filter((root) => !nestedRoot(repo, root)).map((root) => root.dir)];
	const seen = new Set<string>();
	const docs = [...new Set(places)]
		.filter((place): place is string => place !== undefined && existsSync(place))
		.flatMap((place) => listKbDocs(place))
		.filter((doc) => !seen.has(doc.path) && seen.add(doc.path))
		.filter((doc) => {
			const kind = docKind(doc, repo.id);
			return kind.owner === CORE_OWNER && kind.name === "kind" && DONE.test(doc.body);
		});

	const clashes = docs.filter((doc) => DROP.test(doc.body));
	if (clashes.length > 0) {
		for (const doc of clashes) ctx.out(`drop-when: kind ${String(doc.fm.name)} (${doc.path}) has both a Done when and a Drop when section; keep one, then seed`);
		return undefined;
	}
	for (const doc of docs) {
		writeKbDoc(doc.path, doc.yaml, doc.body.replace(DONE, "## Drop when"));
		ctx.out(`drop-when: kind ${String(doc.fm.name)}'s Done when is now its Drop when: reword it to say how one is dropped`);
	}
	return docs.map((doc) => doc.path);
}
