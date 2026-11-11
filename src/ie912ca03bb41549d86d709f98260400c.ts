import type { GateCtx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a138b2b8f175bc95242dc33d92138b as runRepoTests } from "./i01a138b2b8f175bc95242dc33d92138b.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";

/**
 * Runs a cape's tests.
 *
 * Runs the tests of the repo holding the cape's root, against the running core and the capes beside it. A local cape is committed in the hero's git but its tests are its own. The gate fails, so nothing is written, when a test does.
 *
 * @param ctx What the pass gives the gate: the cape's root passing through, and the core and bridge.
 * @returns Nothing; it throws when the tests fail.
 * @nosedive-feat 01a14b30-ee4e-722f-961d-32bbb99bdb8a
 */
export async function ie912ca03bb41549d86d709f98260400c(ctx: GateCtx): Promise<void> {
	// A local cape is committed in the hero's git, but its tests are its own.
	const repoDir = findBridge(ctx.doc.kbDir)?.dir ?? ctx.doc.repoDir;
	runRepoTests({ core: ctx.core, repoDir, bridgeDir: ctx.bridge.dir, out: ctx.out });
}
