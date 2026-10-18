import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./i01a1335480147d0686528aee80f8ee34.ts";
import { i01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { i01a1335488937f1c8c3983dd2950028e as checkCapeSource } from "./i01a1335488937f1c8c3983dd2950028e.ts";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";
import { i01a14fb7a14b7f85b7dc8bb894d6e76b as bundleCape } from "./i01a14fb7a14b7f85b7dc8bb894d6e76b.ts";

type Loaded = { __nosediveCore?: Cape; __nosediveBase?: Record<string, Cape> };

export async function i01a14fb79db47f8b94d5196027008697(bridge: Bridge, core: Cape): Promise<Cape | undefined> {
	const root = findRoot(bridge.dir);
	if (root?.kind !== "base") return undefined;
	const source = describeCapeSource(bridge.dir);
	if (source.entries.length === 0) return undefined;

	// The id covers the core and every code doc and file, so any edit makes a new build.
	const hash = createHash("sha256").update(core.id);
	for (const entry of [...source.entries].sort((a, b) => a.id.localeCompare(b.id))) hash.update(`\0${source.docs[entry.id]!.text}`);
	const src = join(bridge.dir, "src");
	for (const file of existsSync(src) ? readdirSync(src).sort() : []) hash.update(`\0${file}\0`).update(readFileSync(join(src, file)));
	const id = namespacedUuid(hash.digest("hex"), core.id);

	const loaded = ((globalThis as Loaded).__nosediveBase ??= {});
	if (loaded[id]) return loaded[id];
	const capes = join(bridge.dir, ".nosedive", "capes");
	const outfile = join(capes, `base-${id}.js`);
	const name = String(root.fm.name);
	if (!existsSync(outfile)) {
		const problems = checkCapeSource(bridge.dir);
		if (problems.length > 0) throw new Error(`${name}'s own actions do not check out:\n  ${problems.join("\n  ")}`);
		await bundleCape(source, { id, name, commit: "", version: "working tree", core: core.id, needs: {} }, [{ specifier: "nosedive-core", capeId: core.id, ids: Object.keys(core.docs) }], outfile);
		// Only the newest build of a base is kept.
		for (const file of readdirSync(capes)) if (file.startsWith("base-") && file !== `base-${id}.js`) rmSync(join(capes, file), { recursive: true, force: true });
	}
	(globalThis as Loaded).__nosediveCore = core;
	loaded[id] = (await import(pathToFileURL(outfile).href)) as Cape;
	return loaded[id];
}
