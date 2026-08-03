# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
