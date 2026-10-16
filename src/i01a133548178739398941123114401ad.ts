import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./i01a1335480147d0686528aee80f8ee34.ts";

export function i01a133548178739398941123114401ad(usage: string, actionId: string): string {
	return namespacedUuid(usage.trim().replace(/\s+/g, " "), actionId).replace(/-/g, "");
}
