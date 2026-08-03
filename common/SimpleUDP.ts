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

    /**
     * Bind the socket. Resolves once listening; rejects on bind failure (for
     * example: another BACnet device already owns the port exclusively).
     */
    Setup(port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
            socket.once("error", (err) => {
                socket.close();
                reject(err);
            });
            socket.on("message", (message, rinfo) => {
                // Copy defensively: dgram reuses buffers between events.
                this.receiveQueue.push({
                    message: Buffer.from(message),
                    fromIp: rinfo.address,
                    fromPort: rinfo.port,
                });
            });
            socket.bind(port, () => {
                socket.setBroadcast(true); // I-Am goes to the subnet broadcast
                this.socket = socket;
                resolve();
            });
        });
    }

    /** The next queued inbound datagram, or undefined if none arrived. */
    Receive(): ReceivedDatagram | undefined {
        return this.receiveQueue.shift();
    }

    /**
     * Send one datagram. Fire-and-forget by design: UDP gives no delivery
     * guarantee anyway, so a send error is logged, not thrown - same behavior
     * as the C++ SimpleUDP::Send.
     */
    Send(message: Buffer, toIp: string, toPort: number): void {
        if (this.socket === null) {
            return;
        }
        this.socket.send(message, toPort, toIp, (err) => {
            if (err !== null) {
                console.error(`Error: UDP send to ${toIp}:${toPort} failed: ${err.message}`);
            }
        });
    }

    /** Close the socket (the process cannot exit while it is open). */
    Shutdown(): void {
        if (this.socket !== null) {
            this.socket.close();
            this.socket = null;
        }
    }
}
