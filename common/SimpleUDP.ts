// SPDX-License-Identifier: CC0-1.0
// Public-domain example code (CC0) - see ../LICENSE.

// SimpleUDP.ts
// =============================================================================
// A minimal UDP wrapper for the BACnet examples - the Node.js edition of the
// C++ examples' common/SimpleUDP.{h,cpp}, with the same responsibilities:
//
//   - own ONE datagram socket bound to the BACnet/IP port,
//   - queue inbound datagrams so the stack can PULL them one at a time from its
//     receive callback (the stack never owns the socket - the application does),
//   - send outbound datagrams where the stack's send callback points.
//
// The class never sees a BACnet "connection string" - it deals in host-order
// ip/port pairs. Packing the 6-byte connection string (4 IP octets + 2 port
// bytes, port BIG-endian) is CASExampleHelper's job, exactly as in C++.
// =============================================================================

import * as dgram from "node:dgram";

/** One received datagram, queued until the stack asks for it. */
export interface ReceivedDatagram {
    message: Buffer;
    fromIp: string;
    fromPort: number;
}

export class SimpleUDP {
    private socket: dgram.Socket | null = null;
    private readonly receiveQueue: ReceivedDatagram[] = [];
    private boundPort = 0;

    /**
     * Called (if set) every time a datagram is queued. The main loop uses it to
     * run BACnetStack_Tick() as soon as a request arrives instead of waiting for
     * its next timer - see "The main loop" in main.ts.
     */
    onDatagramQueued: (() => void) | null = null;

    /**
     * Bind the socket. Resolves once listening; rejects on bind failure (for
     * example: another BACnet device already owns the port exclusively).
     */
    Setup(port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            // Windows: no SO_REUSEADDR, so a second device on the same port fails to
            // bind instead of silently sharing it (the C++ SimpleUDP asks for
            // SO_EXCLUSIVEADDRUSE there). Linux/macOS: SO_REUSEADDR, as the C++
            // edition sets, so a test listener can share the port to watch broadcasts.
            const socket = dgram.createSocket({ type: "udp4", reuseAddr: process.platform !== "win32" });
            socket.once("error", (bindError) => {
                socket.close();
                reject(bindError);
            });
            socket.on("message", (message, remoteInfo) => {
                // Copy defensively: dgram reuses buffers between events.
                this.receiveQueue.push({
                    message: Buffer.from(message),
                    fromIp: remoteInfo.address,
                    fromPort: remoteInfo.port,
                });
                if (this.onDatagramQueued !== null) {
                    this.onDatagramQueued();
                }
            });
            socket.bind(port, () => {
                socket.setBroadcast(true); // I-Am goes to the subnet broadcast
                this.socket = socket;
                this.boundPort = port;
                resolve();
            });
        });
    }

    /** The UDP port this socket is bound to (0 before Setup()). */
    Port(): number {
        return this.boundPort;
    }

    /** The next queued inbound datagram, or undefined if none arrived. */
    Receive(): ReceivedDatagram | undefined {
        return this.receiveQueue.shift();
    }

    /**
     * Send one datagram. Fire-and-forget by design: UDP gives no delivery
     * guarantee anyway, so a send error is logged, not thrown - same behaviour
     * as the C++ SimpleUDP::Send. The message is copied first, because the
     * stack reuses its outgoing buffer and dgram sends asynchronously.
     */
    Send(message: Buffer, toIp: string, toPort: number): number {
        if (this.socket === null) {
            return 0;
        }
        const datagram = Buffer.from(message);
        this.socket.send(datagram, toPort, toIp, (sendError) => {
            if (sendError !== null) {
                console.error(`Error: UDP send to ${toIp}:${toPort} failed: ${sendError.message}`);
            }
        });
        return datagram.length;
    }

    /** Close the socket (the process cannot exit while it is open). */
    Shutdown(): void {
        if (this.socket !== null) {
            this.socket.close();
            this.socket = null;
        }
    }
}
