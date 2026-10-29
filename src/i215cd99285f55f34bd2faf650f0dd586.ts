import type { GateCtx } from "./i01a1336a958f71c7beec4db3195c7966.ts";

export async function i439dab683e1b51e5a0e7d0430aa1348a(ctx: GateCtx): Promise<void> {
	const { bridge, doc } = ctx;
	const base = bridge.base ? ctx.edit.doc(bridge.base) : undefined;
	const links = Array.isArray(base?.fm.links) ? (base.fm.links as Record<string, { rel?: unknown } | null>[]) : [];
	const keys = links.flatMap((link) => Object.entries(link ?? {})).filter(([key, value]) => key.includes(doc.id) && typeof value?.rel === "string" && value.rel.split(".").at(-1) === "cape").map(([key]) => key);
	if (keys.length === 0) throw new Error(`the base does not wear ${String(doc.fm.name)}`);
	ctx.crud(bridge.base!, "links", Object.fromEntries(keys.map((key) => [key, null])));
	ctx.out(`took off ${String(doc.fm.name)}`);
}
