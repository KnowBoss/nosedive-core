import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { CORE_OWNER, i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";

const LOCAL = /^(?:[^:]*\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.md)?$/;

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

/** The name of the feat to group a commit under: the held dive's, else the first the touched docs have; nothing when none is found, or a doc will not read. */
export function featNameOf(bridge: Bridge, ids: string[]): string | undefined {
	try {
		const held = heldFeat(bridge);
		if (held) return held;
		if (ids.length === 0) return undefined;
		const feats = featIds(bridge);
		for (const id of ids) {
			const doc = locateKbDoc(bridge, id);
			const found = feats.has(id) ? id : linkedIds(doc?.fm.links).find((link) => /\.(feat|spec)$/.test(String(link.rel)) && feats.has(link.id))?.id;
			const name = found && inHero(bridge, found)?.fm.name;
			if (name) return String(name);
		}
	} catch {
		// A commit is never refused for want of a feat to name.
	}
	return undefined;
}

/** The feat of the open dive whose `diver` is this checkout's holder token; the first by file name when it holds several. */
function heldFeat(bridge: Bridge): string | undefined {
	const token = holderToken(bridge.dir);
	if (!token) return undefined;
	for (const dir of rootDirs(bridge)) {
		for (const file of readdirSync(dir).filter((each) => each.endsWith(".md")).sort()) {
			const text = readFileSync(join(dir, file), "utf8");
			if (!text.includes(token)) continue;
			try {
				const { fm } = readKbDoc(text, file);
				const meta = (fm.meta ?? {}) as { diver?: unknown; feat?: unknown; outcome?: unknown };
				if (fm.kind !== "dive" || meta.diver !== token || meta.outcome || typeof meta.feat !== "string") continue;
				const name = inHero(bridge, meta.feat)?.fm.name;
				if (name) return String(name);
			} catch {
				// A doc that does not read is no dive.
			}
		}
	}
	return undefined;
}

/** Every doc the hero's roots reach through links whose rel ends `.feat`, a root of kind cape and `parent.feat` links aside. */
function featIds(bridge: Bridge): Set<string> {
	const feats = new Set<string>();
	for (const root of bridge.roots) {
		const rootDoc = inHero(bridge, root.id);
		const kind = rootDoc && docKind(rootDoc);
		if (kind?.owner === CORE_OWNER && kind.name === "cape") continue;
		const seen = new Set<string>();
		const queue = [root.id];
		while (queue.length > 0) {
			const at = queue.shift()!;
			if (seen.has(at)) continue;
			seen.add(at);
			for (const link of linkedIds(inHero(bridge, at)?.fm.links)) {
				if (typeof link.rel !== "string" || !link.rel.endsWith(".feat") || link.rel === "parent.feat") continue;
				feats.add(link.id);
				queue.push(link.id);
			}
		}
	}
	return feats;
}

/** The ids a links list names within its own repo, with each link's rel. */
function linkedIds(links: unknown): { id: string; rel: unknown }[] {
	return (Array.isArray(links) ? links : []).flatMap((link) =>
		Object.entries((link ?? {}) as Record<string, { rel?: unknown } | null>).flatMap(([key, value]) => {
			const id = LOCAL.exec(key)?.[1];
			return id ? [{ id, rel: value?.rel }] : [];
		}),
	);
}

function rootDirs(bridge: Bridge): string[] {
	return [...new Set([bridge.kbDir, ...bridge.roots.map((root) => root.dir)])].filter((dir) => existsSync(dir));
}

/** A doc of the hero repo itself, never one of its workspace's. */
function inHero(bridge: Bridge, id: string) {
	for (const dir of [...new Set([...(bridge.kindsDir ? [bridge.kindsDir] : []), ...(bridge.reposDir ? [bridge.reposDir] : []), ...rootDirs(bridge)])]) {
		const doc = existsSync(dir) ? findKbDoc(dir, id) : undefined;
		if (doc) return doc;
	}
	return undefined;
}
