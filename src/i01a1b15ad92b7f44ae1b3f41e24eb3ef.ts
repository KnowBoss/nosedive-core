import { existsSync } from "node:fs";
import { join } from "node:path";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./i01a1335483aa776cb84df698b04adc06.ts";
import type { MigrationCtx } from "./i01a175dbf4517dafa3a9048ecd98ab84.ts";

/** An scp-style remote, `user@host:path`, which git takes for ssh and core for a path. */
const SCP = /^([^@\s/]+)@([^:\s/]+):(?!\/)(.+)$/;

export function i01a1b15ad92b7f44ae1b3f41e24eb3ef(dir: string, ctx: MigrationCtx): string[] {
	const repos = join(dir, ".nosedive", "repos");
	if (!existsSync(repos)) return [];
	const changed: string[] = [];
	for (const doc of listKbDocs(repos)) {
		const { yaml } = doc;
		let edited = false;
		const cloud = yaml.getIn(["meta", "remotes", "cloud"]);
		if (typeof cloud === "string" && !yaml.hasIn(["meta", "remotes", "origin"])) {
			yaml.setIn(["meta", "remotes", "origin"], cloud.replace(SCP, "ssh://$1@$2/$3"));
			yaml.deleteIn(["meta", "remotes", "cloud"]);
			edited = true;
		}
		const legacyTrunk = ["default-branch", "base-branch"].map((key) => yaml.getIn(["meta", key])).find((value) => typeof value === "string");
		if (typeof legacyTrunk === "string" && !yaml.hasIn(["meta", "trunk"])) yaml.setIn(["meta", "trunk"], legacyTrunk);
		for (const key of ["default-branch", "base-branch"]) {
			if (yaml.hasIn(["meta", key])) {
				yaml.deleteIn(["meta", key]);
				edited = true;
			}
		}
		if (!edited) continue;
		writeKbDoc(doc.path, yaml, doc.body);
		changed.push(doc.path);
	}
	if (changed.length > 0) ctx.out(`legacy-repo-meta: rewrote ${changed.length} repo doc${changed.length === 1 ? "" : "s"} to core's origin and trunk`);
	return changed;
}
