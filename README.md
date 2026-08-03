# BACnet B-ASC (Application Specific Controller) - Node.js example

A complete, minimal BACnet/IP device implementing the **B-ASC** device profile
of ANSI/ASHRAE 135 Annex L, in TypeScript on Node.js, using the
[CAS BACnet Stack](https://store.chipkin.com/). Part of the BACnet profile
example series - one self-contained tutorial per device profile. This is the
Node.js edition of
[BACnetProfileExample-B-ASC-CPP](https://github.com/chipkin/BACnetProfileExample-B-ASC-CPP):
same objects, same names, same section layout, same `BACnetStack_*` function
names, so you can diff the two side by side and see exactly what is language
and what is BACnet.

> **Versions**: example v1.0.0, CAS BACnet Stack 6.x (`@chipkin/cas-bacnet-stack`
> 6.1.0), Protocol_Revision = the stack default. Trust the program's start-up
> banner, not this line.

## Quickstart

```bash
git clone --recursive https://github.com/chipkin/BACnetProfileExample-B-ASC-Node.git
cd BACnetProfileExample-B-ASC-Node
npm install     # compiles the CAS BACnet Stack from source - expect 10-20 minutes the first time
npm start
```

`npm install` builds the entire stack into a native Node addon (there is no
prebuilt binary to ship). Windows needs the Visual Studio Build Tools + Python
(the standard node-gyp prerequisites) and a reasonably short project path;
Linux/macOS need a C++17 toolchain.

## What is a B-ASC (BACnet Application Specific Controller)?

An Application Specific Controller is a B-SA (Smart Actuator - report values
and be commanded) plus **DeviceCommunicationControl**: a client can tell the
device to stop initiating traffic, optionally for a limited time, optionally
guarded by a password. In BIBB terms this example executes:

| BIBB | Service | Meaning |
|---|---|---|
| DS-RP-B | ReadProperty | serve property reads |
| DS-WP-B | WriteProperty | accept commands (priority array) |
| DM-DCC-B | DeviceCommunicationControl | the B-ASC addition |
| DM-DDB-B | Who-Is / I-Am | be discoverable |
| DM-DOB-B | Who-Has / I-Have | objects discoverable by name |

Nothing else is enabled - no COV, no alarms, no scheduling, no trending, no
ReadPropertyMultiple. Implementing exactly one profile is the point.

## The device this example creates

Device **389003** ("Rainbow"), vendor **389** (Chipkin), plus the series'
standard objects:

| Object | Name | What it demonstrates |
|---|---|---|
| Analog Input 1 | Bronze | a read-only value (21.5 °C; nudge with the arrow keys) |
| Binary Input 1 | Emerald | a read-only contact |
| Multi-State Input 1 | Hot Pink | states 1..3 with State_Text ("On"/"Off"/"Auto") |
| Analog Output 1 | Chartreuse | commandable REAL (16-slot priority array) |
| Binary Output 1 | Fuchsia | commandable active/inactive |
| Multi-State Output 1 | Indigo | commandable state 1..3 with validation |
| Network Port 1 | Vermilion | the BACnet/IP port's own configuration |

## What's in this repository

| | |
|---|---|
| [`main.ts`](main.ts) | the whole tutorial - read it top to bottom; four numbered sections mirroring the C++ edition |
| [`common/`](common) | vendored series plumbing: the UDP socket, the transport callbacks + 6-byte connection string, I-Am, CLI, constants |
| `submodules/cas-bacnet-stack` | the CAS BACnet Stack (licensed product - see below), consumed as an npm workspace |

## Run

```bash
npm start                      # defaults: device 389003, UDP 47808
npm start -- --port 47821      # non-default port (recommended while testing)
npm start -- --deviceID 12345  # your own device instance
npm start -- --help
```

Interactive keys: `h` help, `q` quit, `↑`/`↓` nudge Analog Input 1 so a client
can watch the value change.

> Two red `Error:` lines can appear at start-up (a BACnet/SC "UUID has not
> been set" notice and a self-heard-broadcast decode); both are benign.

## Verify

Discover the device with any BACnet client (for example the
[CAS BACnet Explorer](https://store.chipkin.com/products/tools/cas-bacnet-explorer)):
Who-Is answers with I-Am from device 389003 / vendor 389; every required
property of every object reads back; WriteProperty to the three outputs obeys
priority-array semantics (write NULL to relinquish); DeviceCommunicationControl
with a wrong password answers `password-failure`.

## The interesting parts of `main.ts`

- **`LoadBACnetFunctions()` first.** The same load contract as every edition of
  this example: load once before any stack call, check the result, print
  `CASBACnetStackAdapter_LastError()` on failure.
- **The stack pulls, the application owns.** The application owns the UDP
  socket, the device data, and the tick loop; the stack asks for datagrams and
  property values through callbacks. Out-parameters arrive as `Buffer`s:
  `value.writeFloatLE(21.5, 0)` is the Node spelling of `*value = 21.5f`.
- **The commandable model** (`Commandable`, `CommandWrite`, `CommandRelinquish`)
  - a 16-slot priority array per output, falling back to Relinquish_Default.
- **Silent traps, called out in comments where they live**: a `false` return
  from a Get callback usually substitutes a default instead of erroring; an
  OPTIONAL property served without `SetPropertyEnabled` answers
  unknown-property; the DCC callback has no default errorCode; and there are
  TWO networkType enumerations (ipv4 = 5 for the Network Port object, IP = 0
  for the message callbacks).

## Requires the CAS BACnet Stack (licensed product)

The CAS BACnet Stack is a commercial Chipkin product, included as the private
git submodule `submodules/cas-bacnet-stack` (tracking the `6.x-TestTool`
branch) and consumed as an npm workspace - `npm install` compiles it from
source and builds the package's TypeScript layer. You need a licence to fetch
and build it: <https://store.chipkin.com/> or sales@chipkin.com.

## Use this in your own project

Copy the shape, not the identity: get your own vendor ID from ASHRAE, pick your
own device instance, and replace everything marked
`CHANGE ALL OF THIS BEFORE YOU SHIP` in `main.ts` §1. Keep: the
`LoadBACnetFunctions()` guard, the application-owned socket +
`RegisterCommonCallbacks()` shape, the commandable model, and the habit of
checking every `BACnetStack_*` return value.

## License

The example source code is [CC0-1.0](LICENSE) (public domain). The CAS BACnet
Stack submodule is licensed separately.
