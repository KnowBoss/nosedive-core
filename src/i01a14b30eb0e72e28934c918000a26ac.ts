import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1337c810a7456876b831d0c873396 as capeManifest, type CapeBuild } from "./i01a1337c810a7456876b831d0c873396.ts";

type Loaded = { __nosediveCore?: Cape; __nosediveCapes?: Record<string, Cape> };

/** Each cape loads once per process; one this core has not built is refused. */
export async function i01a14b30eb0e72e28934c918000a26ac(bridgeDir: string, build: CapeBuild, core: Cape): Promise<Cape> {
	(globalThis as Loaded).__nosediveCore = core;
	return load(bridgeDir, build, capeManifest(bridgeDir), `${build.repo} needs capes this core has not built: run \`nosedive seed\``);
}

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
