import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335487317576a0afd03506ef5555 as readSource } from "./i01a1335487317576a0afd03506ef5555.ts";
import { checkDocMeta } from "./i01a138b2b8ef7e8097e19d599ba39bcc.ts";
import { kindOfDoc } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { i01a14ab1d36771eea2bc6f13bdeb0526 as editKbDocs } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a14b30ecc07ea18999d6255d636e39 as crudEdit } from "./i01a14b30ecc07ea18999d6255d636e39.ts";
import { discardMinted, gateEdit } from "./i01a1b453a16c799bb9ce20fad1a9075b.ts";

export async function i2ad1fc06c83d538e8d38e574e99974af(source: string, ctx: Ctx): Promise<void> {
	const items = await readSource(source, ctx);
	if (!Array.isArray(items) || items.length === 0) throw new Error("--batch takes a list of edits");
	const edit = editKbDocs(ctx.cwd, ctx.capes[0]!.version, ctx.capes, (warning) => ctx.err(`nosedive: ${warning}`));
	// A doc's meta is checked once, against its final kind, so kind and meta can change together.
	edit.unchecked = new Set();
	items.forEach((item, index) => {
		const where = `--batch item ${index + 1}`;
		if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${where} is not a mapping`);
		const { quid, ...rest } = item as Record<string, unknown>;
		const keys = Object.keys(rest);
		if (keys.length !== 1) throw new Error(`${where} takes a quid and one edit`);
		try {
			crudEdit(edit, quid, keys[0]!, rest[keys[0]!], ctx);
		} catch (error) {
			throw new Error(`${where}: ${(error as Error).message}`);
		}
	});
	const pending = new Map([...edit.unchecked].map((doc) => [doc.id, kindOfDoc(doc, edit.bridge, ctx.capes).identity]));
	for (const doc of edit.unchecked) {
		try {
			for (const warning of checkDocMeta(doc, edit.bridge, ctx.capes, pending)) ctx.err(`nosedive: ${warning}`);
		} catch (error) {
			throw new Error(`--batch ${doc.id}: ${(error as Error).message}`);
		}
	}
	const discard: string[] = [];
	try {
		await gateEdit(edit, ctx, [], discard);
		ctx.out(edit.commit().join("\n"));
	} catch (error) {
		discardMinted(discard);
		throw error;
	}
}
