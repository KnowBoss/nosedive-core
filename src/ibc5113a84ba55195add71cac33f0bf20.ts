import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { renderActions, type Args, type Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { hasSurface, surfaceDrift } from "./i01a19f5c60f879c28541aa6759d2b221.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { isDurable, kindOfDoc, type KindMeta } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import { i01a18e40518e7f15a2066909dca2be43 as listKinds } from "./i01a18e40518e7f15a2066909dca2be43.ts";
import { i01a1901e263b7209a4b5f39a71c568b3 as featWalk, linkedIds } from "./i01a1901e263b7209a4b5f39a71c568b3.ts";

type Listed = { fm: Record<string, unknown>; path: string; repoDir: string };

export async function ibc5113a84ba55195add71cac33f0bf20(_args: Args, ctx: Ctx): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const gap = trunkGap(bridge.dir, ctx);
	if (gap) ctx.err(`warning: the hero lacks ${gap.missing} commits origin's trunk has: rebase onto ${gap.trunk} before trusting this list`);
	for (const line of await footing(bridge.dir, ctx)) ctx.err(line);

	const walk = featWalk(bridge);
	const kindGroups = listKinds(bridge, ctx.capes);
	// A hero's doc is read in the hero's terms from one listing of its kinds; any other is asked of find-kind.
	const kindOf = (doc: Listed): { kind?: KindMeta; spelling: string } => {
		if (doc.repoDir !== bridge.dir) return kindOfDoc(doc, bridge, ctx.capes);
		const { owner, name } = docKind(doc, bridge.id);
		const found = kindGroups.find((group) => group.owner === owner)?.kinds.find((kind) => kind.name === name);
		return { kind: found?.meta, spelling: found?.spellings[0] ?? (owner === bridge.id ? name : `${owner}:${name}`) };
	};
	const groups = new Map<string, { parent: Listed; docs: Map<string, Listed> }>();
	const list = (parentId: string, doc: Listed) => {
		const parent = walk.docs.get(parentId);
		if (!parent) return;
		const group = groups.get(parentId) ?? { parent, docs: new Map() };
		group.docs.set(String(doc.fm.id), doc);
		groups.set(parentId, group);
	};

	for (const [id, node] of walk.feats) {
		const doc = walk.docs.get(id);
		if (!doc || isDurable(kindOf(doc).kind)) continue;
		const leaf = !linkedIds(doc).some(({ rel }) => typeof rel === "string" && rel.endsWith(".feat") && rel !== "parent.feat");
		if (leaf) list(node.parents[0]!, doc);
	}
	const declared = new Set(kindGroups.flatMap((group) => group.kinds.flatMap(({ meta }) => meta.next ?? [])));
	for (const [id, from] of walk.docs) {
		for (const { id: target, rel } of linkedIds(from)) {
			if (typeof rel !== "string" || rel.endsWith(".feat") || !declared.has(rel)) continue;
			const doc = locateKbDoc(bridge, target);
			const kind = doc && kindOf(doc).kind;
			if (kind && !isDurable(kind) && kind.next?.includes(rel)) list(id, doc);
		}
	}

	const at = (doc: Listed) => relative(bridge.dir, doc.path).replace(/\\/g, "/");
	// A kind is named by its shortest spelling: bare for the hero's own, else by its owner's short name.
	const spell = ({ kind, spelling }: ReturnType<typeof kindOf>) =>
		kindGroups.find((group) => group.owner === kind?.owner)?.kinds.find(({ name }) => name === kind?.name)?.spellings[0] ?? spelling;
	const lines: string[] = [];
	for (const { parent, docs } of groups.values()) {
		lines.push(`${String(parent.fm.name)}  ${at(parent)}`);
		for (const doc of docs.values()) {
			const found = kindOf(doc);
			lines.push(`  ${spell(found)} ${String(doc.fm.name)}  ${at(doc)}`);
		}
	}
	// What done looks like is read once one is picked (next-lists-droppable); working it ends in dropping it.
	ctx.out(lines.length > 0 ? [...lines, "", "pick one; its kind's Drop when, which crud --drop quotes when it refuses, says what dropping it takes; then: nosedive crud --drop <quid>"].join("\n") : "nothing left to do");
	if (gap) throw new Error(`the hero is behind ${gap.trunk}`);
}

/** How far the hero's HEAD is behind origin's trunk after fetching it; nothing when it has no origin or is not behind. */
function trunkGap(dir: string, ctx: Ctx): { trunk: string; missing: number } | undefined {
	const git = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
	// Asked by url, since any config key of a remote, a global `prune` say, makes `git remote` list it.
	if (git("remote", "get-url", "origin").status !== 0) return undefined;
	const fetched = git("fetch", "-q", "origin");
	if (fetched.status !== 0) {
		ctx.err(`could not fetch origin, so this lists the hero as it is: ${fetched.stderr.trim().split(/\r?\n/)[0]}`);
		return undefined;
	}
	let trunk = git("symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD").stdout.trim();
	if (!trunk) {
		const head = /^ref: refs\/heads\/(\S+)\tHEAD/m.exec(git("ls-remote", "--symref", "origin", "HEAD").stdout)?.[1];
		if (head) trunk = `origin/${head}`;
	}
	if (!trunk) throw new Error("origin names no trunk: its HEAD points at no branch");
	const missing = Number(git("rev-list", "--count", `HEAD..${trunk}`).stdout.trim());
	return missing > 0 ? { trunk, missing } : undefined;
}

/** The hero's footing, as warnings that never fail next: blocks that drift from this core's surface, and a newer core on npm, asked once a week. */
async function footing(dir: string, ctx: Ctx): Promise<string[]> {
	const lines: string[] = [];
	if (hasSurface(dir)) {
		// Seed writes the primary root's surface, so drift compares against that, whatever --at names.
		const at = process.env.NOSEDIVE_AT;
		delete process.env.NOSEDIVE_AT;
		try {
			lines.push(...(await surfaceDrift(dir, () => renderActions(ctx, false))));
		} catch {
			// Drift is advice: a block it cannot read is left for seed to report.
		} finally {
			if (at !== undefined) process.env.NOSEDIVE_AT = at;
		}
	}
	const newer = await newerCore(dir, ctx.capes[0]!.version);
	if (newer) lines.push(`warning: nosedive ${newer} is published; you run ${ctx.capes[0]!.version}: npm i -g nosedive`);
	return lines;
}

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** A version's y.m.d as numbers, or nothing for one that is not y.m.d, as a source run's. */
function ymd(version: string): number[] | undefined {
	const match = /^(\d+)\.(\d+)\.(\d+)(?:-|$)/.exec(version);
	return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

/** The last answer npm gave, or nothing when the record is missing, unreadable or not one. */
function lastAsked(record: string): { checked?: string; version?: string } {
	try {
		const seen: unknown = JSON.parse(readFileSync(record, "utf8"));
		return seen && typeof seen === "object" ? (seen as { checked?: string; version?: string }) : {};
	} catch {
		return {};
	}
}

/** The version npm publishes as nosedive when its y.m.d is newer than the running core's; asked at most once a week, a failed ask saying nothing and tried again next time. */
async function newerCore(dir: string, running: string): Promise<string | undefined> {
	const mine = ymd(running);
	if (!mine) return undefined;
	const record = join(dir, ".nosedive", "local", "npm-latest");
	const seen = existsSync(record) ? lastAsked(record) : {};
	const age = seen.checked ? Date.now() - Date.parse(seen.checked) : Number.NaN;
	let published: string | undefined;
	if (age >= 0 && age < WEEK) published = typeof seen.version === "string" ? seen.version : undefined;
	else {
		try {
			const url = process.env.NOSEDIVE_NPM_LATEST ?? "https://registry.npmjs.org/nosedive/latest";
			const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
			if (!response.ok) return undefined;
			published = String(((await response.json()) as { version?: unknown }).version ?? "");
		} catch {
			return undefined;
		}
		try {
			mkdirSync(dirname(record), { recursive: true });
			writeFileSync(record, `${JSON.stringify({ checked: new Date().toISOString(), version: published })}\n`);
		} catch {
			// A record that cannot be kept only means npm is asked again next time; the answer still counts.
		}
	}
	const theirs = published ? ymd(published) : undefined;
	if (!theirs) return undefined;
	for (let index = 0; index < 3; index += 1) {
		if (theirs[index]! !== mine[index]!) return theirs[index]! > mine[index]! ? published : undefined;
	}
	return undefined;
}
