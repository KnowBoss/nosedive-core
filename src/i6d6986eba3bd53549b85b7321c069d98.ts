import { relative } from "node:path";
import type { GateCtx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1934563e77ed886f06d04416385ef as localCapes } from "./i01a1934563e77ed886f06d04416385ef.ts";
import { i01a1337c81b57799820f96a757b791d0 as buildCape } from "./i01a1337c81b57799820f96a757b791d0.ts";
import { wornCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";

/**
 * Attaches a local cape: builds it from its directory, and links it from the base's root.
 *
 * The cape's root must be listed in the hero's config roots: seed one with `--at <dir> seed --root-kind cape`. Refuses a cape the base wears already.
 *
 * @param ctx What the pass gives the gate: the cape's root passing through.
 * @returns Nothing; it prints what it attached.
 * @nosedive-feat 01a14b30-ee4e-722f-961d-32bbb99bdb8a
 */
export async function i6d6986eba3bd53549b85b7321c069d98(ctx: GateCtx): Promise<void> {
	const { bridge, doc } = ctx;
	if (!bridge.activeRoot) throw new Error("the hero has no root to wear a cape");
	const name = String(doc.fm.name);
	const cape = localCapes(bridge).find((each) => each.id === doc.id);
	if (!cape) throw new Error(`${name} is no local cape of this hero, whose config roots list the root of each: seed one with \`nosedive --at <dir> seed --root-kind cape\`, or register one seeded already with \`nosedive --at <dir> seed\``);
	if (wornCapes(bridge).some((worn) => worn.id === doc.id)) throw new Error(`the base already wears ${name}`);
	const built = await buildCape(bridge, { id: doc.id, name, remote: "", dir: cape.dir }, "", ctx.core, [], ctx.out);
	ctx.crud(bridge.activeRoot, "links", { [relative(bridge.dir, doc.path).replace(/\\/g, "/")]: { rel: ".cape" } });
	ctx.out(`attached ${name} ${built.version}`);
}
