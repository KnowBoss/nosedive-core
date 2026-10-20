import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";
import { i01a138b2b8ef7e8097e19d599ba39bcc as checkMeta } from "./i01a138b2b8ef7e8097e19d599ba39bcc.ts";

export function i5225ca8db7b85be197b4b22ee341b5f1(edit: KbEdit, quid: string, kind: string, ctx: Ctx): void {
	if (!/^[a-z0-9][a-z0-9.-]*$/.test(kind)) throw new Error(`--kind must be lowercase letters, digits, dots and dashes: ${kind}`);
	updateKbDocField(edit, quid, "kind", (_kind, doc) => {
		const warning = checkMeta(kind, doc.fm.meta, [doc.kbDir, edit.bridge.kbDir], ctx.capes, edit.bridge);
		if (warning) ctx.err(`nosedive: ${warning}`);
		return kind;
	});
}
