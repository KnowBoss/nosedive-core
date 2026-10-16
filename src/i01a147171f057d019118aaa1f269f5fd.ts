import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";

export type KindMeta = { schema?: unknown; durable?: boolean };

export function i01a147171f057d019118aaa1f269f5fd(kind: string, kbDirs: string[], capes: Cape[]): KindMeta | undefined {
	for (const kbDir of kbDirs) {
		const doc = listKbDocs(kbDir).find((candidate) => candidate.fm.kind === "kind" && candidate.fm.name === kind);
		if (doc) return (doc.fm.meta ?? {}) as KindMeta;
	}
	for (const cape of capes) if (cape.kinds?.[kind] !== undefined) return cape.kinds[kind] as KindMeta;
	return undefined;
}
