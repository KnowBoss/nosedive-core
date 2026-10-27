import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { relative } from "node:path";
import { scopeEntries } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc, kingsmetal } from "./i01a1335483aa776cb84df698b04adc06.ts";
import type { KbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge, type Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { i01a19005c109715583553072f4e38dc4 as commitSubject } from "./i01a19005c109715583553072f4e38dc4.ts";

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

/** `version` is the core's, named in the co-author trailer of its commits. */
export function i01a14ab1d36771eea2bc6f13bdeb0526(cwd: string, version: string): KbEdit {
	const bridge = findBridge(cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const docs = new Map<string, EditedDoc>();
	const changed = new Set<EditedDoc>();
<<<<<<< HEAD
	const edits: string[] = [];
=======
	// Keep preconditions separate from the mutable documents callers edit.
	const originals = new Map<EditedDoc, { path: string; repo: string; content: Buffer; identity: string; index: string }>();
	const heads = new Map<string, string>();
	const conflict = (message: string) => Object.assign(new Error(message), { code: "REPOSITORY_CHANGED", status: 409, outcome: "not_applied" });
	const git = (repo: string, ...args: string[]) => {
		const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
		if (result.status !== 0) throw conflict(`Cannot verify the repository before saving: ${result.stderr || result.error?.message || args[0]}`);
		return result.stdout;
	};
	const identity = (path: string) => {
		const stat = lstatSync(path, { bigint: true });
		return JSON.stringify([realpathSync(path), ...[stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeNs, stat.ctimeNs].map(String)]);
	};
>>>>>>> 13be5cf (Refuse prepared KB edits when their read inputs change)
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
			try {
				const before = identity(doc.path);
				const content = readFileSync(doc.path);
				if (content.toString("utf8") !== doc.text || identity(doc.path) !== before) throw conflict(`${id} changed while it was being opened; read the latest document before saving.`);
				const head = git(doc.repoDir, "rev-parse", "HEAD");
				if (heads.has(doc.repoDir) && heads.get(doc.repoDir) !== head) throw conflict("The repository changed while preparing this edit; read the latest state before saving.");
				heads.set(doc.repoDir, head);
				originals.set(doc, { path: doc.path, repo: doc.repoDir, content, identity: before, index: git(doc.repoDir, "ls-files", "--stage", "--", doc.path) });
			} catch (error) {
				if ((error as { code?: string }).code === "REPOSITORY_CHANGED") throw error;
				throw conflict(`${id} became unavailable while opening it; read the latest state before saving.`);
			}
			docs.set(id, doc);
			return doc;
		},
		change(doc) {
			if (!originals.has(doc)) throw conflict("This document was not opened by this edit; open it before changing it.");
			changed.add(doc);
		},
		commit(given) {
			// Validate the entire read set before writing any repository, including unchanged
			// documents whose contents informed this operation. This is optimistic validation,
			// not an OS lock against an editor writing after these checks.
			for (const [repo, head] of heads) if (git(repo, "rev-parse", "HEAD") !== head) throw conflict("The repository changed while preparing this edit; read the latest state before saving.");
			for (const [doc, original] of originals) {
				try {
					if (doc.path !== original.path || doc.repoDir !== original.repo || identity(doc.path) !== original.identity || !readFileSync(doc.path).equals(original.content) || identity(doc.path) !== original.identity || git(doc.repoDir, "ls-files", "--stage", "--", doc.path) !== original.index) {
						throw conflict(`${doc.id} changed while preparing this edit; read the latest document before saving.`);
					}
				} catch (error) {
					if ((error as { code?: string }).code === "REPOSITORY_CHANGED") throw error;
					throw conflict(`${doc.id} became unavailable while preparing this edit; nothing was written.`);
				}
			}
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
