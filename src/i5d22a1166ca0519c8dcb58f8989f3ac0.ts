import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a18e40518e7f15a2066909dca2be43 as listKinds } from "./i01a18e40518e7f15a2066909dca2be43.ts";

export async function i5d22a1166ca0519c8dcb58f8989f3ac0(ctx: Ctx): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const groups = listKinds(bridge, ctx.capes).map((group) => [
		group.name,
		...group.kinds
			.map((kind) => {
				// The spellings share their name, so what differs is how the owner is called.
				const owners = kind.spellings.map((spelling) => spelling.slice(0, -kind.name.length - 1));
				return group.owner === bridge.id ? kind.name : `${owners.length > 1 ? `(${owners.join("|")})` : owners[0]}:${kind.name}`;
			})
			.sort()
			.map((spelling) => `  ${spelling}`),
	]);
	ctx.out(groups.map((lines) => lines.join("\n")).join("\n\n"));
}
