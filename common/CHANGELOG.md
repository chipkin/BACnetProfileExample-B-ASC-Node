# Changelog - `common/` (Node.js edition)

All notable changes to the vendored Node.js `common/` helpers. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [3.0.0] - 2026-10-16

Brings the Node `common/` in line with the conventions of the C++ `common/`
3.4.0 (BACnetProfileExample-B-SS-CPP v1.3.0), for stack `6.x` @ `64b2cfac5`.
Breaking: `SimpleUDP.Send()` now returns the byte count, and the CLI parsers
warn and fall back instead of exiting.

### Added

- **RX/TX console lines.** Every frame received or sent prints one line,
  `RX <n> bytes from <ip>:<port> (Network Port <n>) - <summary>` /
  `TX <n> bytes to <ip>:<port>[ (broadcast)] (Network Port <n>) - <summary>`,
  the same shape as the C++ `common/`. `SummarizeBacnetFrame()` names the PDU
  type and service (and the Reject/Abort reason); unlike the C++ edition it does
  not add the object/property or route suffix, and there is no `--xml` dump.
- `DiscoverPrimaryIPv4()`: finds the interface that carries the default route
  (a connected UDP socket toward TEST-NET-1, which sends nothing), so
  `GetLocalIPv4()` no longer picks a virtual switch adapter on Windows.
- `PrintHelp()` (the `h` key), `KeyCommand` + `StartKeyInput()` (the
  interactive keys; with stdin a pipe the same characters work, so writing `q`
  quits - how the Wire Tests stop an example), `ParseDccPasswordArg()`.
- `HandleHelpAndVersionArgs(..., showDccPasswordCliOption = true)` - as the C++
  helper; pass `false` from an example without DeviceCommunicationControl.
- `SimpleUDP.onDatagramQueued` (run the stack as soon as a request arrives) and
  `SimpleUDP.Port()`.
- More constants (object types, services, DCC, ReinitializeDevice, notify type,
  error codes, network number quality), names matching the C++ header.

### Changed

- The send callback follows the C++ 3.2.0 / 3.4.0 broadcast rules: a length-0
  connection string means "broadcast on this link" (the local subnet broadcast
  on this socket's port); `broadcast = true` addressed to this socket's own
  address goes to the subnet broadcast (stack #3933); a send for another
  Network Port instance is declined.
- A received datagram larger than the stack's buffer is truncated to it (as the
  C++ `SimpleUDP` does) instead of dropped.
- `SimpleUDP.Send()` copies the message first (the stack reuses its outgoing
  buffer; dgram sends asynchronously) and returns the byte count.
- `SimpleUDP.Setup()` binds without `SO_REUSEADDR` on Windows, so a second
  device on the same port fails to bind instead of silently sharing it.
- `PrintVersion()` prints the C++ three-line banner (`CAS BACnet Stack
  version: ...`, `Common helper (common/) version: ...`).
- `ParsePortArg()` / `ParseDeviceIdArg()` take whole numbers only, and on a bad
  value print `Warning: ignoring invalid ...` and use the default (the C++
  behaviour) instead of exiting.

## [2.0.0] - 2026-09-16

### Added

- `SimpleUDP.ts` - application-owned UDP socket with an inbound datagram queue
  (the stack pulls; it never owns the socket).
- `CASExampleHelper.ts` - `RegisterCommonCallbacks()` (receive/send/system-time
  callbacks; the 6-byte IPv4 connection string - 4 octets + big-endian port -
  packed/unpacked here once), `SendIAm()` targeting the local subnet broadcast,
  `GetLocalIPv4()`, and CLI helpers (`--help`/`--version`/`--deviceID`/`--port`).
- `CASBACnetStackExampleConstants.ts` - the BACnet enumeration values this
  example uses, constant names matching the C++ edition 1:1.

### Changed - the adapter/callback API this example was built against

This is the **first** Node.js `common/` for the B-SS profile, and it starts
at `2.0.0` (not `1.0.0`) deliberately: it targets the `submodules/cas-bacnet-stack`
`6.x` branch's *current* Node adapter API, not the older
`6.x-TestTool` pin the B-ASC-Node example's `common/` v1.0.0 was built
against. Three interface differences reach every callback/call site below,
matching the version jump `BACnetProfileExample-B-SS-CPP`'s own `common/`
made for the same reason (see its `CHANGELOG.md`, `[1.2.0]`):

- **Every `RegisterCallbackGetProperty*` callback gained a trailing
  `errorCode: Buffer` out-parameter** (stack issue #974). The stack presets it
  to `success` and reads it only on a `false` return, so a declining callback
  can name the BACnet error the client receives instead of falling back to the
  stack's silent defaults. `main.ts` uses it in exactly one place -
  `State_Text` with an out-of-range array index now answers
  `Error(property, invalid-array-index)` instead of an empty string - and
  deliberately leaves it alone on every catch-all `return false`.
- **`BACnetStack_AddNetworkPortObjectWithNetworkNumber()` is gone**, folded
  into `BACnetStack_AddNetworkPortObject()`, which now always takes the
  network number and its quality. Same arguments, one function.
- **Links are identified by Network Port object instance, not network type**
  (stack issues #822/#556): the transport callbacks are now
  `BACnetStack_RegisterCallbackReceiveMessageForPort()` /
  `BACnetStack_RegisterCallbackSendMessageForPort()`, and `BACnetStack_SendIAm()`'s
  fourth argument is a `networkPortInstance`, not a `networkType` enumeration.
  `RegisterCommonCallbacks()` and `SendIAm()` both now take a
  `networkPortInstance` parameter naming the Network Port object the caller's
  socket belongs to.

There is no B-SS Node `common/` at `1.x` to diff against - this file exists so
future examples pinned to this same stack branch (or a later one) can tell at
a glance which adapter shape a given `common/` version expects.
