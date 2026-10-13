import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Cape, Ctx } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./a01a1337d2c14754f9772dc22c1f2edfc.ts";
import { a01a1337c810a7456876b831d0c873396 as capeManifest, type CapeBuild } from "./a01a1337c810a7456876b831d0c873396.ts";

const COMMIT = /^[0-9a-f]{40}$/;
type Loaded = { __nosediveCore?: Cape; __nosediveCapes?: Record<string, Cape> };

export async function a01a1337c825f7457b879d5c039ffeccd(ctx: Ctx, action: string, core: Cape): Promise<Cape | undefined> {
	const bridge = findBridge(ctx.cwd);
	const actions = bridge?.config.actions as Record<string, unknown> | undefined;
	const spec = actions?.[action];
	if (!bridge || typeof spec !== "string") return undefined;
	const [repoName, ref = ""] = spec.split("@", 2) as [string, string | undefined];
	const repo = findRepoDoc(bridge, repoName);

	const builds = capeManifest(bridge.dir);
	const built = builds
		.filter((build) => build.repo === repo.id && build.core === core.id && (COMMIT.test(ref) ? build.commit === ref : build.ref === ref))
		.sort((a, b) => a.builtAt.localeCompare(b.builtAt))
		.at(-1);
	const missing = `${action} needs the ${repoName} cape at ${ref || "its trunk"}, built for this core: run \`nosedive seed\``;
	if (!built) throw new Error(missing);
	(globalThis as Loaded).__nosediveCore = core;
	return load(bridge.dir, built, builds, missing);
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
