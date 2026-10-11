# nosedive-core

Private. nosedive's library and free commands, built into one minified bundle that the public
`nosedive` package ships. The design is the nosedive feat's body in the mi bridge
(kb/01a12b6f-95bc-7c83-b0fb-5d0a41b4d246.md).

```sh
npm run build   # dist/core-<version>.js, plus the dist/cli.js and dist/nosedive.js shims
npm test        # runs against the built bundle, so build first
```

The bundle exports the library, `commands`, `needs`, `version` and `smoke(ctx)`.
