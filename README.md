# BACnet B-ASC (Application Specific Controller) - Node.js example

> **Status: in design.** The Node adapter and example design is under internal
> review; this repository holds the scaffold only — no application code yet.
> The completed C++ edition of this profile is
> [BACnetProfileExample-B-ASC-CPP](https://github.com/chipkin/BACnetProfileExample-B-ASC-CPP).

This repository holds the Node.js edition of the CAS BACnet Stack **B-ASC**
(Application Specific Controller, ANSI/ASHRAE 135 Annex L) profile example —
part of the BACnet profile example series: one self-contained tutorial per
device profile, kept as identical as possible across languages so you can diff
the Node.js and C++ editions side by side.

## Requires the CAS BACnet Stack (licensed product)

The CAS BACnet Stack, a commercial Chipkin product, is included as the git
submodule `submodules/cas-bacnet-stack`, tracking the `6.x-TestTool` branch.
You need a licence to fetch and build it: <https://store.chipkin.com/> or
sales@chipkin.com.

## Get the code

```bash
git clone --recursive https://github.com/chipkin/BACnetProfileExample-B-ASC-Node.git
```

Already cloned without `--recursive`?

```bash
git submodule update --init --recursive
```

## License

The example source code is [CC0-1.0](LICENSE) (public domain). The CAS BACnet
Stack submodule is licensed separately.
