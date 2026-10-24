import { existsSync } from "node:fs";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";

/** A kind's meta, with its links, which name the gates its docs pass through. */
export type KindMeta = { schema?: unknown; durable?: boolean; links?: unknown };

export function i01a147171f057d019118aaa1f269f5fd(kind: string, kbDirs: string[], capes: Cape[], ship?: Bridge): KindMeta | undefined {
	// A ship with a kind file keeps the kinds it declares in its bridge.
	for (const kbDir of [...kbDirs, ...(ship?.kindsDir ? [ship.kindsDir] : [])]) {
		if (!existsSync(kbDir)) continue;
		const doc = listKbDocs(kbDir).find((candidate) => candidate.fm.kind === "kind" && candidate.fm.name === kind);
		if (doc) return { ...((doc.fm.meta ?? {}) as KindMeta), links: doc.fm.links ?? [] };
	}
	for (const cape of capes) if (cape.kinds?.[kind] !== undefined) return cape.kinds[kind] as KindMeta;
	// A core action runs without the ship's capes loaded; their builds recorded their kinds.
	for (const { build } of ship && capes[0] ? configuredCapes(ship, capes[0]) : []) {
		if (build?.kinds?.[kind] !== undefined) return build.kinds[kind] as KindMeta;
	}
	return undefined;
}
