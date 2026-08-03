# AGENTS.md

## What this project is

The Node.js edition of the BACnet **B-ASC** (Application Specific Controller)
profile example: a complete minimal BACnet/IP device (DS-RP-B, DS-WP-B,
DM-DCC-B, DM-DDB-B, DM-DOB-B) built on the CAS BACnet Stack's npm package.
Part of the BACnet profile example series - the C++ sibling is
BACnetProfileExample-B-ASC-CPP, and the two are kept diffable: same objects,
names, section layout, and `BACnetStack_*` function names.

## Layout

- `main.ts` - the whole application, four numbered sections (§1 configuration,
  §2 get callbacks, §2b set callbacks, §2c DCC callback, §3 main).
- `common/` - VENDORED series helpers (SimpleUDP, CASExampleHelper, constants).
  Never edit here alone: a change must be swept to every sibling Node example
  and `COMMON_VERSION` bumped with a `common/CHANGELOG.md` entry.
- `submodules/cas-bacnet-stack` - the stack, pinned by the series-wide gitlink;
  consumed via npm workspaces. Do not bump the pin in one example alone.

## Build / run

- `npm install` - compiles the stack addon from the submodule source
  (10-20 min first time) and builds the package's `dist/` via its `prepare`.
- `npm start [-- --port 47821 --deviceID N]` - run. `npm run typecheck` - tsc.

## Conventions

- The application calls `LoadBACnetFunctions()` once, first, and checks it.
- Every `BACnetStack_*` setup call's return value is checked; failures print
  which call failed and exit non-zero.
- The stack PULLS: callbacks serve values; out-params are `Buffer`s
  (`value.writeFloatLE(v, 0)`; CharacterString writes byte count + UTF-8 tag).
- The 6-byte IPv4 connection string (4 octets + BIG-endian port) is packed in
  `common/CASExampleHelper.ts` only - never re-derive it.
- Present tense only: no comment or doc references a previous version of this
  example or of the stack.

## How to verify a change

1. `npm run typecheck`.
2. Smoke: `npm start -- --port 47821` stays up past the ready banner (every
   failed setup call exits 1, so "still running" proves registration).
3. Read back what you changed with a BACnet client (Who-Is, ReadProperty,
   WriteProperty at two priorities + relinquish, DCC wrong/right password).

## License

CC0-1.0 for the example; the stack submodule is a separately licensed
commercial product.
