import { join, resolve } from "node:path";
import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./i01a1335480147d0686528aee80f8ee34.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";

/** A relative `home` is relative to the bridge. */
export function i01a14ac0044f7142a4623b2b7eff2eb5(bridge: Bridge, name: string): string | undefined {
	const home = bridge.config.home;
	if (home === undefined || home === null) return undefined;
	if (typeof home !== "string" || !home) throw new Error("config `home` must be a path");
	if (!bridge.id) throw new Error("a bridge with no id cannot name its repos' home copies");
	return join(resolve(bridge.dir, home), `${namespacedUuid(name, bridge.id)}.git`);
}
