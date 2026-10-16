import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a14717207d7277a493c7adb10ed32f as splitTitle } from "./i01a14717207d7277a493c7adb10ed32f.ts";
import { i01a14717221479ddbcac26cce4b2a059 as updateKbDocBody } from "./i01a14717221479ddbcac26cce4b2a059.ts";

export async function i933f159845875010ad6ed3569414a651(quid: string, title: string, ctx: Ctx): Promise<void> {
	if (!title.trim()) throw new Error("--title takes a title");
	const path = updateKbDocBody(ctx.cwd, quid, (body) => {
		const under = splitTitle(body)?.under ?? body;
		return `\n# ${title.trim()}\n${under.trim() ? `\n${under.trim()}\n` : ""}`;
	});
	ctx.out(path);
}
