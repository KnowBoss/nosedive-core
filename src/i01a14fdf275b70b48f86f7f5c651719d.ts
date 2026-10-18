import { closeSync, openSync, readSync } from "node:fs";

const CHUNK = 512;
const KIND = /\nkind:[ \t]*["']?([^"'\r\n]*?)["']?[ \t]*\r?\n/;

export function i01a14fdf275b70b48f86f7f5c651719d(path: string): string | undefined {
	const fd = openSync(path, "r");
	try {
		const chunks: Buffer[] = [];
		for (;;) {
			const chunk = Buffer.alloc(CHUNK);
			const read = readSync(fd, chunk, 0, CHUNK, null);
			chunks.push(chunk.subarray(0, read));
			const head = Buffer.concat(chunks).toString("utf8");
			if (!/^---\r?\n/.test(head)) return undefined;
			// Only the frontmatter counts: a body line that looks like a kind is not one.
			const end = head.slice(3).search(/\r?\n---\r?(\n|$)/);
			const kind = KIND.exec(end === -1 ? head : `${head.slice(0, end + 3)}\n`);
			if (kind) return kind[1] || undefined;
			if (end !== -1 || read < CHUNK) return undefined;
		}
	} finally {
		closeSync(fd);
	}
}
