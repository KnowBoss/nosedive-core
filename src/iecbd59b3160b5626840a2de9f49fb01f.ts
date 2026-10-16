import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a14717207d7277a493c7adb10ed32f as splitTitle } from "./i01a14717207d7277a493c7adb10ed32f.ts";
import { i01a14717221479ddbcac26cce4b2a059 as updateKbDocBody } from "./i01a14717221479ddbcac26cce4b2a059.ts";
import { i01a1471723807d6e8ef228ad9472fff7 as readText } from "./i01a1471723807d6e8ef228ad9472fff7.ts";

export async function iecbd59b3160b5626840a2de9f49fb01f(quid: string, source: string, ctx: Ctx): Promise<void> {
	const text = await readText(source, ctx);
	const path = updateKbDocBody(ctx.cwd, quid, (body) => {
		const split = splitTitle(body);
		if (!split) throw new Error(`${quid} has no title: set one with \`nosedive crud ${quid} --title <title>\` first`);
		return `\n# ${split.title}\n${text.trim() ? `\n${text.trim()}\n` : ""}`;
	});
	ctx.out(path);
}
