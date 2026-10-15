import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Cape, Ctx } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a1337c810a7456876b831d0c873396 as capeManifest, type CapeBuild } from "./a01a1337c810a7456876b831d0c873396.ts";
import { a01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./a01a141f869bf7f76b5bc81aa991ff9b9.ts";

type Loaded = { __nosediveCore?: Cape; __nosediveCapes?: Record<string, Cape> };

/** Loads the configured cape whose build provides `action`; undefined when none does. */
export async function a01a1337c825f7457b879d5c039ffeccd(ctx: Ctx, action: string, core: Cape): Promise<Cape | undefined> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) return undefined;
	const built = configuredCapes(bridge, core).find((cape) => cape.build?.actions?.[action] !== undefined)?.build;
	if (!built) return undefined;
	const missing = `${action} needs capes this core has not built: run \`nosedive seed\``;
	(globalThis as Loaded).__nosediveCore = core;
	return load(bridge.dir, built, capeManifest(bridge.dir), missing);
}

/** Loads a cape after the capes it imports, each published where their imports look for it. */
async function load(bridgeDir: string, build: CapeBuild, builds: CapeBuild[], missing: string): Promise<Cape> {
	const loaded = ((globalThis as Loaded).__nosediveCapes ??= {});
	if (loaded[build.id]) return loaded[build.id]!;
	for (const id of Object.values(build.needs ?? {})) {
		const needed = builds.find((candidate) => candidate.id === id);
		if (!needed) throw new Error(missing);
		await load(bridgeDir, needed, builds, missing);
	}
	const path = join(bridgeDir, ".nosedive", "capes", `${build.id}.js`);
	if (!existsSync(path)) throw new Error(missing);
	loaded[build.id] = (await import(pathToFileURL(path).href)) as Cape;
	return loaded[build.id]!;
}
