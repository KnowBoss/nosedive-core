import { existsSync } from "node:fs";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./i01a1335483aa776cb84df698b04adc06.ts";
import { doneWhenOf } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { nestedRoot } from "./i01a1934563e77ed886f06d04416385ef.ts";
import { CORE_OWNER, i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import type { MigrationCtx } from "./i01a175dbf4517dafa3a9048ecd98ab84.ts";

/** What a kind doc that said it was not durable, and did not say when one of it is done, is given to stay that way. */
export const UNSAID_DONE_WHEN = "Not yet said: ask the pilot.";

/**
 * Drops `meta.durable` from the repo's kind docs, since a kind is durable when its doc has no `## Done when` section: one that said
 * `durable: false` without a section is given one, saying the pilot is to be asked. Returns undefined, writing nothing, while a doc
 * says `durable: true` and has a section, which only the pilot can settle.
 */
export function i01a19f0c888e79b7ae2866e1e45a7493(dir: string, ctx: MigrationCtx): string[] | undefined {
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
			return kind.owner === CORE_OWNER && kind.name === "kind";
		})
		.filter((doc) => {
			const meta = doc.fm.meta;
			return meta !== null && typeof meta === "object" && !Array.isArray(meta) && "durable" in meta;
		});

	const clashes = docs.filter((doc) => (doc.fm.meta as { durable?: unknown }).durable === true && doneWhenOf(doc.body) !== undefined);
	if (clashes.length > 0) {
		for (const doc of clashes) {
			ctx.out(`durable-from-done-when: kind ${String(doc.fm.name)} (${doc.path}) says durable: true and has a Done when section; drop the section to keep it durable, or meta.durable to make it passing work, then seed`);
		}
		return undefined;
	}

	for (const doc of docs) {
		const durable = (doc.fm.meta as { durable?: unknown }).durable === true;
		doc.yaml.deleteIn(["meta", "durable"]);
		const body = durable || doneWhenOf(doc.body) !== undefined ? doc.body : `${doc.body.replace(/\s*$/, "\n")}\n## Done when\n\n${UNSAID_DONE_WHEN}\n`;
		writeKbDoc(doc.path, doc.yaml, body);
		ctx.out(`durable-from-done-when: kind ${String(doc.fm.name)} ${durable ? "stays durable, having no Done when" : body === doc.body ? "stays passing work, by its Done when" : "stays passing work, given a Done when for the pilot to fill in"}`);
	}
	return docs.map((doc) => doc.path);
}
