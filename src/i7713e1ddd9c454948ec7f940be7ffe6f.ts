import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";

export function i7713e1ddd9c454948ec7f940be7ffe6f(edit: KbEdit, quid: string, gist: string): void {
	if (!gist.trim()) throw new Error("--gist takes a gist");
	updateKbDocField(edit, quid, "gist", () => gist.trim());
}
