import type { Ctx } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./a01a138b2b8ee703cab227b010f588b6a.ts";

export async function if4a09298430355a2a473394fbb5103f2(quid: string, ctx: Ctx): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	const doc = bridge ? locateKbDoc(bridge, quid) : undefined;
	if (doc) return ctx.out(doc.text.trimEnd());
	for (const cape of ctx.capes) {
		const capeDoc = cape.docs[quid];
		if (capeDoc) return ctx.out(capeDoc.text.trimEnd());
	}
	throw new Error(`no doc ${quid} in ${bridge ? "this bridge, its workspace or " : ""}the loaded capes`);
}
