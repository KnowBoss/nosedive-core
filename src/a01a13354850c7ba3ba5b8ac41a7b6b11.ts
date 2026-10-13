import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { a01a1335482f876d6808aec457f512e80 as readKbDoc, type KbDoc } from "./a01a1335482f876d6808aec457f512e80.ts";

export function a01a13354850c7ba3ba5b8ac41a7b6b11(kbDir: string): (KbDoc & { path: string; text: string })[] {
	return readdirSync(kbDir)
		.filter((file) => file.endsWith(".md"))
		.sort()
		.flatMap((file) => {
			const path = join(kbDir, file);
			const text = readFileSync(path, "utf8");
			try {
				return [{ ...readKbDoc(text, path), path, text }];
			} catch {
				return [];
			}
		});
}
