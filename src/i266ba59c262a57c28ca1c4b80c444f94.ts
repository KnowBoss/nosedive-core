import { readFileSync, writeFileSync } from "node:fs";
import { parseDocument } from "yaml";
import type { Args, Ctx } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a13354894273b1be253424511ba82c as commitFiles } from "./a01a13354894273b1be253424511ba82c.ts";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./a01a141f869bf7f76b5bc81aa991ff9b9.ts";

export async function i266ba59c262a57c28ca1c4b80c444f94(args: Args, ctx: Ctx): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const name = String(args.name);
	const specs = configuredCapes(bridge, ctx.capes[0]!).map((cape) => cape.spec);
	const kept = specs.filter((spec) => spec.split("@")[0] !== name);
	if (kept.length === specs.length) throw new Error(`${name} is not in config \`capes\``);
	const config = parseDocument(readFileSync(bridge.configPath, "utf8"));
	if (kept.length > 0) config.set("capes", kept);
	else config.delete("capes");
	writeFileSync(bridge.configPath, config.toString({ lineWidth: 0 }));
	commitFiles(bridge.dir, [bridge.configPath], `cape: dropped ${name}`);
	ctx.out(`dropped cape ${name}`);
}
