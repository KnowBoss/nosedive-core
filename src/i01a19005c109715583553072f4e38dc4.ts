import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { i01a1901e263b7209a4b5f39a71c568b3 as featWalk, heldDives, linkedIds } from "./i01a1901e263b7209a4b5f39a71c568b3.ts";

const FEAT_OR_SPEC = /\.(feat|spec)$/;

/** `feat(<feat>): <action> <what>`, or `<action>: <what>` when there is no feat to name. */
export function subjectLine(feat: string | undefined, action: string, what: string): string {
	return feat ? `feat(${feat}): ${action} ${what}` : `${action}: ${what}`;
}

/** The subject of a commit made by `action` that touched the docs `ids`: grouped by the feat found for them. */
export function i01a19005c109715583553072f4e38dc4(bridge: Bridge, action: string, what: string, ids: string[] = []): string {
	return subjectLine(featNameOf(bridge, ids), action, what);
}

/** Who holds a dive from a checkout of the hero: `<email>#<hash of its path, branch and email>`; nothing when git lacks an email or the checkout a branch. */
export function holderToken(dir: string): string | undefined {
	const git = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" }).stdout.trim();
	const [email, top, branch] = [git("config", "user.email"), git("rev-parse", "--show-toplevel"), git("symbolic-ref", "-q", "--short", "HEAD")];
	if (!email || !top || !branch) return undefined;
	return `${email}#${createHash("sha256").update(`${top}/${branch}/${email}`).digest("hex").slice(0, 12)}`;
}

/** The name of the feat to group a commit under: the held dive's, else the first the touched docs have; nothing when none is found, several dives are held, or a doc will not read. */
export function featNameOf(bridge: Bridge, ids: string[]): string | undefined {
	try {
		const walk = featWalk(bridge);
		const nameOf = (id: string): string | undefined => {
			const doc = walk.docs.get(id);
			// A dive belongs to its feat.
			if (doc?.fm.kind === "dive") return nameOf(String((doc.fm.meta as { feat?: unknown } | undefined)?.feat));
			const name = doc?.fm.name;
			return name === undefined ? undefined : String(name);
		};
		const token = holderToken(bridge.dir);
		const held = token ? heldDives(bridge, token, walk) : [];
		if (held.length > 1) return undefined;
		const heldFeat = held[0] && nameOf(String((held[0].fm.meta as { feat?: unknown }).feat));
		if (heldFeat) return heldFeat;
		for (const id of ids) {
			if (walk.feats.has(id)) return nameOf(id);
			const doc = walk.docs.get(id) ?? locateKbDoc(bridge, id);
			const reached = doc && linkedIds(doc).find((link) => FEAT_OR_SPEC.test(String(link.rel)) && walk.feats.has(link.id));
			if (reached) return nameOf(reached.id);
			for (const feat of walk.feats.keys()) {
				const links = walk.docs.get(feat);
				if (links && linkedIds(links).some((link) => link.id === id && FEAT_OR_SPEC.test(String(link.rel)))) return nameOf(feat);
			}
		}
	} catch {
		// A commit is never refused for want of a feat to name.
	}
	return undefined;
}
