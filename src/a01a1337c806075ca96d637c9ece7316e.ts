import { a01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./a01a1335480147d0686528aee80f8ee34.ts";

export function a01a1337c806075ca96d637c9ece7316e(repoId: string, commit: string, coreId: string, needs: string[] = []): string {
	return namespacedUuid([`${commit}@${coreId}`, ...[...needs].sort()].join("+"), repoId);
}
