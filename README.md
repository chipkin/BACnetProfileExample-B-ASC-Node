# BACnet B-ASC (Application Specific Controller) - Node.js example

A minimal, copy-paste-friendly example showing how to implement the BACnet
**B-ASC (Application Specific Controller)** device profile in TypeScript on
Node.js, using the
[CAS BACnet Stack](https://store.chipkin.com/services/stacks/bacnet-stack). It
listens on **BACnet/IP (UDP 47808)**, answers **ReadProperty** and
**WriteProperty**, accepts **DeviceCommunicationControl**, and is discoverable
via **Who-Is / I-Am**.

**[Tagged source releases](https://github.com/chipkin/BACnetProfileExample-B-ASC-Node/releases)**
- there is no prebuilt binary to download; `npm install` always compiles the
CAS BACnet Stack addon locally (see [Build](#build) below).

- **[TUTORIAL.md](TUTORIAL.md)** - how to extend this example and how to review
  it for conformance. Read it when you start turning this into your own device.
- **[docs/PICS.md](docs/PICS.md)** - the Protocol Implementation Conformance
  Statement: every object, every property, and who answers it.

> **Versions:** this document describes **example v1.0.0**, built and verified
> against the CAS BACnet Stack submodule pinned at `6.x-TestTool` @ `4a69c9eb`
> (`package.json` calls this npm package **6.1.0**; the compiled API itself
> reports **v6.0.0.0** - the program's own start-up banner is correct, this
> line is not authoritative), at **Protocol_Revision 24**, with the vendored
> Node `common/` helper at **v1.0.0**. Running the example prints the app and
> API versions - if what it prints disagrees with this line, trust the
> program and check `CHANGELOG.md`. It does not print Protocol_Revision or the
> common helper version; read the former back with ReadProperty and check
> `common/CHANGELOG.md` for the latter.

## What is the B-ASC (Application Specific Controller) profile?

**B-ASC (BACnet Application Specific Controller)**, defined in Annex L of
ANSI/ASHRAE 135, is a **B-SA (Smart Actuator)** - a device that reports values
and accepts commands - plus **DeviceCommunicationControl**: a client can tell
the device to stop initiating traffic, optionally for a limited time,
optionally guarded by a password.

A B-ASC device answers **ReadProperty** and **WriteProperty**, is
discoverable, and executes **DeviceCommunicationControl**. This example
implements exactly those capabilities and nothing more - no COV, no alarming,
no scheduling, no trending, no ReadPropertyMultiple.

**But it is still a full BACnet device.** Even a small profile must present
the standard object model - a **Device** object, a **Network Port** object
(every device needs one), its sensor objects, and its commandable output
objects - and each object must expose all of its **required properties**. The
CAS BACnet Stack generates most of those automatically (Object_Identifier,
Object_Type, Status_Flags, Object_List, Protocol_*, Priority_Array's slot
resolution when the stack owns it, ...); this example supplies the rest,
including its own application-owned priority-array model for the three
commandable outputs. [docs/PICS.md](docs/PICS.md) lists every property and who
answers it.

## The device this example creates

```
Device 389003  "Rainbow"   (Vendor 389 - Chipkin Automation Systems)
    │
    ├── Analog Input 1        "Bronze"      Present_Value  21.5     (REAL, degrees Celsius; read-only)
    ├── Binary Input 1        "Emerald"     Present_Value  inactive (read-only)
    ├── Multi-State Input 1   "Hot Pink"    Present_Value  1        (state 1..3; read-only)
    ├── Analog Output 1       "Chartreuse"  Present_Value  0.0      (REAL, percent; commandable, 16-slot priority array)
    ├── Binary Output 1       "Fuchsia"     Present_Value  inactive (commandable, 16-slot priority array)
    ├── Multi-State Output 1  "Indigo"      Present_Value  1        (state 1..3; commandable, 16-slot priority array)
    └── Network Port 1        "Vermilion"   the BACnet/IP port     (required on every device)
```

## What this example supports

The example implements exactly the capabilities below - and nothing more,
which is the point of a profile example.

### BIBBs (BACnet Interoperability Building Blocks)

| BIBB | Description | Supported |
|------|-------------|:---------:|
| DS-RP-B | Data Sharing - ReadProperty - B | ✅ |
| DS-WP-B | Data Sharing - WriteProperty - B | ✅ |
| DM-DCC-B | Device Management - DeviceCommunicationControl - B | ✅ |
| DM-DDB-B | Device Management - Dynamic Device Binding - B | ✅ |
| DM-DOB-B | Device Management - Dynamic Object Binding - B | ✅ |

### Services (executed / B-side)

| Service | Notes |
|---------|-------|
| ReadProperty | Responds to property reads (DS-RP-B). |
| WriteProperty | Accepts commands to the three output objects, priority-array semantics (DS-WP-B). |
| DeviceCommunicationControl | Enable/disable-initiation, optional timed duration, optional password (DM-DCC-B). |
| Who-Is / I-Am | Answers Who-Is with I-Am, and broadcasts an I-Am on start-up (DM-DDB-B). |
| Who-Has / I-Have | Answers Who-Has with I-Have (DM-DOB-B). |

### Object types

| Object type | Instance | Name |
|-------------|:--------:|------|
| Device | 389003 | Rainbow |
| Analog Input | 1 | Bronze |
| Binary Input | 1 | Emerald |
| Multi-state Input | 1 | Hot Pink |
| Analog Output | 1 | Chartreuse |
| Binary Output | 1 | Fuchsia |
| Multi-state Output | 1 | Indigo |
| Network Port | 1 | Vermilion |

Every required property of every object, and who answers it, is in
[docs/PICS.md](docs/PICS.md).

## Requires the CAS BACnet Stack (licensed product)

This example **builds against the CAS BACnet Stack, which is a commercial
Chipkin product** - it is not free or open source, and there is no
public/trial build. The stack is referenced here as the **private** git
submodule `submodules/cas-bacnet-stack` (tracking the `6.x-TestTool` branch)
and consumed as an **npm workspace**: `npm install` compiles it from source
and builds the package's TypeScript layer. You can only fetch and build it
once you have a CAS BACnet Stack license and access to that repository.

**To get the CAS BACnet Stack (and access to build this example), contact
Chipkin:** <https://store.chipkin.com/services/stacks/bacnet-stack> or
sales@chipkin.com.

## What's in this repository

This is a **self-contained** project. It ships:

- `main.ts` - the example device.
- `common/` - the shared Node.js helper (UDP, callbacks, CLI, keyboard)
  vendored in.
- `package.json` / `tsconfig.json` - the build, the same on Windows, Linux,
  and macOS.
- `docs/PICS.md` - the conformance statement.
- `docs/objects.json` - the input to the objects-and-properties generator.
- `submodules/cas-bacnet-stack/` - the **CAS BACnet Stack as a git submodule**
  (private; requires a license - see above), consumed as an npm workspace. Its
  sources compile into a native Node addon, so there is nothing to build, ship,
  or install separately.

## Prerequisites

- Node.js `>=18.20.8 <=24.x` and npm.
- A C++17 toolchain (node-gyp needs it to compile the stack addon).
- Git (to fetch the stack submodule).

### Windows

- **Build tools** - Visual Studio 2022 Build Tools with the **"Desktop
  development with C++"** workload, plus Python (the standard node-gyp
  prerequisites). Newer Visual Studio versions are not supported by the
  stack's current toolset.
- Use a short project path - the stack's MSVC intermediate paths mirror its
  source tree, and long paths can fail to compile.

### Linux / macOS

- Debian/Ubuntu: `sudo apt install build-essential python3 git`
- macOS: `xcode-select --install`

## Build

npm only, and the same two commands on every platform:

```bash
git clone --recursive https://github.com/chipkin/BACnetProfileExample-B-ASC-Node.git
cd BACnetProfileExample-B-ASC-Node

npm install
```

Already cloned without `--recursive`? Run `git submodule update --init --recursive`
first - the install needs the stack submodule.

> **The first `npm install` takes 10-20 minutes** - it compiles the entire CAS
> BACnet Stack into a native Node addon via node-gyp. Subsequent installs are
> much faster once the addon is built.

## Run

```bash
npm start                      # defaults: device 389003, UDP 47808
npm start -- --port 47821      # non-default port (recommended while testing)
npm start -- --deviceID 12345  # your own device instance
npm start -- --help
```

Expected output:

```
BACnet B-ASC (Application Specific Controller) Example - Node v1.0.0
CAS BACnet Stack v6.0.0.0
FYI: listening on <your-ip>:47808 (broadcast <your-subnet-broadcast>)
FYI: Device 389003 ("Rainbow") ready. Vendor ID 389. Press 'h' for help.
```

The device listens on UDP **47808** (BACnet/IP) by default. Allow that port
through your firewall. To use a different port, pass `--port`.

> **Two red `Error:` lines at start-up are expected and are not your bug** -
> the stack's own debug logging (the device hearing its own broadcast I-Am,
> and a one-time BACnet/SC UUID notice). [TUTORIAL.md](TUTORIAL.md#troubleshooting)
> explains both.

### Command-line options

| Option | Default | Meaning |
|--------|---------|---------|
| `--port <n>` | `47808` | UDP port to listen on (BACnet/IP). |
| `--deviceID <n>` | `389003` | The device's BACnet instance number (BACnet requires this to be configurable). |
| `--help`, `-h` | - | Show usage and exit. |
| `--version` | - | Print the example and stack versions, then exit. |

### Interactive commands

While the example runs, these keys are available:

| Key | Action |
|-----|--------|
| `h` | Show the version information and this command list. |
| `q` | Quit. |
| up arrow | Increase Analog Input 1 (`Bronze`) by 1.1. |
| down arrow | Decrease Analog Input 1 (`Bronze`) by 1.1. |

The up/down keys change the live `Present_Value` of the analog input, so a
client re-reading it sees the new value.

## Verify

Use a BACnet client such as the
[**CAS BACnet Explorer**](https://store.chipkin.com/products/tools/cas-bacnet-explorer):

1. **Discover** - send a **Who-Is**. The device replies with **I-Am** from
   instance **389003** (vendor **389**). It also broadcasts an I-Am at
   start-up.
2. **Browse the object model** - the device shows eight objects: the Device
   (`Rainbow`), the three read-only inputs, the three commandable outputs, and
   the Network Port (`Vermilion`). Reading the Device's `Object_List` returns
   all eight.
3. **Read the Device** - ReadProperty `389003` -> `Object_Name` returns
   `"Rainbow"`; `Description` returns the profile description string.
4. **Read a sensor** - ReadProperty Analog Input `1` -> `Present_Value`
   returns `21.5`; `Units` returns `degrees-Celsius`. Repeat for Binary Input
   `1` (`"Emerald"`) and Multi-State Input `1` (`"Hot Pink"`, has
   `Number_Of_States` = 3).
5. **Command an output** - WriteProperty Analog Output `1`'s `Present_Value`
   at priority 8, then read it back; write `NULL` at priority 8 to relinquish
   and confirm it falls back to `Relinquish_Default`. Repeat with Binary
   Output `1` and Multi-State Output `1`; an out-of-range Multi-State write is
   rejected `value-out-of-range`.
6. **DeviceCommunicationControl** - send DCC with the wrong password and
   confirm `password-failure`; with the right password, confirm
   disable-initiation / enable behaves as documented in
   [docs/PICS.md](docs/PICS.md).

For a property-by-property review against the conformance statement, see
[TUTORIAL.md](TUTORIAL.md).

## The BACnet profile example series

<!-- PROFILE-TABLE:BEGIN (generated from cas-bacnet-stack-examples/docs/profile-table.md - do not edit here) -->
The CAS BACnet Stack supports every standardized device profile in ASHRAE 135-2024 Annex L, and there is one example repository per profile. Pick the profile your device claims, then the language you build in. "Ask" means the example hasn't been built yet for that language - [contact Chipkin](https://store.chipkin.com/contact-us) if you need one.

### Controllers (Annex L.4)

| Profile | C++ | Node.js | C# | Rust | Python | Go |
|---|---|---|---|---|---|---|
| **B-SS** Smart Sensor | [B-SS-CPP](https://github.com/chipkin/BACnetProfileExample-B-SS-CPP) | [B-SS-Node](https://github.com/chipkin/BACnetProfileExample-B-SS-Node) | [B-SS-CS](https://github.com/chipkin/BACnetProfileExample-B-SS-CS) | [B-SS-Rust](https://github.com/chipkin/BACnetProfileExample-B-SS-Rust) | [B-SS-Python](https://github.com/chipkin/BACnetProfileExample-B-SS-Python) | [B-SS-Go](https://github.com/chipkin/BACnetProfileExample-B-SS-Go) |
| **B-SA** Smart Actuator | [B-SA-CPP](https://github.com/chipkin/BACnetProfileExample-B-SA-CPP) | Ask | Ask | Ask | Ask | Ask |
| **B-ASC** Application Specific Controller | [B-ASC-CPP](https://github.com/chipkin/BACnetProfileExample-B-ASC-CPP) | [B-ASC-Node](https://github.com/chipkin/BACnetProfileExample-B-ASC-Node) | Ask | Ask | Ask | Ask |
| **B-AAC** Advanced Application Controller | [B-AAC-CPP](https://github.com/chipkin/BACnetProfileExample-B-AAC-CPP) | Ask | Ask | Ask | Ask | Ask |
| **B-BC** Building Controller | [B-BC-CPP](https://github.com/chipkin/BACnetProfileExample-B-BC-CPP) | Ask | Ask | Ask | Ask | Ask |

### Life safety controllers (Annex L.5)

| Profile | C++ | Node.js | C# | Rust | Python | Go |
|---|---|---|---|---|---|---|
| **B-LSC** Life Safety Controller | [B-LSC-CPP](https://github.com/chipkin/BACnetProfileExample-B-LSC-CPP) 🚧 | Ask | Ask | Ask | Ask | Ask |
| **B-ALSC** Advanced Life Safety Controller | [B-ALSC-CPP](https://github.com/chipkin/BACnetProfileExample-B-ALSC-CPP) | Ask | Ask | Ask | Ask | Ask |

### Access control controllers (Annex L.6)

| Profile | C++ | Node.js | C# | Rust | Python | Go |
|---|---|---|---|---|---|---|
| **B-ACC** Access Control Controller | [B-ACC-CPP](https://github.com/chipkin/BACnetProfileExample-B-ACC-CPP) | Ask | Ask | Ask | Ask | Ask |
| **B-AACC** Advanced Access Control Controller | [B-AACC-CPP](https://github.com/chipkin/BACnetProfileExample-B-AACC-CPP) | Ask | Ask | Ask | Ask | Ask |

### Lighting controllers (Annex L.11)

| Profile | C++ | Node.js | C# | Rust | Python | Go |
|---|---|---|---|---|---|---|
| **B-LD** Lighting Device | [B-LD-CPP](https://github.com/chipkin/BACnetProfileExample-B-LD-CPP) | Ask | Ask | Ask | Ask | Ask |
| **B-LS** Lighting Supervisor | [B-LS-CPP](https://github.com/chipkin/BACnetProfileExample-B-LS-CPP) | Ask | Ask | Ask | Ask | Ask |

### Elevator controllers (Annex L.13)

| Profile | C++ | Node.js | C# | Rust | Python | Go |
|---|---|---|---|---|---|---|
| **B-EM** Elevator Monitor | [B-EM-CPP](https://github.com/chipkin/BACnetProfileExample-B-EM-CPP) | Ask | Ask | Ask | Ask | Ask |
| **B-EC** Elevator Controller | [B-EC-CPP](https://github.com/chipkin/BACnetProfileExample-B-EC-CPP) | Ask | Ask | Ask | Ask | Ask |
| **B-AEC** Advanced Elevator Controller | [B-AEC-CPP](https://github.com/chipkin/BACnetProfileExample-B-AEC-CPP) | Ask | Ask | Ask | Ask | Ask |

### Authentication and authorization (Annex L.14)

| Profile | C++ | Node.js | C# | Rust | Python | Go |
|---|---|---|---|---|---|---|
| **B-AS** Authorization Server | [B-AS-CPP](https://github.com/chipkin/BACnetProfileExample-B-AS-CPP) | Ask | Ask | Ask | Ask | Ask |

### Miscellaneous (Annex L.7, combinable with any one family)

| Profile | C++ | Node.js | C# | Rust | Python | Go |
|---|---|---|---|---|---|---|
| **B-BBMD** Broadcast Management Device | [B-BBMD-CPP](https://github.com/chipkin/BACnetProfileExample-B-BBMD-CPP) | Ask | Ask | Ask | Ask | Ask |
| **B-ACDC** Access Control Door Controller | [B-ACDC-CPP](https://github.com/chipkin/BACnetProfileExample-B-ACDC-CPP) | Ask | Ask | Ask | Ask | Ask |
| **B-ACCR** Access Control Credential Reader | [B-ACCR-CPP](https://github.com/chipkin/BACnetProfileExample-B-ACCR-CPP) | Ask | Ask | Ask | Ask | Ask |
| **B-RTR** Router | [B-RTR-CPP](https://github.com/chipkin/BACnetProfileExample-B-RTR-CPP) | Ask | Ask | Ask | Ask | Ask |
| **B-GW** Gateway | [B-GW-CPP](https://github.com/chipkin/BACnetProfileExample-B-GW-CPP) | Ask | Ask | Ask | Ask | Ask |
| **B-DAP** Device Address Proxy | [B-DAP-CPP](https://github.com/chipkin/BACnetProfileExample-B-DAP-CPP) | Ask | Ask | Ask | Ask | Ask |
| **B-SCHUB** BACnet/SC Hub | [B-SCHUB-CPP](https://github.com/chipkin/BACnetProfileExample-B-SCHUB-CPP) | Ask | Ask | Ask | Ask | Ask |
| **B-GENERAL** General device (Annex L.8) | *(satisfied by every example above)* | — | — | — | — | — |

### Operator interfaces and workstations (Annex L.1–L.3, L.9–L.10, L.12)

Client-side profiles.

| Profile | C++ | Node.js | C# | Rust | Python | Go |
|---|---|---|---|---|---|---|
| **B-OD** Operator Display | [B-OD-CPP](https://github.com/chipkin/BACnetProfileExample-B-OD-CPP) | Ask | Ask | Ask | Ask | Ask |
| **B-OWS** Operator Workstation | planned | — | — | — | — | — |
| **B-AWS** Advanced Operator Workstation | planned | — | — | — | — | — |
| **B-XAWS** Extended Advanced Operator Workstation | planned | — | — | — | — | — |
| **B-LSAP** Life Safety Annunciator Panel | planned | — | — | — | — | — |
| **B-LSWS** Life Safety Workstation | planned | — | — | — | — | — |
| **B-ALSWS** Advanced Life Safety Workstation | planned | — | — | — | — | — |
| **B-ACSD** Access Control Security Display | planned | — | — | — | — | — |
| **B-ACWS** Access Control Workstation | planned | — | — | — | — | — |
| **B-AACWS** Advanced Access Control Workstation | planned | — | — | — | — | — |
| **B-LOD** Lighting Operator Display | planned | — | — | — | — | — |
| **B-ALWS** Advanced Lighting Workstation | planned | — | — | — | — | — |
| **B-LCS** Lighting Control Station | planned | — | — | — | — | — |
| **B-ALCS** Advanced Lighting Control Station | planned | — | — | — | — | — |
| **B-ED** Elevator Display | planned | — | — | — | — | — |
| **B-EWS** Elevator Workstation | planned | — | — | — | — | — |
| **B-AEWS** Advanced Elevator Workstation | planned | — | — | — | — | — |

🚧 = in progress. "Ask" = not yet built for that language; contact Chipkin if you need it. Profile definitions: ANSI/ASHRAE 135-2024 Annex L. BIBB definitions: Annex K. Get the stack: <https://store.chipkin.com/services/stacks/bacnet-stack>.
<!-- PROFILE-TABLE:END -->

## References

- **ANSI/ASHRAE Standard 135** (BACnet) - the protocol standard. Object model
  (Clause 12), services (Clause 15), BACnet/IP (Annex J), device profiles
  (Annex L). Purchase / preview via the [ASHRAE store](https://www.ashrae.org/technical-resources/standards-and-guidelines).
- **What is BACnet?** - Chipkin's introduction:
  <https://docs.chipkin.com/protocols/bacnet/>.
- **CAS BACnet Stack** - product page and documentation:
  <https://store.chipkin.com/services/stacks/bacnet-stack>.
- **CAS BACnet Explorer** - client for testing this device:
  <https://store.chipkin.com/products/tools/cas-bacnet-explorer>.
- **Shared helper used by this example** - [`common/README.md`](common/README.md).

See also [TUTORIAL.md](TUTORIAL.md), [docs/PICS.md](docs/PICS.md),
[CHANGELOG.md](CHANGELOG.md), and [AGENTS.md](AGENTS.md).
