import { join } from "node:path";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1934563e77ed886f06d04416385ef as localCapes } from "./i01a1934563e77ed886f06d04416385ef.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./i01a1337d2c14754f9772dc22c1f2edfc.ts";
import { i01a1337c810a7456876b831d0c873396 as capeManifest, type CapeBuild } from "./i01a1337c810a7456876b831d0c873396.ts";

const COMMIT = /^[0-9a-f]{40}$/;
const QUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.md)?$/;

export type ConfiguredCape = {
	/** As messages name it: `<repo>` or `<repo>@<ref>`. */
	spec: string;
	name: string;
	/** What builds use: the link's commit pin, else its branch, tag or commit; empty for the trunk. */
	ref: string;
	/** Its repo doc; undefined when the bridge has none it can clone from. */
	repo?: { id: string; name: string; remote: string; dir?: string };
	/** Its newest build for this core at that ref, if any. */
	build?: CapeBuild;
};

/** A link key naming the root of one of the hero's local capes: that cape, built from where it lies. */
function localCape(bridge: Bridge, key: string): { id: string; name: string; dir: string } | undefined {
	const id = QUID.exec(key)?.[1];
	const found = id ? localCapes(bridge).find((cape) => cape.id === id) : undefined;
	return found ? { id: found.id, name: found.name, dir: found.dir } : undefined;
}

/** The capes the target root wears: its links whose rel's role is `cape`, each to a repo doc; `ref` is what builds use, its `commit` pin when it has one, `follow` its own `ref`. */
export function wornCapes(bridge: Bridge): { id: string; name: string; ref: string; follow: string; dir?: string }[] {
	const base = bridge.roots.find((root) => root.id === bridge.activeRoot);
	const doc = base ? findKbDoc(base.dir, base.id) : undefined;
	const links = Array.isArray(doc?.fm.links) ? (doc.fm.links as unknown[]) : [];
	return links.flatMap((link) =>
		Object.entries((link ?? {}) as Record<string, { rel?: unknown; ref?: unknown; commit?: unknown } | null>).flatMap(([key, value]) => {
			if (typeof value?.rel !== "string" || value.rel.split(".").at(-1) !== "cape") return [];
			const id = QUID.exec(key)?.[1];
			const repo = id ? findKbDoc(bridge.reposDir ?? join(bridge.dir, ".nosedive", "repos"), id) : undefined;
			if (!repo) {
				const local = localCape(bridge, key);
				if (local) return [{ ...local, ref: "", follow: "" }];
				throw new Error(`the base ${String(doc!.fm.name)} wears ${key}, which is no repo doc or local cape`);
			}
			const follow = typeof value.ref === "string" ? value.ref : "";
			return [{ id: id!, name: String(repo.fm.name), ref: typeof value.commit === "string" && COMMIT.test(value.commit) ? value.commit : follow, follow }];
		}),
	);
}

export function i01a141f869bf7f76b5bc81aa991ff9b9(bridge: Bridge, core: Cape): ConfiguredCape[] {
	const builds = capeManifest(bridge.dir);
	return wornCapes(bridge).map(({ id, name, ref, follow, dir }) => {
		let repo: ConfiguredCape["repo"];
		try {
			repo = dir ? { id, name, remote: "", dir } : findRepoDoc(bridge, name);
		} catch {
			repo = undefined;
		}
		const build = builds
			.filter((build) => build.repo === repo?.id && build.core === core.id && (COMMIT.test(ref) && !build.source ? build.commit === ref : build.ref === ref))
			.sort((a, b) => a.builtAt.localeCompare(b.builtAt))
			.at(-1);
		return { spec: follow ? `${name}@${follow}` : name, name, ref, repo, build };
	});
}
