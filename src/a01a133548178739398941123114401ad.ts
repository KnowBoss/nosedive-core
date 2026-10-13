import { a01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./a01a1335480147d0686528aee80f8ee34.ts";

export function a01a133548178739398941123114401ad(usage: string, actionId: string): string {
	return namespacedUuid(usage.trim().replace(/\s+/g, " "), actionId).replace(/-/g, "");
}
