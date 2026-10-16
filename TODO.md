# TODO

Defects found while porting this example to stack `6.x` @ `64b2cfac5` (Node
package 6.1.2), each with its upstream issue and evidence.

## Adapter defect, [cas-bacnet-stack#3969](https://github.com/chipkin/cas-bacnet-stack/issues/3969): the DeviceCommunicationControl wrapper hands JS an unseeded errorCode Buffer

**Where.** `submodules/cas-bacnet-stack/adapters/node/@chipkin/cas-bacnet-stack/src/interface_callbacks.cc`,
`RegisterCallbackDeviceCommunicationControlWrapped` (around line 2631):

```cpp
Napi::Buffer<uint32_t> errorCodeBuffer = Napi::Buffer<uint32_t>::New(env, sizeof(uint32_t));
...
memcpy_s(errorCode, sizeof(uint32_t), errorCodeBuffer.Data(), sizeof(uint32_t));
```

`Napi::Buffer::New` is not zero-filled, the buffer is never seeded from the
stack's preset `*errorCode`, and it is copied back unconditionally. The
`SetProperty*` wrappers in the same file (e.g. `RegisterCallbackSetPropertyReal`,
around line 1559) seed it from `*errorCode` with the comment "Napi::Buffer::New
is not zero-filled ... Seed it from the stack's preset so a JS callback that
leaves it untouched ... hands back success, not heap garbage". The DCC wrapper
does not. (It also allocates `sizeof(uint32_t)` *elements* of `uint32_t`, 16
bytes, where 4 are meant - harmless.)

**Effect at this pin.** None on the wire for a callback that follows the rule
"set `errorCode` on every `false` return", which `main.ts` does.
`BACnetDeviceCommunicationControlProcessor.cpp` (line ~172) reads `errorCode`
only after a `false` return, and maps any value other than
`optional-functionality-not-supported` / `service-request-denied` to SECURITY /
password-failure, so a JS callback that returns `false` without naming an error
gets password-failure rather than a garbage code. The garbage copied back on a
`true` return is never read.

**Workaround.** None needed; `main.ts` names the error on every `false` return
(the same contract the C++ reference documents). Not patched here: the adapter
is used in place from the submodule.
