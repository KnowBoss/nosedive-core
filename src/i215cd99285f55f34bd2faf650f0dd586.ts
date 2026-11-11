import type { GateCtx } from "./i01a1336a958f71c7beec4db3195c7966.ts";

/**
 * Detaches a registered cape: drops the base root's `.cape` link to it.
 *
 * Removes each link on the base's root keyed by the cape's doc whose rel ends in `cape`. Refuses a cape the base does not wear.
 *
 * @param ctx What the pass gives the gate: the repo doc passing through.
 * @returns Nothing; it prints what it detached.
 * @nosedive-feat 01a14b30-ee4e-722f-961d-32bbb99bdb8a
 */
export async function i215cd99285f55f34bd2faf650f0dd586(ctx: GateCtx): Promise<void> {
	const { bridge, doc } = ctx;
	const base = bridge.activeRoot ? ctx.edit.doc(bridge.activeRoot) : undefined;
	const links = Array.isArray(base?.fm.links) ? (base.fm.links as Record<string, { rel?: unknown } | null>[]) : [];
	const keys = links.flatMap((link) => Object.entries(link ?? {})).filter(([key, value]) => key.includes(doc.id) && typeof value?.rel === "string" && value.rel.split(".").at(-1) === "cape").map(([key]) => key);
	if (keys.length === 0) throw new Error(`the base does not wear ${String(doc.fm.name)}`);
	ctx.crud(bridge.activeRoot!, "links", Object.fromEntries(keys.map((key) => [key, null])));
	ctx.out(`detached ${String(doc.fm.name)}`);
}
