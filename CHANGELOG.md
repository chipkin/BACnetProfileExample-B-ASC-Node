# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - unreleased

Profile-functional (series bar): a faithful port of
`BACnetProfileExample-B-ASC-CPP` v1.4.0. The controller performs the B-ASC
Profile Function - ANSI/ASHRAE 135-2024 Annex L.4.3, "Ability to allow
modification of some or all of its BACnet objects by another device" and
"Ability to respond to communication control messages" - with something for
communication control to silence, and shows Failure Modes. The BACnet Surface
is unchanged (DS-RP-B, DS-WP-B, DM-DCC-B, DM-DDB-B, DM-DOB-B; the same eight
objects).

### Added

- **I-Am heartbeat** (`main.ts` section 2d, `HeartbeatTick()`): an unsolicited
  I-Am broadcast every 5 s. Under DeviceCommunicationControl
  `disable-initiation` the stack refuses to send it (cl. 16.1.2); `enable`, or
  the end of the request's time duration, resumes it. The example keeps no DCC
  state of its own.
- **Actuator Simulation** (`main.ts` section 1b, `ActuatorSimulationTick()`,
  labelled Simulation in the README): once a second the heating valve moves
  Analog Input 1 up to 1.0 C toward the winning Analog Output 1 setpoint
  (`ResolvedCommand()`, cl. 19.2), Binary Input 1 and Multi-State Input 1 take
  the winning Binary / Multi-State Output 1 commands. Before, the inputs were
  constants.
- **Analog Output 1** `Min_Pres_Value` 10.0 / `Max_Pres_Value` 30.0 (an
  out-of-range setpoint gets `value-out-of-range`) and `Reliability`
  (`no-output` while the simulated valve actuator is disconnected; the stack
  derives `Status_Flags` FAULT from it). Test-only hook: the environment
  variable `CAS_EXAMPLE_TEST_ACTUATOR_FAULT_FILE` names a file, and the valve is
  disconnected while that file exists.
- **`--dcc-password <string>`**: the DeviceCommunicationControl password is set
  at start-up (default empty = any request accepted); the start-up banner says
  that one is set, never what it is. The callback compares the request's
  password octets by length first, then bytes.
- **Wire Tests** (`tests/`, copied from the C++ reference: discovery,
  commanding, failure modes, DCC) and the shared `wiretest/` 0.7.0 harness,
  vendored verbatim (byte-identical to B-ASC-CPP's and B-SS-CPP's). The only
  addition is `tests/launch.py` (as B-SS-Node's): `--exe` takes a command line,
  default `node dist/main.js`. Windows, 3 runs in a row: 83/83 checks each
  (discovery 14/14, commanding 31/31, failure modes 22/22, DCC 16/16), no
  `[RETRY]` lines. Mutation-checked (rebuilt `dist/main.js` hash confirmed
  changed each time): `--dcc-password` not parsed, the lowest priority winning,
  the valve never disconnecting, and the heartbeat not called each fail the
  same checks as in the C++ reference's table (P2, A3, A7, H1).
- `.npmrc` `bacnet_testtool=0`: `npm install` builds the stack's production
  addon (customer interface only).
- `npm run build` (tsc to `dist/`); `npm start` runs `node dist/main.js`.
- `TODO.md`: an adapter defect found while porting (not filed).

### Changed

- **Stack Pin** `6.x-TestTool` @ `4a69c9eb` -> `6.x` @ `64b2cfac5` (CAS BACnet
  Stack 6.0.23, Node package 6.1.2), consumed in place as an npm workspace.
  **Protocol_Revision 24 -> 30**.
- **Node.js 24.21+ (<25)**, the stack package's `engines` (was `>=18.20.8`);
  `tsx` is gone.
- `common/` 1.0.0 -> 3.0.0, copied verbatim from B-SS-Node (see
  `common/CHANGELOG.md`): RX/TX console lines (the DCC Wire Test counts the
  heartbeat from them on Windows), the broadcast rules of the send callback,
  primary-interface discovery, the three-line version banner, `--dcc-password`
  in `--help`, the interactive keys also read from a piped stdin (how the Wire
  Tests stop the example), and CLI parsing that warns instead of exiting.
- `main.ts` rewritten section by section from B-ASC-CPP v1.4.0 `main.cpp`:
  the commandable outputs keep their Priority_Array in a `Commandable` record
  and the stack resolves `Present_Value`; Analog Output 1 is a degrees-Celsius
  setpoint (`Units` was `percent`) with `Relinquish_Default` 20.0; the setters
  validate ranges and log the effective priority. The up/down keys disturb the simulated temperature; the
  valve brings it back.
- `.gitignore` covers every stack binary name (`*.node`, `*.dll`, `*.so*`,
  ...); the release workflow publishes source only, never the addon.
- README, TUTORIAL, AGENTS.md, `docs/PICS.md` and `docs/objects.json` follow
  the C++ reference (the scenario, the Simulation, the heartbeat, Wire Tests,
  the version line, the binary-never-released rule).

## [1.0.2] - unreleased

### Changed

- **Device renamed from the series' colour placeholder "Rainbow" to "Chipkin
  Example B-ASC"** so devices from different examples in the series are
  distinguishable from each other on the same BACnet network - every example
  previously announced the identical Object_Name "Rainbow", which made two
  examples on one subnet indistinguishable by name. Sub-object names are
  unchanged. `docs/colour-table.md` (series root) updated to match.
  APP_VERSION bumped 1.0.1 -> 1.0.2.

## [1.0.1] - unreleased

### Fixed

- **`Firmware_Revision` (44) was hardcoded to the app's own `APP_VERSION`
  instead of naming the underlying platform.** `Application_Software_Version`
  (12) was already correct (reads `APP_VERSION` directly). `Firmware_Revision`
  is now built at runtime from the CAS BACnet Stack's own
  `BACnetStack_GetAPIMajorVersion()`/`GetAPIMinorVersion()`/
  `GetAPIPatchVersion()`/`GetAPIBuildVersion()` (the same 4 calls
  `common/CASExampleHelper.ts`'s `PrintVersion()` already uses for the
  startup banner), computed once right after `LoadBACnetFunctions()`
  succeeds rather than per-property-read. Same underlying issue as
  [BACnetProfileExample-B-SCHUB-CPP's 1.1.13 fix](https://github.com/chipkin/BACnetProfileExample-B-SCHUB-CPP/blob/main/CHANGELOG.md);
  this repo only needed the `Firmware_Revision` half. Verified with a real
  ReadProperty (`bacpypes3`) against the running device, pre-bump build
  (`APP_VERSION` was still `1.0.0` at test time; this fix bumps to 1.0.1):
  `application-software-version = '1.0.0'`, `firmware-revision = '6.0.0.0'` -
  the firmware value now matches the actual CAS BACnet Stack build instead of
  duplicating the app's own version.

## [Unreleased]

### Changed

- Restructured the documentation: `README.md` is cut down to this example
  only (series-framing, generic profile prose, and "Use this in your own
  project" / "The interesting parts of main.ts" moved out); added
  `TUTORIAL.md` (extending the example, who serves what, reviewing your
  device, troubleshooting) and `docs/PICS.md` (a full ANSI/ASHRAE 135 Annex A
  Protocol Implementation Conformance Statement) plus the `docs/objects.json`
  input that generates its objects-and-properties tables. `AGENTS.md` updated
  to match the new layout and to state plainly that this is a Node.js build,
  not a CMake one.

### Added

- The complete B-ASC example application (`main.ts`): device 389003 ("Rainbow"),
  the series' standard objects (AI/BI/MSI + commandable AO/BO/MSO + Network
  Port), DS-RP-B / DS-WP-B with full priority-array semantics, DM-DCC-B with
  byte-wise password checking, DM-DDB-B / DM-DOB-B, unsolicited I-Am on
  start-up, series-standard CLI (`--help`/`--version`/`--deviceID`/`--port`)
  and interactive keys (`h`/`q`/arrows).
- Vendored Node `common/` v1.0.0: `SimpleUDP.ts`, `CASExampleHelper.ts`
  (transport callbacks + the 6-byte IPv4 connection string, I-Am, local-IP
  discovery, CLI helpers, deferred-restart pattern),
  `CASBACnetStackExampleConstants.ts`.
- npm workspace consumption of the CAS BACnet Stack submodule: plain
  `npm install` compiles the addon and builds the package.
- Repository scaffold: CAS BACnet Stack submodule (`submodules/cas-bacnet-stack`,
  tracking `6.x-TestTool`), CC0-1.0 licence, README, changelog.

Verified on the wire: Who-Is → I-Am; every required property of every object
reads back (101-check sweep); WriteProperty at two priorities + relinquish;
out-of-range writes rejected `value-out-of-range`; DCC wrong password →
`password-failure`, disable-initiation/enable cycle clean.
