import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a18e40518e7f15a2066909dca2be43 as listKinds } from "./i01a18e40518e7f15a2066909dca2be43.ts";

/**
 * Lists the kinds a doc can be minted as.
 *
 * Prints a group for each owner of kinds the hero reads, and under it the kinds it declares, each spelled as `crud <kind> <gist>` takes it: bare for the hero's own kinds, `<owner>:<kind>` for any other.
 *
 * @param ctx Where it runs, and how it reads and prints.
 * @returns Nothing; it prints the groups.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export async function i5d22a1166ca0519c8dcb58f8989f3ac0(ctx: Ctx): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const groups = listKinds(bridge, ctx.capes)
		.filter((group) => group.owner === bridge.id || group.kinds.length > 0)
		.map((group) => [
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
