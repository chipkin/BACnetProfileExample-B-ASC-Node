# `common/` - shared example plumbing (Node.js edition)

The helpers every Node.js example in the BACnet profile example series shares.
**Vendored**: this directory is a *copy* in each example repo, not a package -
change it in one repo and you must sweep the same change to every sibling and
bump `COMMON_VERSION` (in `CASExampleHelper.ts`) + add a `CHANGELOG.md` entry.

## Versioning

`COMMON_VERSION` in `CASExampleHelper.ts`, changelog in `common/CHANGELOG.md`.
The Node common versions independently of the C++ `common/` (which is at its
own version) - same rules, separate lineages. This copy starts at **2.0.0**
because it targets the `submodules/cas-bacnet-stack` `6.x` branch's current
adapter/callback API (trailing `errorCode` on every `GetProperty*` callback,
the folded `AddNetworkPortObject()`, and the `*ForPort` transport callbacks) -
see `common/CHANGELOG.md` for the full list of what that means versus an
older pin.

## What's here

| File | What it is |
|---|---|
| `SimpleUDP.ts` | The UDP socket the application owns: bind, queue inbound datagrams, send. The stack never touches the socket - it pulls datagrams through the receive callback. |
| `CASExampleHelper.ts` | `RegisterCommonCallbacks()` (receive/send/system-time + the 6-byte IPv4 connection string, port big-endian, written here ONCE; one `RX`/`TX` console line per frame), `SendIAm()`, `DiscoverPrimaryIPv4()` / `GetLocalIPv4()`, the CLI helpers, `PrintVersion()` / `PrintHelp()`, and the interactive keys (`StartKeyInput()`). |
| `CASBACnetStackExampleConstants.ts` | The handful of BACnet enumeration values this example uses - same constant names as the C++ edition's header, so the two languages diff 1:1. |

## How main.ts uses it

```ts
const udp = new SimpleUDP();
await udp.Setup(port);
await DiscoverPrimaryIPv4();                           // before GetLocalIPv4()
RegisterCommonCallbacks(udp, NETWORK_PORT_INSTANCE);   // before AddDevice
// ... AddDevice, objects, services ...
SendIAm(deviceInstance, port, NETWORK_PORT_INSTANCE);  // announce on start-up
setInterval(() => { while (BACnetStack_Tick()) {} }, 10);
StartKeyInput((key) => { /* h, q, up, down */ });
```

Unlike the B-ASC-Node edition of this file, there is no `RestartKind`/
`RequestRestart`/`RestartDue` deferred-restart pattern here: B-SS does not
implement DM-RD-B (ReinitializeDevice), so this copy of `common/` does not
carry code for a capability no example using it needs yet. Add it back (copy
from a sibling that has it) if you build a profile that requires DM-RD-B.
