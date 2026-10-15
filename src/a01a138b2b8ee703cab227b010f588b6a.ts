import { existsSync, readdirSync } from "node:fs";
import type { Bridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./a01a13354845c7253a55b60bba87285d8.ts";
import { a01a138b2b8ed775297973c2aad478c8f as workspaceRepo } from "./a01a138b2b8ed775297973c2aad478c8f.ts";

export function a01a138b2b8ee703cab227b010f588b6a(bridge: Bridge, id: string) {
	const inBridge = findKbDoc(bridge.kbDir, id);
	if (inBridge) return { ...inBridge, repoDir: bridge.dir, kbDir: bridge.kbDir };
	if (bridge.workspace === undefined) return undefined;
	const workspace = bridge.workspace;
	if (!existsSync(workspace)) return undefined;
	for (const entry of readdirSync(workspace, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
		const repo = workspaceRepo(bridge, entry.name);
		const doc = findKbDoc(repo.kbDir, id);
		if (doc) return { ...doc, repoDir: repo.dir, kbDir: repo.kbDir };
	}
	return undefined;
}
