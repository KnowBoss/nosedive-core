#!/usr/bin/env node
// Runs nosedive from this repo's source, no build: `node scripts/dev.mjs <action> [<args>]`.
import { consoleCtx, a01a1336a958f71c7beec4db3195c7966 as launch } from "../src/a01a1336a958f71c7beec4db3195c7966.ts";
import { sourceCape } from "./source-cape.mjs";

process.exitCode = await launch(process.argv.slice(2), consoleCtx([await sourceCape()]));
