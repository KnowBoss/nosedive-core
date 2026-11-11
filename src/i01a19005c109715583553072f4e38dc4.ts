import { spawnSync } from "node:child_process";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { isDurable, kindOfDoc } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { i01a1901e263b7209a4b5f39a71c568b3 as featWalk, linkedIds } from "./i01a1901e263b7209a4b5f39a71c568b3.ts";

const FEAT_OR_SPEC = /\.(feat|spec)$/;

/** `feat(<feat>): <action> <what>`, or `<action>: <what>` when there is no feat to name. */
export function subjectLine(feat: string | undefined, action: string, what: string): string {
	return feat ? `feat(${feat}): ${action} ${what}` : `${action}: ${what}`;
}

/** The subject of a commit made by `action` that touched the docs `ids`: grouped by the feat found for them. `capes` let it read a kind's `meta.next`. */
export function i01a19005c109715583553072f4e38dc4(bridge: Bridge, action: string, what: string, ids: string[] = [], capes?: Cape[]): string {
	return subjectLine(featNameOf(bridge, ids, capes), action, what);
}

const QUID_LAST = /(?:^|[/-])([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/** The feat the hero's branch names: the quid it ends with, after a slash or a dash, when the feat tree holds it, as a work loop's branch names the feat it works. */
function branchFeat(bridge: Bridge): string | undefined {
	const branch = spawnSync("git", ["symbolic-ref", "-q", "--short", "HEAD"], { cwd: bridge.dir, encoding: "utf8" }).stdout.trim();
	return QUID_LAST.exec(branch)?.[1];
}

/**
 * The name of the feat to group a commit under: the one the hero's branch names, else the first the touched docs other than roots have; nothing when none is found or a doc will not read.
 * A doc the feat tree does not hold counts as a feat's when a walked doc other than a root links it by a rel its kind names in `meta.next`, given `capes` to read kinds by.
 */
export function featNameOf(bridge: Bridge, ids: string[], capes?: Cape[]): string | undefined {
	try {
		const walk = featWalk(bridge);
		// A feat is named by its own name, whatever its kind: core knows feats by the role of the links reaching them.
		const nameOf = (id: string): string | undefined => {
			const name = walk.docs.get(id)?.fm.name;
			return name === undefined ? undefined : String(name);
		};
		// Who links each doc, by which rel, in the order the walk read them; built when a doc first needs it.
		let index: Map<string, { holder: string; rel: string }[]> | undefined;
		const holdersOf = (id: string) => {
			if (!index) {
				index = new Map();
				for (const [holder, from] of walk.docs) for (const link of linkedIds(from)) {
					if (!index.has(link.id)) index.set(link.id, []);
					index.get(link.id)!.push({ holder, rel: String(link.rel) });
				}
			}
			return index.get(id) ?? [];
		};
		const isRoot = (id: string) => bridge.roots.some((root) => root.id === id);
		let featOrder: Map<string, number> | undefined;
		// The feat, first in the order the walk found them, that links a doc by a .feat or .spec rel.
		const featHolder = (id: string) => {
			featOrder ??= new Map([...walk.feats.keys()].map((feat, position) => [feat, position]));
			const order = featOrder;
			const held = holdersOf(id).filter(({ holder, rel }) => FEAT_OR_SPEC.test(rel) && order.has(holder));
			return held.length ? held.reduce((first, next) => (order.get(next.holder)! < order.get(first.holder)! ? next : first)).holder : undefined;
		};
		// The first walked doc that links a doc by a rel its non-durable kind names in meta.next, as next lists it (kind-declared links), with the doc; a root only when `rootToo`.
		const declaredHolder = (id: string, rootToo = false) => {
			const doc = capes && (walk.docs.get(id) ?? locateKbDoc(bridge, id));
			const kind = doc && kindOfDoc(doc, bridge, capes).kind;
			const rels = kind && !isDurable(kind) ? kind.next : undefined;
			if (!doc || !rels?.length) return undefined;
			const held = holdersOf(id).find(({ holder, rel }) => rels.includes(rel) && (rootToo || !isRoot(holder)));
			return held && { holder: held.holder, doc };
		};
		const onBranch = branchFeat(bridge);
		if (onBranch && walk.feats.has(onBranch)) return nameOf(onBranch);
		// The branch's doc is grouped under its own name, so whichever doc holds it will do, a root too.
		const declaredOnBranch = onBranch && declaredHolder(onBranch, true);
		// A doc with no name has none to group under, so the touched docs are tried instead.
		if (declaredOnBranch && declaredOnBranch.doc.fm.name !== undefined) return String(declaredOnBranch.doc.fm.name);
		for (const id of ids) {
			if (walk.feats.has(id)) return nameOf(id);
			// A root's .feat links go down to the feats it holds.
			if (isRoot(id)) continue;
			const doc = walk.docs.get(id) ?? locateKbDoc(bridge, id);
			const reached = doc && linkedIds(doc).find((link) => FEAT_OR_SPEC.test(String(link.rel)) && walk.feats.has(link.id));
			if (reached) return nameOf(reached.id);
			const feat = featHolder(id);
			if (feat) return nameOf(feat);
			const declared = declaredHolder(id);
			if (declared) return nameOf(declared.holder);
		}
	} catch {
		// A commit is never refused for want of a feat to name.
	}
	return undefined;
}
