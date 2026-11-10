import { spawnSync } from "node:child_process";
import { relative } from "node:path";
import type { GateCtx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1337c81b57799820f96a757b791d0 as buildCape } from "./i01a1337c81b57799820f96a757b791d0.ts";
import { i01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./i01a1337d2c14754f9772dc22c1f2edfc.ts";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";
import { wornCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";

const COMMIT = /^[0-9a-f]{40}$/;

export async function ib1271b71723d57c39b4dd36252311704(ctx: GateCtx): Promise<void> {
	const { bridge, doc } = ctx;
	if (!bridge.activeRoot) throw new Error("the hero has no root to wear a cape");
	const name = String(doc.fm.name);
	const worn = wornCapes(bridge).find((cape) => cape.id === doc.id);
	const repo = findRepoDoc(bridge, name);
	const ref = typeof ctx.args.ref === "string" ? ctx.args.ref : (worn?.follow ?? "");
	const commit = resolve(bridge.dir, repo.remote, ref);
	const built = await buildCape(bridge, repo, commit, ctx.core, [], ctx.out);
	// Built from where build-cape keeps the clone.
	const root = findRoot(`${bridge.dir}/.nosedive/capes/src/${repo.id}`, "cape");
	// The repo doc's name is the hero's own for the cape; its short name is its root's, which the hero does not choose.
	if (!root) throw new Error(`${name} is no cape: it has no cape root`);
	const key = relative(bridge.dir, doc.path).replace(/\\/g, "/");
	// Re-attaching leaves the rel, and any sect it names, as it is. A link keyed by an older path of the repo doc, as legacy's `kb/<id>.md`,
	// is the same link: it is repinned and rekeyed to where the doc is now, never doubled (attach-cape-repins-moved-link).
	const moved = worn && worn.key !== key ? { [worn.key]: null, [key]: { ...worn.link } } : {};
	ctx.crud(bridge.activeRoot, "links", { ...moved, [key]: { ...moved[key], ...(worn ? {} : { rel: ".cape" }), ...(ref ? { ref } : {}), commit } });
	ctx.out(`${worn ? "re-attached" : "attached"} ${ref ? `${name}@${ref}` : name} ${built.version} (${commit.slice(0, 7)})`);
}

/** The commit `ref` names on the cape's origin: a branch's tip, a tag's commit, or origin's HEAD when empty; a commit names itself. */
function resolve(cwd: string, remote: string, ref: string): string {
	if (COMMIT.test(ref)) return ref;
	const wanted = ref ? [`refs/heads/${ref}`, `refs/tags/${ref}^{}`, `refs/tags/${ref}`] : ["HEAD"];
	const result = spawnSync("git", ["ls-remote", remote, ...wanted], { cwd, encoding: "utf8" });
	if (result.status !== 0) throw new Error(`cannot resolve ${ref || "the trunk"} on ${remote}: ${(result.stderr || result.stdout).trim()}`);
	const found = new Map(result.stdout.split("\n").filter(Boolean).map((line) => line.split("\t").reverse() as [string, string]));
	const sha = wanted.map((name) => found.get(name)).find(Boolean);
	if (!sha) throw new Error(`${remote} has no branch or tag ${ref}`);
	return sha;
}
