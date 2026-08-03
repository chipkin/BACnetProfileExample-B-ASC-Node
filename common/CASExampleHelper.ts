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
//     byte order - written here ONCE so no example re-derives it.
//   - SendIAm(): the unsolicited I-Am every example transmits on start-up.
//   - GetLocalIPv4(): the primary interface's address/netmask/broadcast (the
//     OS-level plumbing the Network Port object reports).
//   - CLI helpers (--help/--version/--deviceID/--port) + PrintVersion().
//   - The deferred-restart pattern for DM-RD-B (RequestRestart/RestartDue).
//
// The stack PULLS datagrams: its receive callback asks for one queued datagram
// per call and the stack never touches the socket. The application (SimpleUDP)
// owns the socket - keep that split in your own project.
// =============================================================================

import * as os from "node:os";
import {
    BACnetStack_GetAPIMajorVersion,
    BACnetStack_GetAPIMinorVersion,
    BACnetStack_GetAPIPatchVersion,
    BACnetStack_GetAPIBuildVersion,
    BACnetStack_RegisterCallbackGetSystemTime,
    BACnetStack_RegisterCallbackReceiveMessage,
    BACnetStack_RegisterCallbackSendMessage,
    BACnetStack_SendIAm,
} from "@chipkin/cas-bacnet-stack";
import { NETWORK_TYPE_IP } from "./CASBACnetStackExampleConstants";
import { SimpleUDP } from "./SimpleUDP";

export const COMMON_VERSION = "1.0.0"; // Node common - see common/CHANGELOG.md

// ---------------------------------------------------------------------------
// Local IPv4 discovery
// ---------------------------------------------------------------------------

export interface LocalIPv4 {
    address: string; // e.g. "192.168.1.20"
    netmask: string; // e.g. "255.255.255.0"
    broadcast: string; // e.g. "192.168.1.255" (address | ~netmask)
}

/**
 * The primary non-internal IPv4 interface. The Network Port object reports
 * these values, and SendIAm() targets the derived subnet broadcast.
 */
export function GetLocalIPv4(): LocalIPv4 {
    for (const infos of Object.values(os.networkInterfaces())) {
        for (const info of infos ?? []) {
            if (info.family === "IPv4" && !info.internal) {
                const ip = info.address.split(".").map(Number);
                const mask = info.netmask.split(".").map(Number);
                const bcast = ip.map((octet, i) => octet | (~mask[i] & 0xff));
                return { address: info.address, netmask: info.netmask, broadcast: bcast.join(".") };
            }
        }
    }
    // No network: loopback keeps the example runnable on an offline machine.
    return { address: "127.0.0.1", netmask: "255.0.0.0", broadcast: "127.255.255.255" };
}

// ---------------------------------------------------------------------------
// The three common callbacks
// ---------------------------------------------------------------------------

/**
 * Register the receive/send/system-time callbacks against one SimpleUDP.
 * Call once, before AddDevice, in every example.
 */
export function RegisterCommonCallbacks(udp: SimpleUDP): void {
    BACnetStack_RegisterCallbackReceiveMessage(
        (
            message: Buffer,
            maxMessageLength: number,
            sourceConnectionString: Buffer,
            sourceConnectionStringLength: Buffer,
            _destinationConnectionString: Buffer,
            destinationConnectionStringLength: Buffer,
            maxConnectionStringLength: number,
            networkType: Buffer
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
            if (datagram.message.length > maxMessageLength) {
                console.error(
                    `Error: dropping ${datagram.message.length}-byte datagram from ` +
                        `${datagram.fromIp}:${datagram.fromPort} - larger than the stack's ` +
                        `${maxMessageLength}-byte receive buffer.`
                );
                return 0;
            }
            datagram.message.copy(message, 0);
            // 6-byte IPv4 connection string: 4 IP octets, then the port BIG-endian.
            const octets = datagram.fromIp.split(".").map(Number);
            sourceConnectionString[0] = octets[0];
            sourceConnectionString[1] = octets[1];
            sourceConnectionString[2] = octets[2];
            sourceConnectionString[3] = octets[3];
            sourceConnectionString.writeUInt16BE(datagram.fromPort, 4);
            sourceConnectionStringLength.writeUInt8(6, 0);
            networkType.writeUInt8(NETWORK_TYPE_IP, 0);
            return datagram.message.length;
        }
    );

    BACnetStack_RegisterCallbackSendMessage(
        (
            message: Buffer,
            messageLength: number,
            connectionString: Buffer,
            connectionStringLength: number,
            _networkType: number,
            _broadcast: boolean
        ): number => {
            if (connectionStringLength < 6) {
                return 0;
            }
            const toIp = `${connectionString[0]}.${connectionString[1]}.${connectionString[2]}.${connectionString[3]}`;
            const toPort = connectionString.readUInt16BE(4);
            // `message` is the stack's reused outgoing buffer - SimpleUDP.Send
            // hands it straight to the socket in this same tick, so no copy is
            // needed here. Copy first if you ever defer the send.
            udp.Send(message.subarray(0, messageLength), toIp, toPort);
            return messageLength;
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
 * Broadcast an unsolicited I-Am announcing this device - every example sends
 * one on start-up. Targets the LOCAL subnet broadcast (the device's own
 * network) rather than the global 255.255.255.255 / network 0xFFFF: the
 * broadcast is ip | ~mask of the primary IPv4 interface - the same network the
 * Network Port object reports.
 */
export function SendIAm(deviceInstance: number, udpPort: number): boolean {
    const local = GetLocalIPv4();
    const octets = local.broadcast.split(".").map(Number);
    const connectionString = Buffer.alloc(6);
    connectionString[0] = octets[0];
    connectionString[1] = octets[1];
    connectionString[2] = octets[2];
    connectionString[3] = octets[3];
    connectionString.writeUInt16BE(udpPort, 4);
    return BACnetStack_SendIAm(
        deviceInstance,
        connectionString,
        6,
        NETWORK_TYPE_IP,
        true /* broadcast */,
        0 /* local network */,
        Buffer.alloc(0),
        0
    );
}

// ---------------------------------------------------------------------------
// CLI helpers (--help / --version / --deviceID / --port)
// ---------------------------------------------------------------------------

export function PrintVersion(appName: string, appVersion: string): void {
    console.log(`${appName} v${appVersion}`);
    console.log(
        `CAS BACnet Stack v${BACnetStack_GetAPIMajorVersion()}.${BACnetStack_GetAPIMinorVersion()}.` +
            `${BACnetStack_GetAPIPatchVersion()}.${BACnetStack_GetAPIBuildVersion()}`
    );
}

/** Prints help/version and returns true if the process should exit. */
export function HandleHelpAndVersionArgs(argv: string[], appName: string, appVersion: string): boolean {
    if (argv.includes("--help") || argv.includes("-h")) {
        console.log(`${appName}`);
        console.log("Options:");
        console.log("  --help              Show this help and exit");
        console.log("  --version           Show version information and exit");
        console.log("  --deviceID <inst>   BACnet Device instance (0..4194302)");
        console.log("  --port <udp>        BACnet/IP UDP port (default 47808)");
        return true;
    }
    if (argv.includes("--version")) {
        PrintVersion(appName, appVersion);
        return true;
    }
    return false;
}

function parseNumberArg(argv: string[], name: string, min: number, max: number, fallback: number): number {
    const index = argv.indexOf(name);
    if (index < 0) {
        return fallback;
    }
    const raw = argv[index + 1];
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
        console.error(`Error: ${name} expects an integer ${min}..${max}, got "${raw ?? ""}".`);
        process.exit(1);
    }
    return value;
}

export function ParsePortArg(argv: string[], fallback: number): number {
    return parseNumberArg(argv, "--port", 1, 65535, fallback);
}

export function ParseDeviceIdArg(argv: string[], fallback: number): number {
    // 4194303 is the BACnet "unconfigured" sentinel - a real device may not use it.
    return parseNumberArg(argv, "--deviceID", 0, 4194302, fallback);
}

// ---------------------------------------------------------------------------
// Deferred restart (DM-RD-B) - flag + timer pattern
// ---------------------------------------------------------------------------
// Only for examples whose profile includes DM-RD-B (ReinitializeDevice).
// Most profiles in this series do not - B-ASC does not - but the pattern lives
// here so every example that needs it restarts the same, correct way.
//
// WHY DEFERRED: returning true from a ReinitializeDevice callback only ENCODES
// the SimpleACK; it does not reach the wire until a later BACnetStack_Tick().
// Restarting inside the callback means the ACK is never transmitted and the
// client sees a timeout - the classic DM-RD-B interop bug, and it fails BTL.
// So the callback sets a flag (RequestRestart) and returns true; the main loop
// polls RestartDue() after each tick and restarts only once the delay - and
// therefore the ACK - has gone out.
//
// Monotonic time on purpose: a device supporting DM-TS-B can have its wall
// clock stepped backwards mid-delay, which would fire the restart early or
// park it forever.

export enum RestartKind {
    Cold, // COLDSTART
    Warm, // WARMSTART
}

export const RESTART_DELAY_MS = 1000;

let g_restartPending = false;
let g_restartDueAtMs = 0;
let g_restartKind = RestartKind.Warm;

function monotonicMilliseconds(): number {
    return Number(process.hrtime.bigint() / 1_000_000n);
}

export function RequestRestart(kind: RestartKind, delayMilliseconds: number): void {
    const dueAt = monotonicMilliseconds() + delayMilliseconds;
    if (g_restartPending) {
        // Keep the EARLIEST deadline - a second client must not postpone a
        // restart already promised to the first. A Cold request upgrades a
        // pending Warm, never the reverse.
        if (dueAt < g_restartDueAtMs) {
            g_restartDueAtMs = dueAt;
        }
        if (kind === RestartKind.Cold) {
            g_restartKind = RestartKind.Cold;
        }
        return;
    }
    g_restartPending = true;
    g_restartDueAtMs = dueAt;
    g_restartKind = kind;
}

/** True exactly once, when a requested restart's delay has elapsed. */
export function RestartDue(): { due: boolean; kind: RestartKind } {
    if (!g_restartPending || monotonicMilliseconds() < g_restartDueAtMs) {
        return { due: false, kind: g_restartKind };
    }
    g_restartPending = false; // clears BEFORE reporting, so it fires exactly once
    return { due: true, kind: g_restartKind };
}
