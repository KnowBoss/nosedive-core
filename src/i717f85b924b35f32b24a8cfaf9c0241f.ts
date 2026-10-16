import { existsSync, readdirSync, rmSync } from "node:fs";
import { relative } from "node:path";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a138b2b8ed775297973c2aad478c8f as workspaceRepo } from "./i01a138b2b8ed775297973c2aad478c8f.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a147171f057d019118aaa1f269f5fd as findKind } from "./i01a147171f057d019118aaa1f269f5fd.ts";

export async function i717f85b924b35f32b24a8cfaf9c0241f(quid: string, hard: boolean, ctx: Ctx): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const doc = locateKbDoc(bridge, quid);
	if (!doc) throw new Error(`no doc ${quid} in the bridge or its workspace`);
	const at = (path: string) => relative(bridge.dir, path).replace(/\\/g, "/");
	const label = `${String(doc.fm.kind)} ${String(doc.fm.name)}`;

	// Every kb a link to it could live in: the bridge's, and each repo checked out in its workspace.
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
	for (const kbDir of kbDirs) {
		if (!existsSync(kbDir)) continue;
		for (const other of listKbDocs(kbDir)) {
			if (other.fm.id === quid) continue;
			for (const link of Array.isArray(other.fm.links) ? other.fm.links : []) {
				for (const [target, value] of Object.entries((link ?? {}) as Record<string, { rel?: unknown } | null>)) {
					if (target.includes(quid)) blockers.push(`${at(other.path)} links it as ${String(value?.rel ?? "a link")}`);
				}
			}
			if (other.body.includes(quid)) blockers.push(`${at(other.path)} mentions it in its body`);
		}
	}
	for (const repoDir of repoDirs) {
		const config = readRepoConfig(repoDir);
		if (config?.root === quid) blockers.push(`${at(config.configPath)} names it as its root`);
	}
	if (blockers.length > 0) throw new Error(`${label} is still linked, so it was not dropped:\n  ${blockers.join("\n  ")}`);

	if (!hard && findKind(String(doc.fm.kind), [doc.kbDir, bridge.kbDir], ctx.capes)?.durable === true) {
		throw new Error(`${label} is durable: its file keeps it findable by id, so it was not dropped; --hard drops it anyway`);
	}
	rmSync(doc.path);
	commitFiles(doc.repoDir, [doc.path], `crud(${quid}): dropped ${label}`);
	ctx.out(at(doc.path));
}
