#!/usr/bin/env node
// Runs nosedive from this repo's source, no build: `node scripts/dev.mjs <action> [<args>]`.
import { consoleCtx, launch } from "../src/main.ts";
import { sourceCape } from "./source-cape.mjs";

process.exitCode = await launch(process.argv.slice(2), consoleCtx([await sourceCape()]));
