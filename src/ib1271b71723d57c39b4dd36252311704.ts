import { relative } from "node:path";
import type { GateCtx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1337c81b57799820f96a757b791d0 as buildCape } from "./i01a1337c81b57799820f96a757b791d0.ts";
import { i01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./i01a1337d2c14754f9772dc22c1f2edfc.ts";
import { i01a13a6aba3a763595bd67a4ee4d47bf as findRoot } from "./i01a13a6aba3a763595bd67a4ee4d47bf.ts";
import { wornCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";

export async function ib1271b71723d57c39b4dd36252311704(ctx: GateCtx): Promise<void> {
	const { bridge, doc } = ctx;
	if (!bridge.base) throw new Error("the hero has no root to wear a cape");
	const name = String(doc.fm.name);
	if (wornCapes(bridge).some((cape) => cape.id === doc.id)) throw new Error(`the base already wears ${name}`);
	const repo = findRepoDoc(bridge, name);
	const ref = typeof ctx.args.ref === "string" ? ctx.args.ref : "";
	const built = await buildCape(bridge, repo, ref, ctx.core, [], ctx.out);
	// Built from where build-cape keeps the clone, or the workspace checkout it prefers.
	const root = findRoot(built.source ?? `${bridge.dir}/.nosedive/capes/src/${repo.id}`, "cape");
	// The repo doc's name is the hero's own for the cape; its short name is its root's, which the hero does not choose.
	if (!root) throw new Error(`${name} is no cape: it has no cape root`);
	const key = relative(bridge.dir, doc.path).replace(/\\/g, "/");
	ctx.crud(bridge.base, "links", { [key]: { rel: ".cape", ...(ref ? { ref } : {}) } });
	ctx.out(`attached ${ref ? `${name}@${ref}` : name} ${built.version} (${built.commit.slice(0, 7)})`);
}
