import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Cape, Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import { i01a14b30eb0e72e28934c918000a26ac as loadCape } from "./i01a14b30eb0e72e28934c918000a26ac.ts";

export async function if4a09298430355a2a473394fbb5103f2(quid: string, ctx: Ctx): Promise<void> {
	ctx.out((await findDoc(quid, ctx)).text.trimEnd());
}

/** The doc crud reads, whole, and its file when it has one on disk: a cape's has one only where the cape runs from a checkout. */
export async function findDoc(quid: string, ctx: Ctx): Promise<{ text: string; path?: string; cape?: Cape }> {
	const bridge = findBridge(ctx.cwd);
	const doc = bridge ? locateKbDoc(bridge, quid) : undefined;
	if (doc) return doc;
	for (const cape of ctx.capes) {
		const capeDoc = cape.docs[quid];
		if (capeDoc) return capeFile(cape, quid, capeDoc.text);
	}
	// A worn cape not loaded for this action is loaded to read its docs, its migrations' included.
	for (const worn of bridge ? configuredCapes(bridge, ctx.capes[0]!) : []) {
		if (!worn.build) continue;
		const cape = await loadCape(bridge!.dir, worn.build, ctx.capes[0]!);
		const capeDoc = cape.docs[quid];
		if (capeDoc) return capeFile(cape, quid, capeDoc.text);
	}
	throw new Error(`no doc ${quid} in ${bridge ? "this bridge, its workspace or " : ""}the loaded capes`);
}

/** A cape's doc with its file: in the cape's kb when it runs from source, or from a build inside its checkout (`<repo>/dist/`); without one, the cape. */
function capeFile(cape: Cape, quid: string, text: string): { text: string; path?: string; cape?: Cape } {
	const repoDir = cape.repoDir ?? (cape.url?.startsWith("file:") ? dirname(dirname(fileURLToPath(cape.url))) : undefined);
	const path = repoDir ? docFile(repoDir, quid) : undefined;
	return path && existsSync(path) ? { text, path } : { text, cape };
}

/** Where a doc's file is in a checkout of its repo, there or not. */
export function docFile(repoDir: string, quid: string): string {
	return join(readRepoConfig(repoDir)?.kbDir ?? join(repoDir, "kb"), `${quid}.md`);
}
