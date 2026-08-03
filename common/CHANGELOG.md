# Changelog - `common/` (Node.js edition)

All notable changes to the vendored Node.js `common/` helpers. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-08-01

### Added

- `SimpleUDP.ts` - application-owned UDP socket with an inbound datagram queue
  (the stack pulls; it never owns the socket).
- `CASExampleHelper.ts` - `RegisterCommonCallbacks()` (receive/send/system-time
  callbacks; the 6-byte IPv4 connection string - 4 octets + big-endian port -
  packed/unpacked here once), `SendIAm()` targeting the local subnet broadcast,
  `GetLocalIPv4()`, CLI helpers (`--help`/`--version`/`--deviceID`/`--port`),
  and the deferred-restart flag+timer pattern for DM-RD-B (monotonic time).
- `CASBACnetStackExampleConstants.ts` - the BACnet enumeration values the
  examples use, constant names matching the C++ edition 1:1.
