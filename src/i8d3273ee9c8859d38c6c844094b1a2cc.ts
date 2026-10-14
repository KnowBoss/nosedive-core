import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Ctx } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./a01a1335480147d0686528aee80f8ee34.ts";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./a01a13354845c7253a55b60bba87285d8.ts";
import { a01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./a01a138b2b8ee703cab227b010f588b6a.ts";
import { a01a138b2b8f0793495b66bc7935c93be as hydrateRepo } from "./a01a138b2b8f0793495b66bc7935c93be.ts";

const QUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

export async function i8d3273ee9c8859d38c6c844094b1a2cc(ref: string, ctx: Ctx): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) throw new Error("test runs from a bridge: run `nosedive seed` first");
	const core = ctx.capes[0]!;

	let target: { links: unknown; repoDir: string; label: string };
	const located = QUID.test(ref) ? locateKbDoc(bridge, ref) : undefined;
	if (QUID.test(ref) && !located) throw new Error(`no doc ${ref} in this bridge or its workspace`);
	if (located && located.fm.kind !== "repo") {
		target = { links: located.fm.links, repoDir: located.repoDir, label: String(located.fm.name) };
	} else {
		const name = located ? String(located.fm.name) : ref;
		const repo = hydrateRepo(bridge, name);
		ctx.out(repo.said);
		const own = existsSync(join(repo.dir, ".nosedive", "config.yaml")) ? findBridge(repo.dir) : undefined;
		if (!own || own.dir !== repo.dir) throw new Error(`${name} is not a bridge, so it has no root to link test gates from: seed it`);
		const root = findKbDoc(own.kbDir, String(own.config.backlog));
		if (!root) throw new Error(`${name}'s root, ${String(own.config.backlog)}, is not in its kb`);
		target = { links: root.fm.links, repoDir: repo.dir, label: `${name}'s root` };
	}

	const gates = gateIds(target.links);
	if (gates.length === 0) return ctx.out(`${target.label} links no test.gate`);
	const failed: string[] = [];
	for (const id of gates) {
		const doc = core.docs[id];
		const run = doc?.kind === "gate" ? core.index[namespacedUuid(id, core.id)] : undefined;
		if (typeof run !== "function") {
			ctx.out(`gate ${id}: not one of core's gates, and a repo's own gates are not run yet`);
			failed.push(id);
			continue;
		}
		ctx.out(`gate ${doc!.name}:`);
		try {
			await run({ core, repoDir: target.repoDir, bridgeDir: bridge.dir, out: ctx.out, err: ctx.err });
			ctx.out(`gate ${doc!.name}: passed`);
		} catch (error) {
			ctx.out(`gate ${doc!.name}: failed: ${error instanceof Error ? error.message : String(error)}`);
			failed.push(doc!.name);
		}
	}
	if (failed.length > 0) throw new Error(`${failed.length} of ${gates.length} test gates failed: ${failed.join(", ")}`);
}

/** The ids of the docs a links list names as `test.gate`, in order. */
function gateIds(links: unknown): string[] {
	if (!Array.isArray(links)) return [];
	return links.flatMap((link) =>
		link && typeof link === "object"
			? Object.entries(link as Record<string, { rel?: unknown } | null>)
					.filter(([, value]) => value?.rel === "test.gate")
					.flatMap(([target]) => QUID.exec(target) ?? [])
			: [],
	);
}
