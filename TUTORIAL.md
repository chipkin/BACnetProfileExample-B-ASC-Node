# Tutorial - extending and reviewing the B-ASC example

[README.md](README.md) says what this example *is*. This document is the
*how*: how to extend it into your own device, who serves which property, how
to review the result for conformance, and what goes wrong when you get it
subtly right.

Read this once before you start changing `main.ts`. The most expensive
mistake in this example is silent, and the section it lives in is
[Add a second analog input](#add-a-second-analog-input).

- [Extending the example](#extending-the-example)
- [What each object type needs you to serve](#what-each-object-type-needs-you-to-serve)
- [Who serves what: the application or the stack?](#who-serves-what-the-application-or-the-stack)
- [Reviewing your device](#reviewing-your-device)
- [Troubleshooting](#troubleshooting)

## Extending the example

The example is intentionally small so it's easy to change.

**Change a sensor's value or name** - edit the constants / callbacks in
`main.ts` (e.g. `g_analogInput1Value`, or the `"Bronze"` string in
`GetPropertyCharacterString`).

**Change the device identity before you ship** - vendor ID, vendor name,
model name, description, firmware revision and device name are all in the
`CHANGE ALL OF THIS BEFORE YOU SHIP` block at the top of `main.ts` §1, with a
per-field note on each saying what to change it to. That block is the
authoritative checklist; it is in the source rather than here so it cannot be
skipped by someone who only reads the code. Keep the
`LoadBACnetFunctions()` guard, the application-owned socket +
`RegisterCommonCallbacks()` shape, the commandable model
(`Commandable`/`CommandWrite`/`CommandRelinquish`), and the habit of checking
every `BACnetStack_*` return value - those are the parts of the shape, not the
identity, and every sibling example (Node or C++) keeps them too.

### Add a second analog input

Read this whole recipe before starting - the last step is the one that is
easy to miss and the one BTL will fail you for.

> **Why there are four edits, not three - and why skipping one is SILENT.**
> Most of the `GetProperty*` callbacks match on **both** object type *and*
> instance (`objectInstance === ANALOG_INPUT_INSTANCE`), so a new instance
> falls through every one of them. `GetPropertyBool`'s `Out_Of_Service` branch
> is the exception: it matches on `propertyIdentifier` alone, so
> `Out_Of_Service` works for a new instance for free.
>
> Here is the part that matters, and it is the opposite of what most people
> assume: falling through a callback does **not** reliably produce an error.
> The stack errors only for the few properties it refuses to invent -
> `Present_Value`, `Number_Of_States`, `Relinquish_Default`, `Local_Date`,
> `Local_Time`, and a Network Port's `APDU_Length`. For everything else it
> **silently substitutes a default**:
>
> | Property | If you forget to serve it | Loud? |
> |---|---|:--:|
> | `Present_Value` | Error (`value-not-initialized` on a non-commandable object) | yes |
> | `Object_Name` | reads back as the literal string **`"undefined"`** | **no** |
> | `Units` | reads back as **`no-units` (95)** | **no** |
> | `Out_Of_Service` | served on property alone - works by accident | n/a |
>
> **Doesn't the `errorCode` out-Buffer fix this?** Only if you use it, and
> only where it is right to. Each `GetProperty*`/`SetProperty*` callback
> receives an `errorCode: Buffer` that the stack pre-seeds with `success` and
> reads only when you return `false`, so you *can* turn any decline into a
> chosen BACnet error. But writing an error code on the catch-all breaks the
> device: the stack's decline-and-fabricate path is what answers required
> properties an application is not expected to serve - the Device's
> `Max_APDU_Length_Accepted`, `APDU_Timeout` and `Number_Of_APDU_Retries`
> among them. Write `errorCode` only where *this device* knows the read or
> write is wrong; `main.ts` does it for out-of-range writes
> (`SetPropertyEnumerated`, `SetPropertyUnsignedInteger`) and for
> `DeviceCommunicationControl`'s password check. The **DCC callback is the
> sharpest version of this trap**: the stack pre-seeds `errorCode` with
> `success`, so a `return false` that forgets to write an error code puts the
> absurd "Error Class SERVICES, Error Code success" on the wire instead of
> `password-failure`.
>
> It is worse than "wrong value": the object's `Property_List` **still
> advertises `Units` (117)**. So the object actively claims to have the
> property, and then answers with a default. Nothing on the wire says you
> forgot anything.
>
> So a half-added object does not look broken; it looks **healthy**. Add two
> of them and both report `Object_Name "undefined"` - duplicate object names
> inside one device, which is a spec violation and a hard BTL failure that
> every scan tool will render as a perfectly good object. **"It scanned OK"
> is exactly the failure mode, not evidence against it.**

```ts
// 1) a new instance number (in §1 Configuration).
//    Naming: a second object of a type is "<Colour> 2" - so Analog Input 2 is
//    "Bronze 2", NOT a new colour. Each object TYPE owns one colour series-wide.
const ANALOG_INPUT_2_INSTANCE = 2; // "Bronze 2"
let g_analogInput2Value = 23.1; // its live value

// 2) add the object (in main(), next to the other BACnetStack_AddObject calls).
//    Check the return, like every other stack call in this file.
if (!BACnetStack_AddObject(g_deviceInstance, OBJECT_TYPE_ANALOG_INPUT, ANALOG_INPUT_2_INSTANCE)) {
    console.error("Error: Failed to add Analog Input 2 (Bronze 2).");
    process.exit(1);
}

// 3) serve its Present_Value + Object_Name:
//    GetPropertyReal:            AI/2 + Present_Value -> value.writeFloatLE(g_analogInput2Value, 0)
//    GetPropertyCharacterString: AI/2 + Object_Name    -> text("Bronze 2")

// 4) DO NOT SKIP: serve its Units, in GetPropertyEnumerated.
//    Units is a REQUIRED property of an Analog Input. The existing check reads
//    `objectInstance === ANALOG_INPUT_INSTANCE`, which is instance 1 - so
//    without this, reading Analog Input 2's Units returns no-units(95) instead
//    of erroring, and the object is NON-CONFORMANT. It will still appear in
//    Object_List and its Present_Value will read back perfectly, so the device
//    looks healthy right up until BTL certification.
//    GetPropertyEnumerated: AI/2 + Units -> value.writeUInt32LE(ENGINEERING_UNITS_DEGREES_CELSIUS, 0)
```

Then re-run the README's Verify steps **against Analog Input 2**, not just
Analog Input 1 - read every required property and **diff it against Analog
Input 1**. Any property that comes back `"undefined"`, `no-units`, or `0`
where object 1 returns something real is a step you missed. Because the
failure is silent (see the table above), this diff is the only thing that
catches it.

### Add a second commandable output

The same shape as above, plus the commandable plumbing every output needs:

1. A new instance number and a new `Commandable` (`makeCommandable(defaultValue)`).
2. `BACnetStack_AddObject` for the new instance.
3. Extend `GetCommandable(objectType, objectInstance)` to recognise the new
   `{type, instance}` pair - **carry the pair, never match on type alone**,
   or a second output silently aliases the first's priority array.
4. Serve `Present_Value`, `Priority_Array` (per-slot, `useArrayIndex`),
   `Relinquish_Default`, and whichever type-specific required property the
   object needs (`Units` for Analog, `Polarity` for Binary,
   `Number_Of_States` for Multi-State) in the matching `Get*` callback.
5. Enable the commandable plumbing in `main()`:
   `SetPropertyEnabled(..., PRIORITY_ARRAY, true)`,
   `SetPropertyEnabled(..., RELINQUISH_DEFAULT, true)`,
   `SetPropertyWritable(..., PRESENT_VALUE, true)`.
6. Route writes through the matching `Set*` callback, validating before
   calling `CommandWrite` - an out-of-range value should get
   `ERROR_CODE_VALUE_OUT_OF_RANGE`, not silent acceptance.
7. Route `NULL` writes through `SetPropertyNull` - that is a relinquish, not
   a write of the value zero.

## What each object type needs you to serve

The application must serve every REQUIRED property the stack does not
generate. It differs per type - this is the checklist, so you do not have to
infer it:

| Object type | You must serve | Plus |
|---|---|---|
| Analog Input | `Present_Value` (Real), `Object_Name`, `Units` | - |
| Binary Input | `Present_Value` (Enumerated), `Object_Name` | `Polarity` |
| Multi-State Input | `Present_Value` (Unsigned), `Object_Name` | `Number_Of_States` |
| Analog Output | `Present_Value`, `Priority_Array`, `Relinquish_Default`, `Object_Name`, `Units` | commandable plumbing (§5 above) |
| Binary Output | `Present_Value`, `Priority_Array`, `Relinquish_Default`, `Object_Name` | `Polarity`, commandable plumbing |
| Multi-State Output | `Present_Value`, `Priority_Array`, `Relinquish_Default`, `Object_Name` | `Number_Of_States`, commandable plumbing |

For the three commandable outputs, `Present_Value` and `Priority_Array` are
served by the **application's own priority-array model**
(`CommandRead`/`CommandWrite`/`CommandRelinquish` in `main.ts` §1), not
generated by the stack - this example does not use the stack's built-in
commandable support. `Current_Command_Priority` is the one commandable
property the stack still computes for you.

## Who serves what: the application or the stack?

The single most common question when reading this file is "who answers this
property?" For Analog Output 1, the whole picture:

| Property | Served by | How |
|---|---|---|
| `Object_Identifier` | **stack** | generated from the object you added |
| `Object_Type` | **stack** | generated |
| `Object_List` | **stack** | generated (Device object) |
| `Property_List` | **stack** | generated |
| `Status_Flags` | **stack** | generated |
| `Event_State` | **stack**, sort of | no intrinsic alarming here, so nothing serves it - it reads `normal` only because `normal` is the enumeration's zero value and the stack substitutes a datatype default. Correct by coincidence, not design. |
| `Out_Of_Service` | **you** | `GetPropertyBool` - matched on property alone |
| `Present_Value` | **you** | `GetPropertyReal`, resolving `CommandRead(g_analogOutput1)` |
| `Priority_Array` | **you**, slot by slot | `GetPropertyBool` answers whether a slot is NULL; `GetPropertyReal` (with `useArrayIndex`) answers a set slot's value |
| `Relinquish_Default` | **you** | `GetPropertyReal` |
| `Current_Command_Priority` | **stack** | computed from the priority array the stack itself tracks in parallel |
| `Object_Name` | **you** | `GetPropertyCharacterString` |
| `Units` | **you** | `GetPropertyEnumerated` |

Every object, not just this one, is in [docs/PICS.md](docs/PICS.md).

Two more traps worth calling out explicitly, both silent:

- **Two `networkType` enumerations.** The Network Port object's
  `NETWORK_PORT_NETWORK_TYPE_IPV4` (5) is *not* the same enumeration as the
  message-callback `NETWORK_TYPE_IP` (0) used elsewhere in the stack's API.
  Mixing them up compiles and often "looks" fine until a client reads
  `Network_Type` and gets a nonsensical value.
- **The DCC callback has no default `errorCode`.** Unlike the `Get*`/`Set*`
  callbacks (which the stack pre-seeds with a value that is safe to leave
  alone on most declines), `DeviceCommunicationControl`'s `errorCode` Buffer
  is pre-seeded with `success` - see the callout in
  [Add a second analog input](#add-a-second-analog-input) above.

Going beyond this (COV, alarms, scheduling) means implementing a richer
profile - see the series table in [README.md](README.md).

## Reviewing your device

After you have changed anything, review it against the conformance statement
rather than against "it looked fine in the explorer":

1. Regenerate [docs/PICS.md](docs/PICS.md) after editing `docs/objects.json`
   (see [Keeping the PICS honest](#keeping-the-pics-honest) below). A ⚠ row is
   a required property nothing serves.
2. Read **every** property listed for **every** object with a BACnet client,
   and compare the value against the PICS. `"undefined"`, `no-units` and `0`
   are the three shapes a missed callback takes.
3. Diff a new object of a type against the existing one of that type. Anything
   that differs and shouldn't is a callback that matched on instance.
4. Exercise WriteProperty on all three outputs at two different priorities,
   then relinquish (write `NULL`) each priority and confirm the object falls
   through to the next set priority or to `Relinquish_Default`.
5. Send an out-of-range write to Binary Output 1 or Multi-State Output 1 and
   confirm `value-out-of-range`, not silent acceptance.
6. Exercise DeviceCommunicationControl with a wrong password (expect
   `password-failure`) and with the correct one (expect the disable/enable
   cycle to work, and confirm the stack itself now rejects further requests
   while communication is disabled).

### Keeping the PICS honest

`docs/PICS.md` is partly generated. `docs/objects.json` describes each object
and who serves which property; the series tool regenerates the object tables
from it plus the stack's own `docs/property-profile-reference.md` at the
pinned commit:

```bash
python tools/gen-objects-properties.py BACnetProfileExample-B-ASC-Node            # rewrite
python tools/gen-objects-properties.py BACnetProfileExample-B-ASC-Node --check    # fail if stale
```

(That tool lives in the example-series repository, not in this one. If you
only have this repository, edit the generated block by hand and keep it
matching the callbacks in `main.ts`.)

When you add an object or a property to `main.ts`, update `docs/objects.json`
in the same change and regenerate. The `app` list is what the callbacks
serve; `accepted` is for a required property you deliberately leave to the
stack's default, and each one needs a justification. Anything required, not
in `app` and not in `accepted`, comes out as a ⚠ row - that is a defect, not a
feature.

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| On start-up the app prints two red `Error:` lines but the device works | **Expected - this is not your bug.** Two benign sources, both from the stack's own debug logging: (1) the device receives its **own** broadcast I-Am and logs a decode cascade - any BACnet/IP device that listens for broadcasts hears itself; (2) a one-time *"UUID has not been set. A UUID must be set for the BACnetSC device to start."* - the stack starts a BACnet/SC datalink this IP-only example never configures. It appears once and does not spam. |
| `npm install` fails with `MSB...` / `unknown version undefined` on Windows | The stack's supported Windows toolset is Visual Studio 2022 (v143) Build Tools. A newer Visual Studio release is not detected correctly by node-gyp. Install VS 2022 Build Tools with the "Desktop development with C++" workload. |
| `npm install` fails to find a C++ compiler on Linux/macOS | Install a C++17 toolchain first: `sudo apt install build-essential python3 git` (Debian/Ubuntu) or `xcode-select --install` (macOS). |
| First `npm install` seems stuck for minutes | Normal - node-gyp is compiling the whole stack into a native addon. Only the first install (or one after `submodules/cas-bacnet-stack` changes) is slow. |
| `Cannot find module '@chipkin/cas-bacnet-stack'` when running `npm start` | The npm workspace link (`node_modules/@chipkin/cas-bacnet-stack`) is missing or stale - often left over from a different clone path. Run `npm install` again from this repository's root so npm relinks the workspace. |
| App prints *"could not bind UDP port 47808"* | Another BACnet program is already using 47808. Stop it, or run with `--port <n>`. |
| Client sends Who-Is but sees no I-Am | Firewall is blocking UDP 47808, or the client and device are on different subnets (Who-Is is a broadcast). Allow the port; test on the same subnet first. |
| WriteProperty returns `password-failure` even with no password sent | `DCC_PASSWORD` in `main.ts` §1 is non-empty. The callback compares by byte length and content (`Buffer.equals`), not by string equality, so an empty configured password still requires the request to carry a zero-length password, not a missing one. |
