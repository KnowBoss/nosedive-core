import { spawnSync } from "node:child_process";
import { relative } from "node:path";
import { CORE_OWNER, scopeEntries, i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import { dropWhenOf, dropWhenSlips } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc, kingsmetal } from "./i01a1335483aa776cb84df698b04adc06.ts";
import type { KbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge, type Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { i01a19005c109715583553072f4e38dc4 as commitSubject } from "./i01a19005c109715583553072f4e38dc4.ts";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { isDurable, kindOfDoc } from "./i01a147171f057d019118aaa1f269f5fd.ts";
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
	/** The docs marked to be written so far, in the order they were first marked. */
	touched(): EditedDoc[];
	/**
	 * Writes the changed docs, commits each repo's (as `subject` when given: `crud <edits>` by default), and returns their paths relative
	 * to the bridge. `include` names docs already on disk, as one just minted, to commit with them whether or not they changed.
	 */
	commit(subject?: { action: string; what: string }, include?: EditedDoc[]): string[];
	/** When set, kind and meta edits leave their schema check to the caller, collecting the docs here. */
	unchecked?: Set<EditedDoc>;
};

/**
 * `version` is the core's, named in the co-author trailer of its commits; `capes` turn on the durable-link check; `warn` is told
 * of a kind doc whose Drop when is amiss, or whose edit makes its kind durable or no longer durable.
 */
export function i01a14ab1d36771eea2bc6f13bdeb0526(cwd: string, version: string, capes?: Cape[], warn?: (warning: string) => void): KbEdit {
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
		touched() {
			return [...changed];
		},
		commit(given, include = []) {
			if (capes) refuseDurableUnderWork(bridge, capes, [...changed], (id) => docs.get(id) ?? locateKbDoc(bridge, id));
			const byRepo = new Map<string, { doc: EditedDoc; write: boolean }[]>();
			for (const doc of changed) {
				// A doc is refused only as it would be written, so an edit can repair one.
				scopeEntries(doc.fm.scopes);
				kingsmetal(doc.yaml);
				const text = `---\n${doc.yaml.toString({ lineWidth: 0 })}---\n${doc.body}`;
				if (text === doc.text) continue;
				if (warn) for (const warning of kindDocWarnings(doc)) warn(warning);
				byRepo.set(doc.repoDir, [...(byRepo.get(doc.repoDir) ?? []), { doc, write: true }]);
			}
			for (const doc of include) {
				const written = byRepo.get(doc.repoDir) ?? [];
				if (!written.some((each) => each.doc === doc)) byRepo.set(doc.repoDir, [...written, { doc, write: false }]);
			}
			for (const [repoDir, written] of byRepo) {
				for (const { doc, write } of written) if (write) writeKbDoc(doc.path, doc.yaml, doc.body);
				const { action, what } = given ?? { action: "crud", what: [...new Set(edits)].join(", ") || "edit" };
				commitFiles(repoDir, written.map(({ doc }) => doc.path), commitSubject(bridge, action, what, written.map(({ doc }) => doc.id), capes), version);
			}
			return [...new Set([...include, ...changed])].map((doc) => relative(bridge.dir, doc.path).replace(/\\/g, "/"));
		},
	};
}

/** What a kind doc's edit says about its Drop when, which decides whether its kind is durable. */
function kindDocWarnings(doc: EditedDoc): string[] {
	const holder = readRepoConfig(doc.repoDir)?.id;
	const after = { fm: doc.yaml.toJS() as Record<string, unknown>, path: doc.path };
	const kind = docKind(after, holder);
	if (kind.owner !== CORE_OWNER || kind.name !== "kind") return [];
	const name = `kind ${String(after.fm.name ?? doc.id)}`;
	const warnings = dropWhenSlips(doc.body).map((slip) => `${name}: ${slip}`);
	const before = readKbDoc(doc.text, doc.path);
	const wasKind = (() => {
		const was = docKind({ fm: before.fm, path: doc.path }, holder);
		return was.owner === CORE_OWNER && was.name === "kind";
	})();
	const durable = dropWhenOf(doc.body) === undefined;
	if (wasKind && (dropWhenOf(before.body) === undefined) !== durable) {
		warnings.push(durable ? `${name} is now durable, since its doc no longer says how a doc of it is dropped` : `${name} is no longer durable, since its doc now says how a doc of it is dropped`);
	}
	return warnings;
}

type Linked = { fm: Record<string, unknown>; path: string; repoDir: string };

/** A durable doc hangs only off a root or another durable doc, and a spec only off a durable doc; only the links an edit adds are checked. */
function refuseDurableUnderWork(bridge: Bridge, capes: Cape[], changed: EditedDoc[], find: (id: string) => Linked | undefined): void {
	const durable = (doc: Linked) => isDurable(kindOfDoc(doc, bridge, capes).kind);
	const isRoot = (doc: Linked) => [...bridge.roots, ...(readRepoConfig(doc.repoDir)?.roots ?? [])].some((root) => root.id === String(doc.fm.id));
	const label = (doc: Linked) => `${String(doc.fm.kind)} ${String(doc.fm.name)}`;
	for (const doc of changed) {
		const was = linkedIds(readKbDoc(doc.text, doc.path));
		const before = new Set(was.map(({ id, rel }) => `${id} ${String(rel)}`));
		// A spec the doc already linked may change its rel, as answering or superseding does; only a new one is checked.
		const specced = new Set(was.filter(({ rel }) => typeof rel === "string" && rel.endsWith(".spec")).map(({ id }) => id));
		for (const { id, rel } of linkedIds({ fm: doc.yaml.toJS() as Record<string, unknown> })) {
			if (typeof rel === "string" && rel.endsWith(".spec") && !specced.has(id) && !durable(doc) && !isRoot(doc)) {
				throw new Error(`${label(doc)} is not durable, so it cannot hold specs: a spec hangs off the durable doc it shapes, and work links to what it needs (specs-on-durable)`);
			}
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
