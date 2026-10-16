export function i01a13354867d7a528cbad55b80708e50(target: unknown, patch: unknown): unknown {
	if (!isObject(patch)) return patch;
	const merged: Record<string, unknown> = isObject(target) ? { ...target } : {};
	for (const [key, value] of Object.entries(patch)) {
		if (value === null) delete merged[key];
		else merged[key] = i01a13354867d7a528cbad55b80708e50(merged[key], value);
	}
	return merged;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
