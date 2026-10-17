import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a133588b1f7d4ea13f1b5e79f02e4c as mergeKeyedEntries } from "./i01a133588b1f7d4ea13f1b5e79f02e4c.ts";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";

export function i21be7cc759fb5c758e11cffdb2630902(edit: KbEdit, quid: string, patch: unknown): void {
	if (patch === null || typeof patch !== "object" || Array.isArray(patch)) throw new Error("--links takes a mapping");
	updateKbDocField(edit, quid, "links", (links) => mergeKeyedEntries(links, patch as Record<string, unknown>));
}
