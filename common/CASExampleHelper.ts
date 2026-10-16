// SPDX-License-Identifier: CC0-1.0
// Public-domain example code (CC0) - see ../LICENSE.

// CASExampleHelper.ts
// =============================================================================
// Shared plumbing for the BACnet examples - the Node.js edition of the C++
// examples' common/CASExampleHelper.{h,cpp}, same responsibilities, same names:
//
//   - RegisterCommonCallbacks(): the three transport/time callbacks every
//     example needs (receive, send, system time). This is where the 6-byte
//     IPv4 connection string lives: 4 IP octets then the port in BIG-endian
//     byte order - written here ONCE so no example re-derives it. Every frame
//     received and sent prints one console line ("RX ..." / "TX ..."), the
//     same lines the C++ common/ prints.
//   - SendIAm(): the unsolicited I-Am every example transmits on start-up.
//   - GetLocalIPv4(): the primary interface's address/netmask/broadcast (the
//     OS-level plumbing the Network Port object reports).
//   - CLI helpers (--help/--version/--deviceID/--port/--dcc-password),
//     PrintVersion(), PrintHelp(), and the interactive keys (StartKeyInput()).
//
// The stack PULLS datagrams: its receive callback asks for one queued datagram
// per call and the stack never touches the socket. The application (SimpleUDP)
// owns the socket - keep that split in your own project.
//
// PORT-KEYED TRANSPORT. A link is identified by the Network Port object's
// INSTANCE, not by a transport-type enumeration:
// BACnetStack_RegisterCallbackReceiveMessageForPort /
// BACnetStack_RegisterCallbackSendMessageForPort take/report a
// networkPortInstance, and BACnetStack_SendIAm's fourth argument is that same
// instance. These examples have exactly one Network Port (instance 1,
// "Vermilion"), so every call below names it directly rather than looping over
// a port table.
// =============================================================================

import * as dgram from "node:dgram";
import * as os from "node:os";
import * as readline from "node:readline";
import {
    BACnetStack_GetAPIMajorVersion,
    BACnetStack_GetAPIMinorVersion,
    BACnetStack_GetAPIPatchVersion,
    BACnetStack_GetAPIBuildVersion,
    BACnetStack_RegisterCallbackGetSystemTime,
    BACnetStack_RegisterCallbackReceiveMessageForPort,
    BACnetStack_RegisterCallbackSendMessageForPort,
    BACnetStack_SendIAm,
} from "@chipkin/cas-bacnet-stack";
import { SimpleUDP } from "./SimpleUDP";

export const COMMON_VERSION = "3.0.0"; // Node common - see common/CHANGELOG.md

// ---------------------------------------------------------------------------
// Local IPv4 discovery
// ---------------------------------------------------------------------------

export interface LocalIPv4 {
    address: string; // e.g. "192.168.1.20"
    netmask: string; // e.g. "255.255.255.0"
    broadcast: string; // e.g. "192.168.1.255" (address | ~netmask)
}

// The address of the interface that carries this host's default route, found
// once by DiscoverPrimaryIPv4(). Without it GetLocalIPv4() would take the first
// IPv4 interface Node lists - on Windows often a virtual switch (Hyper-V, WSL,
// VirtualBox) rather than the LAN adapter, so the device would report, and
// broadcast its I-Am to, a subnet no BACnet client is on.
let g_primaryAddress: string | null = null;

/**
 * Find the primary interface: the local address a UDP socket gets when it is
 * "connected" toward an outside address. Connecting a UDP socket sends nothing;
 * it only asks the OS which route (and so which interface) it would use. The
 * target is TEST-NET-1 (192.0.2.1, RFC 5737), which is never a real host. Call
 * once at start-up, before GetLocalIPv4(); on an offline machine it leaves the
 * first-interface fallback in place.
 */
export function DiscoverPrimaryIPv4(): Promise<void> {
    return new Promise((resolve) => {
        const probe = dgram.createSocket("udp4");
        const finish = (): void => {
            try {
                probe.close();
            } catch {
                // already closed
            }
            resolve();
        };
        probe.once("error", finish);
        probe.connect(47808, "192.0.2.1", () => {
            g_primaryAddress = probe.address().address;
            finish();
        });
    });
}

/**
 * The primary non-internal IPv4 interface (see DiscoverPrimaryIPv4). The
 * Network Port object reports these values, and SendIAm() targets the derived
 * subnet broadcast.
 */
export function GetLocalIPv4(): LocalIPv4 {
    const candidates = Object.values(os.networkInterfaces())
        .flatMap((interfaceAddresses) => interfaceAddresses ?? [])
        .filter((interfaceAddress) => interfaceAddress.family === "IPv4" && !interfaceAddress.internal);
    const chosen =
        candidates.find((interfaceAddress) => interfaceAddress.address === g_primaryAddress) ?? candidates[0];
    if (chosen === undefined) {
        // No network: loopback keeps the example runnable on an offline machine.
        return { address: "127.0.0.1", netmask: "255.0.0.0", broadcast: "127.255.255.255" };
    }
    const addressOctets = chosen.address.split(".").map(Number);
    const maskOctets = chosen.netmask.split(".").map(Number);
    const broadcastOctets = addressOctets.map(
        (addressOctet, octetIndex) => addressOctet | (~maskOctets[octetIndex] & 0xff)
    );
    return { address: chosen.address, netmask: chosen.netmask, broadcast: broadcastOctets.join(".") };
}

// ---------------------------------------------------------------------------
// One-line frame summaries for the RX/TX console lines
// ---------------------------------------------------------------------------
// The same "- Unconfirmed: I-Am" / "- ConfirmedRequest: ReadProperty" suffix the
// C++ common/ prints. Tests read these lines (a Wire Test counts the I-Am
// heartbeat from them on Windows), so the wording matches the C++ edition. It
// names the PDU and its service; it does not decode the object/property the C++
// edition adds after it.

const CONFIRMED_SERVICE_NAMES = [
    "AcknowledgeAlarm", "ConfirmedCOVNotification", "ConfirmedEventNotification",
    "GetAlarmSummary", "GetEnrollmentSummary", "SubscribeCOV", "AtomicReadFile",
    "AtomicWriteFile", "AddListElement", "RemoveListElement", "CreateObject",
    "DeleteObject", "ReadProperty", "ReadPropertyConditional", "ReadPropertyMultiple",
    "WriteProperty", "WritePropertyMultiple", "DeviceCommunicationControl",
    "ConfirmedPrivateTransfer", "ConfirmedTextMessage", "ReinitializeDevice",
    "VTOpen", "VTClose", "VTData", "Authenticate", "RequestKey", "ReadRange",
    "LifeSafetyOperation", "SubscribeCOVProperty", "GetEventInformation",
    "SubscribeCOVPropertyMultiple", "ConfirmedCOVNotificationMultiple",
];
const UNCONFIRMED_SERVICE_NAMES = [
    "I-Am", "I-Have", "UnconfirmedCOVNotification", "UnconfirmedEventNotification",
    "UnconfirmedPrivateTransfer", "UnconfirmedTextMessage", "TimeSynchronization",
    "Who-Has", "Who-Is", "UTCTimeSynchronization", "WriteGroup",
    "UnconfirmedCOVNotificationMultiple",
];
const REJECT_REASON_NAMES = [
    "other", "buffer-overflow", "inconsistent-parameters", "invalid-parameter-data-type",
    "invalid-tag", "missing-required-parameter", "parameter-out-of-range",
    "too-many-arguments", "undefined-enumeration", "unrecognized-service",
];
const ABORT_REASON_NAMES = [
    "other", "buffer-overflow", "invalid-apdu-in-this-state", "preempted-by-higher-priority-task",
    "segmentation-not-supported", "security-error", "insufficient-security",
    "window-size-out-of-range", "application-exceeded-reply-time", "out-of-resources",
    "tsm-timeout", "apdu-too-long",
];

function namedOrNumbered(names: string[], value: number, label: string): string {
    return value < names.length ? names[value] : `${label}=${value}`;
}

/** A one-line description of a BACnet/IP frame: its PDU type and service. */
export function SummarizeBacnetFrame(frame: Buffer): string {
    // BVLL (Annex J): 0x81, function, 2-byte length. Original-Unicast-NPDU (0x0A)
    // and Original-Broadcast-NPDU (0x0B) carry the NPDU straight after it.
    if (frame.length < 4 || frame[0] !== 0x81) {
        return "?";
    }
    const bvlcFunction = frame[1];
    let offset: number;
    if (bvlcFunction === 0x0a || bvlcFunction === 0x0b) {
        offset = 4;
    } else if (bvlcFunction === 0x04) {
        offset = 10; // Forwarded-NPDU: 6 octets of original source address first
    } else {
        return `BVLC function=0x${bvlcFunction.toString(16).toUpperCase().padStart(2, "0")}`;
    }
    // NPDU (cl. 6.2): version, control, then optional DNET/DADR, SNET/SADR, hop count.
    if (offset + 2 > frame.length) {
        return "?";
    }
    const control = frame[offset + 1];
    offset += 2;
    const hasDestination = (control & 0x20) !== 0;
    const hasSource = (control & 0x08) !== 0;
    if (hasDestination) {
        offset += 2;
        offset += 1 + (frame[offset] ?? 0);
    }
    if (hasSource) {
        offset += 2;
        offset += 1 + (frame[offset] ?? 0);
    }
    if (hasDestination) {
        offset += 1; // hop count
    }
    if (offset >= frame.length) {
        return "?";
    }
    if ((control & 0x80) !== 0) {
        return `Network-Layer-Message: type=${frame[offset]}`;
    }
    // APDU (cl. 20.1): the PDU type is the high nibble of the first octet.
    const pduType = frame[offset] >> 4;
    const serviceChoiceAt = (position: number): number | undefined =>
        position < frame.length ? frame[position] : undefined;
    let serviceChoice: number | undefined;
    switch (pduType) {
        case 0: { // Confirmed-Request: type, max segs/APDU, invoke id, [seq, window], service
            const segmented = (frame[offset] & 0x08) !== 0;
            serviceChoice = serviceChoiceAt(offset + (segmented ? 5 : 3));
            return serviceChoice === undefined
                ? "ConfirmedRequest"
                : `ConfirmedRequest: ${namedOrNumbered(CONFIRMED_SERVICE_NAMES, serviceChoice, "service")}`;
        }
        case 1:
            serviceChoice = serviceChoiceAt(offset + 1);
            return serviceChoice === undefined
                ? "Unconfirmed"
                : `Unconfirmed: ${namedOrNumbered(UNCONFIRMED_SERVICE_NAMES, serviceChoice, "service")}`;
        case 2:
            serviceChoice = serviceChoiceAt(offset + 2);
            return serviceChoice === undefined
                ? "SimpleACK"
                : `SimpleACK: ${namedOrNumbered(CONFIRMED_SERVICE_NAMES, serviceChoice, "service")}`;
        case 3: {
            const segmented = (frame[offset] & 0x08) !== 0;
            serviceChoice = serviceChoiceAt(offset + (segmented ? 4 : 2));
            return serviceChoice === undefined
                ? "ComplexACK"
                : `ComplexACK: ${namedOrNumbered(CONFIRMED_SERVICE_NAMES, serviceChoice, "service")}`;
        }
        case 4:
            return "SegmentACK";
        case 5:
            serviceChoice = serviceChoiceAt(offset + 2);
            return serviceChoice === undefined
                ? "Error"
                : `Error: ${namedOrNumbered(CONFIRMED_SERVICE_NAMES, serviceChoice, "service")}`;
        case 6: {
            const reason = serviceChoiceAt(offset + 2);
            return reason === undefined ? "Reject" : `Reject: ${namedOrNumbered(REJECT_REASON_NAMES, reason, "reason")}`;
        }
        case 7: {
            const reason = serviceChoiceAt(offset + 2);
            return reason === undefined ? "Abort" : `Abort: ${namedOrNumbered(ABORT_REASON_NAMES, reason, "reason")}`;
        }
        default:
            return "?";
    }
}

// ---------------------------------------------------------------------------
// The three common callbacks
// ---------------------------------------------------------------------------

function ipToOctets(ip: string): number[] {
    return ip.split(".").map(Number);
}

/**
 * Register the receive/send/system-time callbacks against one SimpleUDP,
 * for the given Network Port object instance. Call once, before AddDevice.
 *
 * @param networkPortInstance the instance passed to BACnetStack_AddNetworkPortObject
 *   for this socket (these examples: NETWORK_PORT_INSTANCE, 1).
 */
export function RegisterCommonCallbacks(udp: SimpleUDP, networkPortInstance: number): void {
    BACnetStack_RegisterCallbackReceiveMessageForPort(
        (
            message: Buffer,
            maxMessageLength: number,
            sourceConnectionString: Buffer,
            sourceConnectionStringLength: Buffer,
            _destinationConnectionString: Buffer,
            destinationConnectionStringLength: Buffer,
            maxConnectionStringLength: number,
            outNetworkPortInstance: Buffer
        ): number => {
            // The out-Buffers arrive UNINITIALIZED - write every one we do not
            // fill with real data, or the stack reads heap garbage.
            sourceConnectionStringLength.writeUInt8(0, 0);
            destinationConnectionStringLength.writeUInt8(0, 0);
            if (maxConnectionStringLength < 6) {
                return 0; // cannot even fit an IPv4 connection string
            }
            const datagram = udp.Receive();
            if (datagram === undefined) {
                return 0; // nothing waiting this tick
            }
            // A datagram larger than the stack's buffer is truncated to it, as the
            // C++ SimpleUDP does (the stack then fails to decode it and ignores it).
            const length = Math.min(datagram.message.length, maxMessageLength);
            datagram.message.copy(message, 0, 0, length);
            console.log(
                `RX ${length} bytes from ${datagram.fromIp}:${datagram.fromPort} ` +
                    `(Network Port ${networkPortInstance}) - ${SummarizeBacnetFrame(datagram.message.subarray(0, length))}`
            );
            // 6-byte IPv4 connection string: 4 IP octets, then the port BIG-endian.
            const fromOctets = ipToOctets(datagram.fromIp);
            sourceConnectionString[0] = fromOctets[0];
            sourceConnectionString[1] = fromOctets[1];
            sourceConnectionString[2] = fromOctets[2];
            sourceConnectionString[3] = fromOctets[3];
            sourceConnectionString.writeUInt16BE(datagram.fromPort, 4);
            sourceConnectionStringLength.writeUInt8(6, 0);
            // Which Network Port object this datagram arrived on - a 4-byte
            // out-Buffer, uint32 LITTLE-ENDIAN.
            outNetworkPortInstance.writeUInt32LE(networkPortInstance, 0);
            return length;
        }
    );

    // The stack hands the destination as a connection string (IP[4] + port[2]).
    //
    // A length-0 connection string is the stack saying "broadcast on this data
    // link" (BACnetStack_RegisterCallbackSendMessageForPort's contract): it goes
    // to the local subnet broadcast on this socket's port. A connection string of
    // 1-5 octets is not a BACnet/IP address and is refused.
    //
    // broadcast = true WITH this socket's OWN address means "this subnet" too: the
    // stack passes its own address that way for the Device_Address_Binding's
    // Who-Is and a BBMD's two-hop re-broadcast (stack issue #3933). Unicast to
    // ourselves, no other device would ever receive it, so it goes to the subnet
    // broadcast instead. Every other address is sent to as given.
    BACnetStack_RegisterCallbackSendMessageForPort(
        (
            message: Buffer,
            messageLength: number,
            connectionString: Buffer,
            connectionStringLength: number,
            sendNetworkPortInstance: number,
            broadcast: boolean
        ): number => {
            if (sendNetworkPortInstance !== networkPortInstance &&
                sendNetworkPortInstance !== 4194303 /* BACNET_NETWORK_PORT_DEFAULT */) {
                return 0; // not the one Network Port this socket belongs to
            }
            const local = GetLocalIPv4();
            let toIp: string;
            let toPort: number;
            let isBroadcast = broadcast;
            if (connectionStringLength === 0) {
                toIp = local.broadcast;
                toPort = udp.Port();
                isBroadcast = true;
            } else if (connectionStringLength < 6) {
                return 0;
            } else {
                toIp = `${connectionString[0]}.${connectionString[1]}.${connectionString[2]}.${connectionString[3]}`;
                toPort = connectionString.readUInt16BE(4);
                if (broadcast && toPort === udp.Port() && toIp === local.address) {
                    toIp = local.broadcast; // a broadcast addressed to this socket itself
                }
            }
            const frame = message.subarray(0, messageLength);
            const sent = udp.Send(frame, toIp, toPort);
            console.log(
                `TX ${sent} bytes to ${toIp}:${toPort}${isBroadcast ? " (broadcast)" : ""} ` +
                    `(Network Port ${networkPortInstance}) - ${SummarizeBacnetFrame(frame)}`
            );
            return sent;
        }
    );

    BACnetStack_RegisterCallbackGetSystemTime((): number => {
        return Math.floor(Date.now() / 1000); // unix epoch SECONDS
    });
}

// ---------------------------------------------------------------------------
// I-Am
// ---------------------------------------------------------------------------

/**
 * Broadcast an unsolicited I-Am announcing this device. Targets the LOCAL
 * subnet broadcast (the device's own network) rather than the global
 * 255.255.255.255 / network 0xFFFF: the broadcast is ip | ~mask of the primary
 * IPv4 interface - the same network the Network Port object reports.
 *
 * Returns what BACnetStack_SendIAm returns. While a DeviceCommunicationControl
 * DISABLE_INITIATION is in force the stack refuses an unsolicited I-Am, and the
 * send callback (and its TX line) never runs.
 *
 * @param networkPortInstance the Network Port object to send on (these
 *   examples: NETWORK_PORT_INSTANCE, 1).
 */
export function SendIAm(deviceInstance: number, udpPort: number, networkPortInstance: number): boolean {
    const broadcastOctets = ipToOctets(GetLocalIPv4().broadcast);
    const connectionString = Buffer.alloc(6);
    connectionString[0] = broadcastOctets[0];
    connectionString[1] = broadcastOctets[1];
    connectionString[2] = broadcastOctets[2];
    connectionString[3] = broadcastOctets[3];
    connectionString.writeUInt16BE(udpPort, 4);
    return BACnetStack_SendIAm(
        deviceInstance,
        connectionString,
        6,
        networkPortInstance,
        true /* broadcast */,
        0 /* local network */,
        Buffer.alloc(0),
        0
    );
}

// ---------------------------------------------------------------------------
// Version, help, command line
// ---------------------------------------------------------------------------

export function PrintVersion(appName: string, appVersion: string): void {
    console.log(`${appName} v${appVersion}`);
    console.log(
        `CAS BACnet Stack version: ${BACnetStack_GetAPIMajorVersion()}.${BACnetStack_GetAPIMinorVersion()}.` +
            `${BACnetStack_GetAPIPatchVersion()}.${BACnetStack_GetAPIBuildVersion()}`
    );
    console.log(`Common helper (common/) version: ${COMMON_VERSION}`);
}

function PrintInteractiveCommands(): void {
    console.log("Commands:");
    console.log("  h     - show this help (version + commands)");
    console.log("  q     - quit");
    console.log("  up    - increase Analog Input 1 by 1.1");
    console.log("  down  - decrease Analog Input 1 by 1.1");
}

/** The 'h' key: version banner plus the interactive commands. */
export function PrintHelp(appName: string, appVersion: string): void {
    PrintVersion(appName, appVersion);
    PrintInteractiveCommands();
}

/**
 * Handle --help / --version. Prints and returns true if the process should
 * exit. `showDccPasswordCliOption` lists --dcc-password in the help, for an
 * example that parses it (ParseDccPasswordArg).
 */
export function HandleHelpAndVersionArgs(
    argv: string[],
    appName: string,
    appVersion: string,
    showDccPasswordCliOption = true
): boolean {
    for (const argument of argv) {
        if (argument === "--help" || argument === "-h" || argument === "/?") {
            PrintVersion(appName, appVersion);
            console.log("");
            console.log("Usage: npm start -- [options]   (or: node dist/main.js [options])");
            console.log("");
            console.log("Options:");
            console.log("  --help, -h        Show this help and exit.");
            console.log("  --version         Show version information and exit.");
            console.log("  --deviceID <n>    BACnet device instance (0..4194302). Each example in");
            console.log("                    this series has its own default so several can run on");
            console.log("                    one subnet at once.");
            console.log("  --port <n>        BACnet/IP UDP port (1..65535). Default 47808 (0xBAC0).");
            console.log("                    Use a non-default port to avoid clashing with another");
            console.log("                    BACnet device already on 47808 on this host.");
            if (showDccPasswordCliOption) {
                console.log("  --dcc-password <string>");
                console.log("                    DeviceCommunicationControl password. Default \"\" (no");
                console.log("                    password required). Set to require a matching password on");
                console.log("                    DeviceCommunicationControl requests - see this example's own");
                console.log("                    DeviceCommunicationControl callback for how it is checked.");
            }
            console.log("");
            PrintInteractiveCommands();
            return true;
        }
        if (argument === "--version") {
            PrintVersion(appName, appVersion);
            return true;
        }
    }
    return false;
}

/** The whole token as a non-negative integer, or undefined (no silent "abc" -> 0). */
function ParseWholeNumber(text: string | undefined): number | undefined {
    if (text === undefined || !/^[0-9]+$/.test(text)) {
        return undefined;
    }
    const value = Number(text);
    return Number.isSafeInteger(value) ? value : undefined;
}

export function ParsePortArg(argv: string[], defaultPort: number): number {
    for (let argumentIndex = 0; argumentIndex + 1 < argv.length; ++argumentIndex) {
        if (argv[argumentIndex] === "--port") {
            const port = ParseWholeNumber(argv[argumentIndex + 1]);
            if (port !== undefined && port > 0 && port <= 65535) {
                return port;
            }
            console.log(`Warning: ignoring invalid --port "${argv[argumentIndex + 1]}" (want 1..65535); using ${defaultPort}.`);
        }
    }
    return defaultPort;
}

export function ParseDeviceIdArg(argv: string[], defaultDeviceId: number): number {
    for (let argumentIndex = 0; argumentIndex + 1 < argv.length; ++argumentIndex) {
        if (argv[argumentIndex] === "--deviceID") {
            // 0 .. 4194302 is the valid BACnet device instance range (4194303 is
            // the "unconfigured" wildcard and is not a usable instance).
            const deviceId = ParseWholeNumber(argv[argumentIndex + 1]);
            if (deviceId !== undefined && deviceId < 4194303) {
                return deviceId;
            }
            console.log(`Warning: ignoring invalid --deviceID "${argv[argumentIndex + 1]}" (want 0..4194302); using ${defaultDeviceId}.`);
        }
    }
    return defaultDeviceId;
}

export function ParseDccPasswordArg(argv: string[], defaultPassword: string): string {
    for (let argumentIndex = 0; argumentIndex + 1 < argv.length; ++argumentIndex) {
        if (argv[argumentIndex] === "--dcc-password") {
            return argv[argumentIndex + 1];
        }
    }
    return defaultPassword;
}

// ---------------------------------------------------------------------------
// Interactive keys
// ---------------------------------------------------------------------------

export enum KeyCommand {
    Help,
    Quit,
    ArrowUp,
    ArrowDown,
}

/**
 * Deliver the interactive keys (h, q, up, down) to `onKey`. In a terminal the
 * keys arrive one at a time (raw mode); when stdin is a PIPE - a test harness
 * or a service manager - the same characters are read from it, so writing "q"
 * to the pipe quits the example, as it does the C++ edition on Linux. Ctrl+C in
 * a terminal is Quit too. Returns a function that restores the terminal.
 */
export function StartKeyInput(onKey: (key: KeyCommand) => void): () => void {
    if (process.stdin.isTTY) {
        readline.emitKeypressEvents(process.stdin);
        process.stdin.setRawMode(true);
        process.stdin.on("keypress", (_text: string, key: readline.Key | undefined) => {
            if (key === undefined) {
                return;
            }
            if (key.name === "q" || (key.ctrl === true && key.name === "c")) {
                onKey(KeyCommand.Quit);
            } else if (key.name === "h") {
                onKey(KeyCommand.Help);
            } else if (key.name === "up") {
                onKey(KeyCommand.ArrowUp);
            } else if (key.name === "down") {
                onKey(KeyCommand.ArrowDown);
            }
        });
    } else {
        process.stdin.on("data", (chunk: Buffer) => {
            const text = chunk.toString("latin1");
            for (let characterIndex = 0; characterIndex < text.length; ++characterIndex) {
                const character = text[characterIndex];
                if (character === "\x1b" && text[characterIndex + 1] === "[") {
                    const arrow = text[characterIndex + 2];
                    if (arrow === "A") {
                        onKey(KeyCommand.ArrowUp);
                    } else if (arrow === "B") {
                        onKey(KeyCommand.ArrowDown);
                    }
                    characterIndex += 2;
                } else if (character === "h" || character === "H") {
                    onKey(KeyCommand.Help);
                } else if (character === "q" || character === "Q") {
                    onKey(KeyCommand.Quit);
                }
            }
        });
        process.stdin.on("error", () => {
            // A closed or broken stdin is not a reason to stop serving BACnet.
        });
    }
    return () => {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        process.stdin.pause();
    };
}
