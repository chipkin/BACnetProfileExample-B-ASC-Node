# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
