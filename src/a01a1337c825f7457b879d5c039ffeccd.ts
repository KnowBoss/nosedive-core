import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Cape, Ctx } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./a01a1337d2c14754f9772dc22c1f2edfc.ts";
import { a01a1337c810a7456876b831d0c873396 as capeManifest } from "./a01a1337c810a7456876b831d0c873396.ts";
import { a01a1337c806075ca96d637c9ece7316e as capeId } from "./a01a1337c806075ca96d637c9ece7316e.ts";

const COMMIT = /^[0-9a-f]{40}$/;

export async function a01a1337c825f7457b879d5c039ffeccd(ctx: Ctx, action: string, core: Cape): Promise<Cape | undefined> {
	const bridge = findBridge(ctx.cwd);
	const actions = bridge?.config.actions as Record<string, unknown> | undefined;
	const spec = actions?.[action];
	if (!bridge || typeof spec !== "string") return undefined;
	const [repoName, ref = ""] = spec.split("@", 2) as [string, string | undefined];
	const repo = findRepoDoc(bridge, repoName);

	const built = COMMIT.test(ref)
		? capeId(repo.id, ref, core.id)
		: capeManifest(bridge.dir)
				.filter((build) => build.repo === repo.id && build.ref === ref && build.core === core.id)
				.sort((a, b) => a.builtAt.localeCompare(b.builtAt))
				.at(-1)?.id;
	const path = built ? join(bridge.dir, ".nosedive", "capes", `${built}.js`) : undefined;
	if (!path || !existsSync(path)) {
		throw new Error(`${action} needs the ${repoName} cape at ${ref || "its trunk"}, built for this core: run \`nosedive seed\``);
	}
	(globalThis as { __nosediveCore?: Cape }).__nosediveCore = core;
	return (await import(pathToFileURL(path).href)) as Cape;
}
