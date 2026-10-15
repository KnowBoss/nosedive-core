import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type CapeBuild = {
	id: string;
	repo: string;
	ref: string;
	commit: string;
	core: string;
	/** The version of that core, for saying which core last built it. */
	coreVersion: string;
	/** The top-level user actions it provides: name to gist. */
	actions: Record<string, string>;
	/** The capes it imports, by repo name: their ids. */
	needs: Record<string, string>;
	version: string;
	builtAt: string;
};

export function a01a1337c810a7456876b831d0c873396(bridgeDir: string, add?: CapeBuild): CapeBuild[] {
	const dir = join(bridgeDir, ".nosedive", "capes");
	const path = join(dir, "manifest.json");
	const builds = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as CapeBuild[]) : [];
	if (!add) return builds;
	const next = [...builds.filter((build) => build.id !== add.id), add];
	mkdirSync(dir, { recursive: true });
	writeFileSync(path, `${JSON.stringify(next, null, "\t")}\n`);
	return next;
}
