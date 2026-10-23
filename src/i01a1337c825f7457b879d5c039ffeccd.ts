import type { Cape, Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import { i01a14b30eb0e72e28934c918000a26ac as loadCape } from "./i01a14b30eb0e72e28934c918000a26ac.ts";

/** Loads the configured cape whose build provides `action`, or the one named `only`; undefined when none does. */
export async function i01a1337c825f7457b879d5c039ffeccd(ctx: Ctx, action: string, core: Cape, only?: string): Promise<Cape | undefined> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) {
		if (only) throw new Error(`${only}:${action} names a cape of a ship, and this is no ship`);
		return undefined;
	}
	const capes = configuredCapes(bridge, core);
	if (only) {
		const cape = capes.find((each) => each.name === only);
		if (!cape) throw new Error(`no cape ${only} in this ship's config \`capes\``);
		if (!cape.build) throw new Error(`${only} is not built: run \`nosedive seed\``);
		if (cape.build.actions[action] === undefined) throw new Error(`${only} has no action ${action}`);
		return loadCape(bridge.dir, cape.build, core);
	}
	const providing = capes.filter((cape) => cape.build?.actions?.[action] !== undefined);
	if (providing.length > 1) {
		const names = providing.map((cape) => cape.name);
		throw new Error(`${action} is an action of ${names.join(" and ")}: name one, as ${names.map((cape) => `\`${cape}:${action}\``).join(" or ")}`);
	}
	return providing[0] ? loadCape(bridge.dir, providing[0].build!, core) : undefined;
}
