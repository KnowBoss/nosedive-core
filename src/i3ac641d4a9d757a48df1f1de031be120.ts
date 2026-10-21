import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a13354867d7a528cbad55b80708e50 as mergePatch } from "./i01a13354867d7a528cbad55b80708e50.ts";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";
import { i01a138b2b8ef7e8097e19d599ba39bcc as checkMeta } from "./i01a138b2b8ef7e8097e19d599ba39bcc.ts";

export function i3ac641d4a9d757a48df1f1de031be120(edit: KbEdit, quid: string, patch: unknown, ctx: Ctx): void {
	if (patch === null || typeof patch !== "object" || Array.isArray(patch)) throw new Error("--meta takes a mapping");
	edit.unchecked?.add(edit.doc(quid));
	updateKbDocField(edit, quid, "meta", (meta, doc) => {
		const next = mergePatch(meta ?? {}, patch);
		if (edit.unchecked) return next;
		const warning = checkMeta(String(doc.fm.kind), next, [doc.kbDir, edit.bridge.kbDir], ctx.capes, edit.bridge);
		if (warning) ctx.err(`nosedive: ${warning}`);
		return next;
	});
}
