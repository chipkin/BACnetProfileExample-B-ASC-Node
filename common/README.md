# `common/` - shared example plumbing (Node.js edition)

The helpers every Node.js example in the BACnet profile example series shares.
**Vendored**: this directory is a *copy* in each example repo, not a package -
change it in one repo and you must sweep the same change to every sibling and
bump `COMMON_VERSION` (in `CASExampleHelper.ts`) + add a `CHANGELOG.md` entry.

## Versioning

`COMMON_VERSION` in `CASExampleHelper.ts`, changelog in `common/CHANGELOG.md`.
The Node common versions independently of the C++ `common/` (which is at its
own version) - same rules, separate lineages.

## What's here

| File | What it is |
|---|---|
| `SimpleUDP.ts` | The UDP socket the application owns: bind, queue inbound datagrams, send. The stack never touches the socket - it pulls datagrams through the receive callback. |
| `CASExampleHelper.ts` | `RegisterCommonCallbacks()` (receive/send/system-time + the 6-byte IPv4 connection string, port big-endian, written here ONCE), `SendIAm()`, `GetLocalIPv4()`, CLI helpers, and the deferred-restart pattern for DM-RD-B. |
| `CASBACnetStackExampleConstants.ts` | The handful of BACnet enumeration values the examples use - same constant names as the C++ edition's header, so the two languages diff 1:1. |

## How main.ts uses it

```ts
const udp = new SimpleUDP();
await udp.Setup(port);
RegisterCommonCallbacks(udp);   // before AddDevice
// ... AddDevice, objects, services ...
SendIAm(deviceInstance, port);  // announce on start-up
setInterval(() => { while (BACnetStack_Tick()) {} }, 10);
```
