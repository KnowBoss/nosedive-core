import { writeFileSync } from "node:fs";
import type { Document } from "yaml";

export function i01a1335483aa776cb84df698b04adc06(path: string, yaml: Document, body: string): void {
	writeFileSync(path, `---\n${yaml.toString({ lineWidth: 0 })}---\n${body}`);
}
