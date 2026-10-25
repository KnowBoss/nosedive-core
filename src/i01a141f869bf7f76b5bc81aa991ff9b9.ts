import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./i01a1337d2c14754f9772dc22c1f2edfc.ts";
import { i01a1337c810a7456876b831d0c873396 as capeManifest, type CapeBuild } from "./i01a1337c810a7456876b831d0c873396.ts";

const COMMIT = /^[0-9a-f]{40}$/;

export type ConfiguredCape = {
	/** As config names it: `<repo>` or `<repo>@<ref>`. */
	spec: string;
	name: string;
	/** A branch, tag or commit; empty for the trunk. */
	ref: string;
	/** Its repo doc; undefined when the bridge has none it can clone from. */
	repo?: { id: string; name: string; remote: string };
	/** Its newest build for this core at that ref, if any. */
	build?: CapeBuild;
};

export function i01a141f869bf7f76b5bc81aa991ff9b9(bridge: Bridge, core: Cape): ConfiguredCape[] {
	const specs = bridge.config.capes ?? [];
	if (!Array.isArray(specs) || specs.some((spec) => typeof spec !== "string")) {
		throw new Error("config `capes` lists cape repos, each as <repo> or <repo>@<ref>");
	}
	const builds = capeManifest(bridge.dir);
	const capes: ConfiguredCape[] = [];
	for (const spec of specs as string[]) {
		const [name, ref = ""] = spec.split("@", 2) as [string, string | undefined];
		if (capes.some((cape) => cape.name === name)) throw new Error(`config names ${name} more than once in \`capes\``);
		let repo: ConfiguredCape["repo"];
		try {
			repo = findRepoDoc(bridge, name);
		} catch {
			repo = undefined;
		}
		const build = builds
			.filter((build) => build.repo === repo?.id && build.core === core.id && (COMMIT.test(ref) && !build.source ? build.commit === ref : build.ref === ref))
			.sort((a, b) => a.builtAt.localeCompare(b.builtAt))
			.at(-1);
		capes.push({ spec, name, ref, repo, build });
	}
	return capes;
}
