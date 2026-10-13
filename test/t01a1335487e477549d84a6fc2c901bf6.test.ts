// describe-cape-source
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { a01a1335487e477549d84a6fc2c901bf6 as describeCapeSource } from "../src/a01a1335487e477549d84a6fc2c901bf6.ts";
// @ts-expect-error the shared loader is plain JavaScript
import { repoDir } from "../scripts/source-cape.mjs";

test("describes this repo's actions, skipping docs of other kinds", () => {
	const { docs, entries } = describeCapeSource(repoDir);
	const crud = docs["01a13354-7dea-7604-b903-b94a5aca2b83"]!;
	assert.equal(crud.name, "crud");
	assert.deepEqual(crud.usages[0], { id: "f4a09298430355a2a473394fbb5103f2", text: "crud <quid>" });
	assert.match(crud.body, /^# Crud\n/);
	assert.equal(docs["01a13354-7d34-72f3-ad11-9c44b4d5de6e"], undefined);
	assert.deepEqual(
		entries.find((entry) => entry.id === "01a13354-7dea-7604-b903-b94a5aca2b83"),
		{
			id: "01a13354-7dea-7604-b903-b94a5aca2b83",
			name: "a01a133547dea7604b903b94a5aca2b83",
			file: join(repoDir, "src", "a01a133547dea7604b903b94a5aca2b83.ts"),
		},
	);
});
