import { spawnSync } from "node:child_process";
import { relative } from "node:path";
import { scopeEntries } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc, kingsmetal } from "./i01a1335483aa776cb84df698b04adc06.ts";
import type { KbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge, type Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { i01a19005c109715583553072f4e38dc4 as commitSubject } from "./i01a19005c109715583553072f4e38dc4.ts";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { kindOfDoc } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { linkedIds } from "./i01a1901e263b7209a4b5f39a71c568b3.ts";

export type EditedDoc = KbDoc & { id: string; path: string; text: string; repoDir: string; kbDir: string };

export type KbEdit = {
	bridge: Bridge;
	/** Finds a doc once per edit; later calls see earlier changes. */
	doc(id: string): EditedDoc;
	/** Marks a doc to be written. */
	change(doc: EditedDoc): void;
	/** The crud edits applied, by name, in order; they name the commit's `what` unless it is given one. */
	edits: string[];
	/** Writes the changed docs, commits each repo's (as `subject` when given: `crud <edits>` by default), and returns their paths relative to the bridge. */
	commit(subject?: { action: string; what: string }): string[];
	/** When set, kind and meta edits leave their schema check to the caller, collecting the docs here. */
	unchecked?: Set<EditedDoc>;
};

/** `version` is the core's, named in the co-author trailer of its commits; `capes` turn on the durable-link check. */
export function i01a14ab1d36771eea2bc6f13bdeb0526(cwd: string, version: string, capes?: Cape[]): KbEdit {
	const bridge = findBridge(cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const docs = new Map<string, EditedDoc>();
	const changed = new Set<EditedDoc>();
	const edits: string[] = [];
	return {
		bridge,
		edits,
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
			if (capes) refuseDurableUnderWork(bridge, capes, [...changed], (id) => docs.get(id) ?? locateKbDoc(bridge, id));
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
				const { action, what } = given ?? { action: "crud", what: [...new Set(edits)].join(", ") || "edit" };
				commitFiles(repoDir, written.map(({ doc }) => doc.path), commitSubject(bridge, action, what, written.map(({ doc }) => doc.id)), version);
			}
			return [...changed].map((doc) => relative(bridge.dir, doc.path).replace(/\\/g, "/"));
		},
	};
}

type Linked = { fm: Record<string, unknown>; path: string; repoDir: string };

/** A durable doc hangs only off a root or another durable doc; only the `.feat` links an edit adds are checked. */
function refuseDurableUnderWork(bridge: Bridge, capes: Cape[], changed: EditedDoc[], find: (id: string) => Linked | undefined): void {
	const durable = (doc: Linked) => kindOfDoc(doc, bridge, capes).kind?.durable === true;
	const isRoot = (doc: Linked) => [...bridge.roots, ...(readRepoConfig(doc.repoDir)?.roots ?? [])].some((root) => root.id === String(doc.fm.id));
	const label = (doc: Linked) => `${String(doc.fm.kind)} ${String(doc.fm.name)}`;
	for (const doc of changed) {
		const before = new Set(linkedIds(readKbDoc(doc.text, doc.path)).map(({ id, rel }) => `${id} ${String(rel)}`));
		for (const { id, rel } of linkedIds({ fm: doc.yaml.toJS() as Record<string, unknown> })) {
			if (typeof rel !== "string" || !rel.endsWith(".feat") || before.has(`${id} ${rel}`)) continue;
			const other = find(id);
			if (!other) continue;
			const [parent, child] = rel === "parent.feat" ? [other, doc] : [doc, other];
			if (durable(child) && !durable(parent) && !isRoot(parent)) {
				throw new Error(`${label(child)} is durable, so it cannot hang under ${label(parent)}, which is neither durable nor a root: a durable doc hangs only off a root or another durable doc`);
			}
		}
	}
}
