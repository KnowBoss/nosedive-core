import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import { i01a14b30eb0e72e28934c918000a26ac as loadCape } from "./i01a14b30eb0e72e28934c918000a26ac.ts";

export async function if4a09298430355a2a473394fbb5103f2(quid: string, ctx: Ctx): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	const doc = bridge ? locateKbDoc(bridge, quid) : undefined;
	if (doc) return ctx.out(doc.text.trimEnd());
	for (const cape of ctx.capes) {
		const capeDoc = cape.docs[quid];
		if (capeDoc) return ctx.out(capeDoc.text.trimEnd());
	}
	// A worn cape not loaded for this action is loaded to read its docs, its migrations' included.
	for (const worn of bridge ? configuredCapes(bridge, ctx.capes[0]!) : []) {
		if (!worn.build) continue;
		const capeDoc = (await loadCape(bridge!.dir, worn.build, ctx.capes[0]!)).docs[quid];
		if (capeDoc) return ctx.out(capeDoc.text.trimEnd());
	}
	throw new Error(`no doc ${quid} in ${bridge ? "this bridge, its workspace or " : ""}the loaded capes`);
}
