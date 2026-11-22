import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { CORE_OWNER, scopeEntries, i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import { dropWhenOf, dropWhenSlips } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { kingsmetal } from "./i01a1335483aa776cb84df698b04adc06.ts";
import type { KbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge, type Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { i01a19005c109715583553072f4e38dc4 as commitSubject } from "./i01a19005c109715583553072f4e38dc4.ts";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { isDurable, kindOfDoc } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { linkedIds } from "./i01a1901e263b7209a4b5f39a71c568b3.ts";
import { commitOffside, commitPlan, describeRefusal } from "./i01a1ffce2ea27db19c84f1fec56c9a3d.ts";

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
	/** Each commit `commit` has made so far: the repo's directory and the commit's sha, in the order made. */
	commits: { repoDir: string; sha: string }[];
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
	const commits: { repoDir: string; sha: string }[] = [];
	return {
		bridge,
		edits,
		commits,
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
			const byRepo = new Map<string, { doc: EditedDoc; text: string }[]>();
			for (const doc of changed) {
				// A doc is refused only as it would be written, so an edit can repair one.
				scopeEntries(doc.fm.scopes);
				kingsmetal(doc.yaml);
				const text = `---\n${doc.yaml.toString({ lineWidth: 0 })}---\n${doc.body}`;
				if (text === doc.text) continue;
				if (warn) for (const warning of kindDocWarnings(doc)) warn(warning);
				byRepo.set(doc.repoDir, [...(byRepo.get(doc.repoDir) ?? []), { doc, text }]);
			}
			for (const doc of include) {
				const written = byRepo.get(doc.repoDir) ?? [];
				if (!written.some((each) => each.doc === doc)) byRepo.set(doc.repoDir, [...written, { doc, text: doc.text }]);
			}
			for (const [repoDir, written] of byRepo) {
				const { action, what } = given ?? { action: "crud", what: [...new Set(edits)].join(", ") || "edit" };
				const parent = gitValue(repoDir, ["rev-parse", "HEAD"]);
				const ref = gitValue(repoDir, ["symbolic-ref", "-q", "HEAD"]);
				const files = Object.fromEntries(written.map(({ doc, text }) => [relative(repoDir, doc.path).replace(/\\/g, "/"), text]));
				const ids = written.map(({ doc }) => doc.id);
				const first = commitSubject(bridge, action, what, ids, capes);
				// A doc whose file still holds the bytes edit read, though the index does not (uncommitted before the edit began, or just minted),
				// has its index entry set to those bytes, from memory: the file is never read to stage it. Git's read-tree then replaces
				// it with the final content only while file and index still agree, so a save made since is left alone.
				const staged = new Set<string>();
				for (const { doc } of written) {
					const rel = relative(repoDir, doc.path).replace(/\\/g, "/");
					const inParent = spawnSync("git", ["show", `${parent}:${rel}`], { cwd: repoDir, encoding: "utf8" });
					let onDisk: string | undefined;
					try {
						onDisk = readFileSync(doc.path, "utf8");
					} catch {}
					if (onDisk !== doc.text || (inParent.status === 0 && inParent.stdout === doc.text)) continue;
					const blob = spawnSync("git", ["hash-object", "-w", "--stdin"], { cwd: repoDir, encoding: "utf8", input: doc.text });
					const mode = /^(\d+) /.exec(spawnSync("git", ["ls-files", "-s", "--", rel], { cwd: repoDir, encoding: "utf8" }).stdout)?.[1] ?? "100644";
					if (blob.status === 0 && spawnSync("git", ["update-index", "--add", "--cacheinfo", `${mode},${blob.stdout.trim()},${rel}`], { cwd: repoDir }).status === 0) staged.add(rel);
				}
				// Refreshing compares the file with the entry without staging it, so git can tell it is up to date.
				if (staged.size > 0) spawnSync("git", ["update-index", "-q", "--refresh"], { cwd: repoDir });
				const from = staged.size > 0 ? commitOffside(repoDir, parent, Object.fromEntries(written.flatMap(({ doc }) => { const rel = relative(repoDir, doc.path).replace(/\\/g, "/"); return staged.has(rel) ? [[rel, doc.text]] : []; })), "as the checkout holds it", version).tip : parent;
				let { tip } = commitOffside(repoDir, parent, files, first, version);
				const done = commitPlan({ steps: [{ repo: repoDir, dir: repoDir, local: { moves: [{ ref, old: parent, new: tip }], files: { from, to: tip, afterMoves: true, paths: Object.keys(files) } } }] }, action);
				if (!done.ok && done.refusal.kind !== "dirty") throw new Error(describeRefusal(done.refusal));
				if (!done.ok) warn?.(`warning: ${tip.slice(0, 7)} was committed, but git left the changed working file alone: ${done.refusal.detail}`);
				// The subject is worked out from the docs as the checkout now has them; when that changes it, the same tree is committed again under it.
				const subject = commitSubject(bridge, action, what, ids, capes);
				if (subject !== first) {
					const again = commitOffside(repoDir, parent, files, subject, version);
					if (commitPlan({ steps: [{ repo: repoDir, dir: repoDir, local: { moves: [{ ref, old: tip, new: again.tip }] } }] }, action).ok) tip = again.tip;
				}
				for (const { doc, text } of written) doc.text = text;
				commits.push({ repoDir, sha: tip });
			}
			return [...new Set([...include, ...changed])].map((doc) => relative(bridge.dir, doc.path).replace(/\\/g, "/"));
		},
	};
}

function gitValue(dir: string, args: string[]): string {
	const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
	if (result.status !== 0) throw new Error(`git ${args[0]} failed in ${dir}: ${(result.stderr || result.stdout || result.error?.message || "").trim()}`);
	return result.stdout.trim();
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
