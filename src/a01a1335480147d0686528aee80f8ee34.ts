import { createHash } from "node:crypto";

export function a01a1335480147d0686528aee80f8ee34(name: string, namespace: string): string {
	const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
	if (ns.length !== 16) throw new Error(`not a uuid: ${namespace}`);
	const bytes = createHash("sha1").update(ns).update(name, "utf8").digest().subarray(0, 16);
	bytes[6] = (bytes[6]! & 0x0f) | 0x50;
	bytes[8] = (bytes[8]! & 0x3f) | 0x80;
	const hex = bytes.toString("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
