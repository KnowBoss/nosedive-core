import { spawnSync } from "node:child_process";
import { relative } from "node:path";
import { scopeEntries } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc, kingsmetal } from "./i01a1335483aa776cb84df698b04adc06.ts";
import type { KbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge, type Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";

export type EditedDoc = KbDoc & { id: string; path: string; text: string; repoDir: string; kbDir: string };

export type KbEdit = {
	bridge: Bridge;
	/** Finds a doc once per edit; later calls see earlier changes. */
	doc(id: string): EditedDoc;
	/** Marks a doc to be written. */
	change(doc: EditedDoc): void;
	/** Writes the changed docs, commits each repo's (as `message` when given), and returns their paths relative to the bridge. */
	commit(message?: string): string[];
	/** When set, kind and meta edits leave their schema check to the caller, collecting the docs here. */
	unchecked?: Set<EditedDoc>;
};

export function i01a14ab1d36771eea2bc6f13bdeb0526(cwd: string): KbEdit {
	const bridge = findBridge(cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const docs = new Map<string, EditedDoc>();
	const changed = new Set<EditedDoc>();
	return {
		bridge,
		doc(id) {
			const known = docs.get(id);
			if (known) return known;
			const found = locateKbDoc(bridge, id);
			if (!found) throw new Error(`no doc ${id} in the bridge or its workspace`);
			const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "--", found.path], { cwd: found.repoDir, encoding: "utf8" });
			if (tracked.status !== 0) throw new Error(`${id} is not tracked by git in ${found.repoDir}, so crud does not edit it`);
			const doc = { ...found, id };
			docs.set(id, doc);
			return doc;
		},
		change(doc) {
			changed.add(doc);
		},
		commit(given) {
			const byRepo = new Map<string, { doc: EditedDoc; text: string }[]>();
			for (const doc of changed) {
				// A doc is refused only as it would be written, so an edit can repair one.
				scopeEntries(doc.fm.scopes);
				kingsmetal(doc.yaml);
				const text = `---\n${doc.yaml.toString({ lineWidth: 0 })}---\n${doc.body}`;
				if (text === doc.text) continue;
				byRepo.set(doc.repoDir, [...(byRepo.get(doc.repoDir) ?? []), { doc, text }]);
			}
			for (const [repoDir, written] of byRepo) {
				for (const { doc } of written) writeKbDoc(doc.path, doc.yaml, doc.body);
				const [only] = written;
				const message =
					given ??
					(written.length === 1 ? `crud(${only!.doc.id}): updated ${String(only!.doc.fm.kind)} ${String(only!.doc.fm.name)}` : `crud: updated ${written.length} docs`);
				commitFiles(repoDir, written.map(({ doc }) => doc.path), message);
			}
			return [...changed].map((doc) => relative(bridge.dir, doc.path).replace(/\\/g, "/"));
		},
	};
}
