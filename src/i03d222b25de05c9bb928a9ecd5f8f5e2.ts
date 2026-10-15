import type { Args, Ctx } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./a01a141f869bf7f76b5bc81aa991ff9b9.ts";

export async function i03d222b25de05c9bb928a9ecd5f8f5e2(_args: Args, ctx: Ctx): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const capes = configuredCapes(bridge, ctx.capes[0]!);
	if (capes.length === 0) ctx.out("no capes: add one with `nosedive cape <remote>`");
	for (const { spec, build } of capes) {
		ctx.out(build ? `${spec} ${build.version} (${build.commit.slice(0, 7)})` : `${spec}: not built, run \`nosedive seed\``);
		for (const [action, gist] of Object.entries(build?.actions ?? {})) ctx.out(`  ${action}  ${gist}`);
	}
}
