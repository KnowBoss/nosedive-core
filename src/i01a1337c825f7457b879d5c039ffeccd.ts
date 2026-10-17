import type { Cape, Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import { i01a14b30eb0e72e28934c918000a26ac as loadCape } from "./i01a14b30eb0e72e28934c918000a26ac.ts";

/** Loads the configured cape whose build provides `action`; undefined when none does. */
export async function i01a1337c825f7457b879d5c039ffeccd(ctx: Ctx, action: string, core: Cape): Promise<Cape | undefined> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) return undefined;
	const built = configuredCapes(bridge, core).find((cape) => cape.build?.actions?.[action] !== undefined)?.build;
	if (!built) return undefined;
	return loadCape(bridge.dir, built, core);
}
