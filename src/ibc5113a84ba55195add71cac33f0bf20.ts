import { spawnSync } from "node:child_process";
import { relative } from "node:path";
import type { Args, Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { kindOfDoc, type KindMeta } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import { i01a18e40518e7f15a2066909dca2be43 as listKinds } from "./i01a18e40518e7f15a2066909dca2be43.ts";
import { i01a1901e263b7209a4b5f39a71c568b3 as featWalk, linkedIds } from "./i01a1901e263b7209a4b5f39a71c568b3.ts";

type Listed = { fm: Record<string, unknown>; path: string; repoDir: string };

export async function ibc5113a84ba55195add71cac33f0bf20(_args: Args, ctx: Ctx): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const gap = trunkGap(bridge.dir, ctx);
	if (gap) ctx.out(`nose: the hero lacks ${gap.missing} commits origin's trunk has: rebase onto ${gap.trunk} before trusting this list`);

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
		if (!doc || kindOf(doc).kind?.durable === true) continue;
		const leaf = !linkedIds(doc).some(({ rel }) => typeof rel === "string" && rel.endsWith(".feat") && rel !== "parent.feat");
		if (leaf) list(node.parents[0]!, doc);
	}
	const declared = new Set(kindGroups.flatMap((group) => group.kinds.flatMap(({ meta }) => meta.next ?? [])));
	for (const [id, from] of walk.docs) {
		for (const { id: target, rel } of linkedIds(from)) {
			if (typeof rel !== "string" || rel.endsWith(".feat") || !declared.has(rel)) continue;
			const doc = locateKbDoc(bridge, target);
			const kind = doc && kindOf(doc).kind;
			if (kind && kind.durable !== true && kind.next?.includes(rel)) list(id, doc);
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
			lines.push(`  ${spell(found)} ${String(doc.fm.name)}  ${at(doc)}`, `    done when: ${found.kind?.doneWhen ?? "its kind does not say; read the doc"}`);
		}
	}
	ctx.out(lines.length > 0 ? lines.join("\n") : "nothing left to do");
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
