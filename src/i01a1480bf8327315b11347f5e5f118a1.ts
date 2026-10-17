import { existsSync, readdirSync, rmSync } from "node:fs";
import { relative } from "node:path";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a138b2b8ed775297973c2aad478c8f as workspaceRepo } from "./i01a138b2b8ed775297973c2aad478c8f.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a147171f057d019118aaa1f269f5fd as findKind } from "./i01a147171f057d019118aaa1f269f5fd.ts";

/** Returns the dropped docs' paths relative to the bridge. */
export function i01a1480bf8327315b11347f5e5f118a1(cwd: string, ids: string[], hard: boolean, capes: Cape[]): string[] {
	const bridge = findBridge(cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const at = (path: string) => relative(bridge.dir, path).replace(/\\/g, "/");
	const docs = [...new Set(ids)].map((id) => {
		const doc = locateKbDoc(bridge, id);
		if (!doc) throw new Error(`no doc ${id} in the bridge or its workspace`);
		return { id, doc, label: `${String(doc.fm.kind)} ${String(doc.fm.name)}` };
	});
	const dropping = new Set(docs.map(({ id }) => id));
	const one = docs.length === 1;
	const labelOf = new Map(docs.map(({ id, label }) => [id, label]));

	// Every kb a link to them could live in: the bridge's, and each repo checked out in its workspace.
	const kbDirs = [bridge.kbDir];
	const repoDirs = [bridge.dir];
	if (bridge.workspace && existsSync(bridge.workspace)) {
		for (const entry of readdirSync(bridge.workspace, { withFileTypes: true })) {
			if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
			const repo = workspaceRepo(bridge, entry.name);
			kbDirs.push(repo.kbDir);
			repoDirs.push(repo.dir);
		}
	}
	const blockers: string[] = [];
	const block = (id: string, why: string) => blockers.push(one ? why : `${labelOf.get(id)}: ${why}`);
	for (const kbDir of kbDirs) {
		if (!existsSync(kbDir)) continue;
		for (const other of listKbDocs(kbDir)) {
			if (dropping.has(String(other.fm.id))) continue;
			for (const link of Array.isArray(other.fm.links) ? other.fm.links : []) {
				for (const [target, value] of Object.entries((link ?? {}) as Record<string, { rel?: unknown } | null>)) {
					for (const id of dropping) if (target.includes(id)) block(id, `${at(other.path)} links it as ${String(value?.rel ?? "a link")}`);
				}
			}
			for (const id of dropping) if (other.body.includes(id)) block(id, `${at(other.path)} mentions it in its body`);
		}
	}
	for (const repoDir of repoDirs) {
		const config = readRepoConfig(repoDir);
		if (config?.root && dropping.has(config.root)) block(config.root, `${at(config.configPath)} names it as its root`);
	}
	if (blockers.length > 0) {
		const head = one ? `${docs[0]!.label} is still linked, so it was not dropped` : `docs outside the list still link to these, so none was dropped`;
		throw new Error(`${head}:\n  ${blockers.join("\n  ")}`);
	}

	if (!hard) {
		const durable = docs.filter(({ doc }) => findKind(String(doc.fm.kind), [doc.kbDir, bridge.kbDir], capes)?.durable === true);
		if (one && durable.length) throw new Error(`${durable[0]!.label} is durable: its file keeps it findable by id, so it was not dropped; --hard drops it anyway`);
		if (durable.length) {
			throw new Error(`${durable.length} of these are durable, so none was dropped; --hard drops them anyway:\n  ${durable.map(({ label }) => label).join("\n  ")}`);
		}
	}

	const byRepo = new Map<string, typeof docs>();
	for (const entry of docs) {
		rmSync(entry.doc.path);
		byRepo.set(entry.doc.repoDir, [...(byRepo.get(entry.doc.repoDir) ?? []), entry]);
	}
	for (const [repoDir, dropped] of byRepo) {
		const message = dropped.length === 1 ? `crud(${dropped[0]!.id}): dropped ${dropped[0]!.label}` : `crud: dropped ${dropped.length} docs`;
		commitFiles(repoDir, dropped.map(({ doc }) => doc.path), message);
	}
	return docs.map(({ doc }) => at(doc.path));
}
