# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.1] - 2026-11-02

Built on CAS BACnet Stack 6.x (`1e7dffe2b`, stack 6.0.23, Node package 6.1.2).

### Changed

- **Updated to CAS BACnet Stack 6.x `1e7dffe2b`.** The README and PICS name the
  new version.
- **A BACnet client on the same computer still hears the device's I-Am and
  I-Have** (`common/CASExampleHelper.ts`). This stack version leaves the address
  of a broadcast it chooses itself, such as the I-Am that answers a Who-Is, to the
  application, and the example sends it to the local subnet broadcast address.
  That reaches only the device's own UDP port, so the example also sends the same
  frame as a unicast to the last client that wrote to it from another UDP port.
- **README:** the profile example table is the same in every example. The five
  blocked examples (B-ACC, B-AACC, B-AS, B-ACCR, B-DAP) name the stack issue they
  wait on, and B-LSC is no longer marked in progress.

### Fixed

- **VeriBACnet re-run command** (`tests/veribacnet/README.md`) now starts the
  example with the DeviceCommunicationControl password the project declares.
  Without it the two password tests (135.1 cl. 9.24.2.1 and 9.24.2.2) fail.

## [1.2.0] - 2026-10-27

Built on CAS BACnet Stack 6.x (`69b6249f`, stack 6.0.23, Node package 6.1.2).

### Added

- **`--deviceName <text>`** sets the Device's `Object_Name` at start-up (1 to 255
  bytes, no control characters; otherwise a warning and the default is kept), as
  BACnet requires it to be configurable and unique on the internetwork. The default,
  "Chipkin Example B-ASC", is unchanged and the name cannot be written over BACnet.
  `--help` lists it.

### Changed

- **Stack updated** with no change to `main.ts`. The addon is now written to
  `submodules/cas-bacnet-stack/projects/npm/build/Release/`; the build commands are
  unchanged.
- **PICS:** Database_Revision is now stated as 8,
  as the stack counts the objects added at start-up (cl. 12.11), and the PICS cites the
  stack's property profiles.
- **Wire tests default to this example's own port, 47828.**

### Fixed

- **DeviceCommunicationControl error codes:** a defect in the stack's Node adapter,
  noted in `TODO.md`, is fixed in the updated stack.

### Compatibility

- Still requires **Node.js 24.21 or a later 24.x** (`>=24.21.0 <25`). The stack addon
  is compiled by **node-gyp** during `npm install`, which needs a C++17 toolchain
  (Visual Studio 2022 or 2026 Build Tools on Windows) and Python.

## [1.1.0] - 2026-10-16

The Node.js port of `BACnetProfileExample-B-ASC-CPP`. The controller now performs the
B-ASC Profile Function (ANSI/ASHRAE 135-2024 L.4.3): another device can modify its
objects, and it responds to communication control messages. The BACnet surface is
DS-RP-B, DS-WP-B, DM-DCC-B, DM-DDB-B and DM-DOB-B on the same eight objects.

Built on CAS BACnet Stack 6.x (`64b2cfac5`, stack 6.0.23, Node package 6.1.2).

### Added

- **Complete application (`main.ts`):** Device 389003, Analog, Binary and Multi-State
  Inputs; commandable Analog, Binary and Multi-State Outputs with full priority-array
  behaviour; Network Port; unsolicited I-Am at start-up; and the series command line
  (`--help`, `--version`, `--deviceID`, `--port`) with interactive keys.
- **I-Am heartbeat:** an unsolicited I-Am every 5 s. DeviceCommunicationControl
  `disable-initiation` stops it (cl. 16.1.2); `enable`, or the end of the time
  duration, resumes it.
- **Actuator simulation** (labelled Simulation in the README): once a second the
  heating valve moves Analog Input 1 up to 1.0 C toward the winning Analog Output 1
  setpoint, and Binary Input 1 and Multi-State Input 1 follow the winning output
  commands.
- **Analog Output 1** has `Min_Pres_Value` 10.0 and `Max_Pres_Value` 30.0 (an
  out-of-range setpoint gets `value-out-of-range`), and `Reliability` of
  `no-output` while the simulated valve is disconnected.
- **`--dcc-password <string>`** sets the DeviceCommunicationControl password at
  start-up (default empty: any request is accepted).
- **Automated self-tests** under `tests/` (discovery, commanding, failure modes,
  DeviceCommunicationControl).
- **TUTORIAL.md** and **docs/PICS.md** (Annex A style).
- `npm run build` (tsc to `dist/`) and `npm start`.

### Changed

- **Analog Output 1 is a degrees-Celsius setpoint** (its `Units` was `percent`) with
  a `Relinquish_Default` of 20.0.
- **Protocol_Revision is 30** (was 24). `Firmware_Revision` reports the stack's
  real version instead of the example's own.
- **Device renamed** from "Rainbow" to "Chipkin Example B-ASC" so examples on one
  network can be told apart.
- `.gitignore` covers every stack binary name; releases publish source only, never
  the compiled addon.

### Compatibility

- **Node.js 24.21 or later (below 25)** is now required (was `>=18.20.8`); `tsx` is
  no longer used.
- `npm install` compiles the stack's production addon with **node-gyp**, so a C++17
  toolchain and Python are needed.
