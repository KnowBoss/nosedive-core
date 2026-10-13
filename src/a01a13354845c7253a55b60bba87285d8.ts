import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { a01a1335482f876d6808aec457f512e80 as readKbDoc, type KbDoc } from "./a01a1335482f876d6808aec457f512e80.ts";

export function a01a13354845c7253a55b60bba87285d8(
	kbDir: string,
	id: string,
): (KbDoc & { path: string; text: string }) | undefined {
	const path = join(kbDir, `${id}.md`);
	if (!existsSync(path)) return undefined;
	const text = readFileSync(path, "utf8");
	return { ...readKbDoc(text, path), path, text };
}
