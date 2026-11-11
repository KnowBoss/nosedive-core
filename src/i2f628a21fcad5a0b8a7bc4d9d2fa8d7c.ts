import type { GateCtx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i215cd99285f55f34bd2faf650f0dd586 as detach } from "./i215cd99285f55f34bd2faf650f0dd586.ts";

/**
 * Detaches a local cape: drops the base root's `.cape` link to it.
 *
 * A local cape is worn by a link keyed by its root doc, which is all detaching a registered one looks for too, so this does what `--detach-cape <repo>` does.
 *
 * @param ctx What the pass gives the gate: the cape's root passing through.
 * @returns Nothing; it prints what it detached.
 * @nosedive-feat 01a14b30-ee4e-722f-961d-32bbb99bdb8a
 */
export async function i2f628a21fcad5a0b8a7bc4d9d2fa8d7c(ctx: GateCtx): Promise<void> {
	return detach(ctx);
}
