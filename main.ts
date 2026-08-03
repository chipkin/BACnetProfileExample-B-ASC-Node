// SPDX-License-Identifier: CC0-1.0
// Public-domain example code (CC0) - see LICENSE.

// BACnet B-ASC (Application Specific Controller) example - Node.js
// =============================================================================
// A complete, minimal BACnet/IP device implementing the B-ASC device profile of
// ANSI/ASHRAE 135 Annex L: an Application Specific Controller is a B-SA (Smart
// Actuator) plus DeviceCommunicationControl. In BIBB terms this example
// executes DS-RP-B, DS-WP-B, DM-DCC-B, DM-DDB-B and DM-DOB-B - and nothing
// more. No COV, no alarms, no scheduling, no trending, no ReadPropertyMultiple:
// implementing exactly one profile is the point of this example.
//
// This is the Node.js edition of BACnetProfileExample-B-ASC-CPP - same
// objects, same names, same section layout, same function names - so you can
// diff the two side by side. The systematic differences are the language's:
// out-parameters arrive as Buffers (value.writeFloatLE(...) instead of
// *value = ...), and the main loop is a timer instead of a while().
//
// Layout (same four numbered sections as the C++ edition):
//   1. Configuration - identity, objects, and the commandable-output model
//   2. Get callbacks - the stack PULLS every property value it serves
//   2b. Set callbacks - WriteProperty lands here (priority array semantics)
//   2c. DCC callback - the B-ASC addition (DeviceCommunicationControl)
//   3. main() - load, configure, announce, tick
// =============================================================================

import {
    LoadBACnetFunctions,
    CASBACnetStackAdapter_LastError,
    BACnetStack_AddDevice,
    BACnetStack_AddNetworkPortObjectWithNetworkNumber,
    BACnetStack_AddObject,
    BACnetStack_RegisterCallbackDeviceCommunicationControl,
    BACnetStack_RegisterCallbackGetPropertyBool,
    BACnetStack_RegisterCallbackGetPropertyCharacterString,
    BACnetStack_RegisterCallbackGetPropertyEnumerated,
    BACnetStack_RegisterCallbackGetPropertyOctetString,
    BACnetStack_RegisterCallbackGetPropertyReal,
    BACnetStack_RegisterCallbackGetPropertyUnsignedInteger,
    BACnetStack_RegisterCallbackSetPropertyEnumerated,
    BACnetStack_RegisterCallbackSetPropertyNull,
    BACnetStack_RegisterCallbackSetPropertyReal,
    BACnetStack_RegisterCallbackSetPropertyUnsignedInteger,
    BACnetStack_SetPropertyEnabled,
    BACnetStack_SetPropertyWritable,
    BACnetStack_SetServiceEnabled,
    BACnetStack_Tick,
} from "@chipkin/cas-bacnet-stack";
import * as readline from "node:readline";
import {
    BACNET_IP_MODE_NORMAL,
    CHARACTER_STRING_ENCODING_UTF8,
    ENGINEERING_UNITS_DEGREES_CELSIUS,
    ENGINEERING_UNITS_PERCENT,
    ERROR_CODE_OPTIONAL_FUNCTIONALITY_NOT_SUPPORTED,
    ERROR_CODE_PASSWORD_FAILURE,
    ERROR_CODE_VALUE_OUT_OF_RANGE,
    NETWORK_NUMBER_QUALITY_UNKNOWN,
    NETWORK_PORT_NETWORK_TYPE_IPV4,
    NETWORK_PORT_PROTOCOL_LEVEL_BACNET_APPLICATION,
    NETWORK_PORT_REFERENCE_PORT_NONE,
    OBJECT_TYPE_ANALOG_INPUT,
    OBJECT_TYPE_ANALOG_OUTPUT,
    OBJECT_TYPE_BINARY_INPUT,
    OBJECT_TYPE_BINARY_OUTPUT,
    OBJECT_TYPE_DEVICE,
    OBJECT_TYPE_MULTI_STATE_INPUT,
    OBJECT_TYPE_MULTI_STATE_OUTPUT,
    OBJECT_TYPE_NETWORK_PORT,
    POLARITY_NORMAL,
    PROPERTY_IDENTIFIER_APDU_LENGTH,
    PROPERTY_IDENTIFIER_APPLICATION_SOFTWARE_VERSION,
    PROPERTY_IDENTIFIER_BACNET_IP_MODE,
    PROPERTY_IDENTIFIER_BACNET_IP_UDP_PORT,
    PROPERTY_IDENTIFIER_DESCRIPTION,
    PROPERTY_IDENTIFIER_FIRMWARE_REVISION,
    PROPERTY_IDENTIFIER_IP_ADDRESS,
    PROPERTY_IDENTIFIER_IP_DEFAULT_GATEWAY,
    PROPERTY_IDENTIFIER_IP_SUBNET_MASK,
    PROPERTY_IDENTIFIER_MODEL_NAME,
    PROPERTY_IDENTIFIER_NUMBER_OF_STATES,
    PROPERTY_IDENTIFIER_OBJECT_NAME,
    PROPERTY_IDENTIFIER_OUT_OF_SERVICE,
    PROPERTY_IDENTIFIER_POLARITY,
    PROPERTY_IDENTIFIER_PRESENT_VALUE,
    PROPERTY_IDENTIFIER_PRIORITY_ARRAY,
    PROPERTY_IDENTIFIER_REFERENCE_PORT,
    PROPERTY_IDENTIFIER_RELINQUISH_DEFAULT,
    PROPERTY_IDENTIFIER_STATE_TEXT,
    PROPERTY_IDENTIFIER_UNITS,
    PROPERTY_IDENTIFIER_VENDOR_IDENTIFIER,
    PROPERTY_IDENTIFIER_VENDOR_NAME,
    SERVICE_DEVICE_COMMUNICATION_CONTROL,
    SERVICE_I_AM,
    SERVICE_I_HAVE,
    SERVICE_READ_PROPERTY,
    SERVICE_WHO_HAS,
    SERVICE_WHO_IS,
    SERVICE_WRITE_PROPERTY,
} from "./common/CASBACnetStackExampleConstants";
import {
    GetLocalIPv4,
    HandleHelpAndVersionArgs,
    ParseDeviceIdArg,
    ParsePortArg,
    PrintVersion,
    RegisterCommonCallbacks,
    SendIAm,
} from "./common/CASExampleHelper";
import { SimpleUDP } from "./common/SimpleUDP";

// =============================================================================
// 1. Configuration
// =============================================================================
// >>> CHANGE ALL OF THIS BEFORE YOU SHIP <<<
// The device identity below belongs to this EXAMPLE, not to your product.
// Vendor ID 389 is Chipkin Automation Systems' - get your own vendor ID from
// ASHRAE (https://bacnet.org/assigned-vendor-ids/) and pick your own device
// instance (it must be unique on the whole BACnet internetwork).

const APP_NAME = "BACnet B-ASC (Application Specific Controller) Example - Node";
const APP_VERSION = "1.0.0";

// Every example in this series has its own default device instance (B-ASC =
// 389003, see the series' device-instance table) so several examples can run
// on one subnet. Overridable at runtime with --deviceID, as BACnet requires.
let g_deviceInstance = 389003;
const VENDOR_IDENTIFIER = 389; // Chipkin Automation Systems
const DEVICE_NAME = "Rainbow";
const DEVICE_DESCRIPTION = "BACnet B-ASC (Application Specific Controller) example - Node.js";
const VENDOR_NAME = "Chipkin Automation Systems";
const MODEL_NAME = "CAS BACnet Stack B-ASC Example";

// DM-DCC-B: the password a client must present with DeviceCommunicationControl.
// Empty string = accept requests that carry no password (and requests carrying
// one are still compared - see the DCC callback).
const DCC_PASSWORD = "";

// Object instances - instances start at 1 in every example of this series.
const ANALOG_INPUT_INSTANCE = 1; //      "Bronze"     - room temperature, read-only
const BINARY_INPUT_INSTANCE = 1; //      "Emerald"    - a contact, read-only
const MULTI_STATE_INPUT_INSTANCE = 1; // "Hot Pink"   - a 3-state selector, read-only
const ANALOG_OUTPUT_INSTANCE = 1; //     "Chartreuse" - commandable REAL
const BINARY_OUTPUT_INSTANCE = 1; //     "Fuchsia"    - commandable active/inactive
const MULTI_STATE_OUTPUT_INSTANCE = 1; // "Indigo"    - commandable state 1..3
const NETWORK_PORT_INSTANCE = 1; //      "Vermilion"  - the BACnet/IP port itself
const MAX_APDU_LENGTH = 1476; // BACnet/IP APDU length (1497-byte frame minus headers)

// Input values (series-standard starting values). The arrow keys nudge the
// Analog Input at runtime so you can watch the value change from a client.
let g_analogInput1Value = 21.5; // degrees Celsius
const g_binaryInput1Value = 0; // 0 = inactive
const g_multiStateInput1Value = 1; // state 1 ("On")
const MULTI_STATE_TEXT = ["On", "Off", "Auto"]; // State_Text, 1-based on the wire

// Networking (served by the Network Port object; filled in main()).
let g_udpPort = 47808;
let g_ipAddress: number[] = [0, 0, 0, 0];
let g_ipSubnetMask: number[] = [0, 0, 0, 0];
const g_ipDefaultGateway: number[] = [0, 0, 0, 0]; // a real product reports its real gateway

// --- The commandable-output model (DS-WP-B) ---------------------------------
// A commandable object's Present_Value is not a simple variable: it is the
// highest-priority entry of a 16-slot Priority_Array, falling back to
// Relinquish_Default when every slot is NULL. The APPLICATION owns this model
// - the stack asks for the slots through the Get callbacks and delivers
// writes/relinquishes through the Set callbacks.

interface Commandable {
    isSet: boolean[]; // 16 slots; false = NULL
    value: number[]; // 16 slots; meaningful only where isSet
    relinquishDefault: number;
}

function makeCommandable(relinquishDefault: number): Commandable {
    return { isSet: new Array(16).fill(false), value: new Array(16).fill(0), relinquishDefault };
}

const g_analogOutput1 = makeCommandable(0.0);
const g_binaryOutput1 = makeCommandable(0); // inactive
const g_multiStateOutput1 = makeCommandable(1); // state 1

/** BACnet priorities are 1..16; a write without one (priority 0) acts at 16. */
function EffectivePriority(priority: number): number {
    return priority >= 1 && priority <= 16 ? priority : 16;
}

function CommandWrite(c: Commandable, priority: number, value: number): void {
    const slot = EffectivePriority(priority) - 1;
    c.isSet[slot] = true;
    c.value[slot] = value;
}

function CommandRelinquish(c: Commandable, priority: number): void {
    c.isSet[EffectivePriority(priority) - 1] = false;
}

/** Present_Value = highest-priority set slot, else Relinquish_Default. */
function CommandRead(c: Commandable): number {
    for (let slot = 0; slot < 16; slot++) {
        if (c.isSet[slot]) {
            return c.value[slot];
        }
    }
    return c.relinquishDefault;
}

/** The commandable object for a {type, instance} pair, or null. Carry the PAIR
 *  - never match on a hardcoded instance - so adding a second output later
 *  cannot silently alias the first. */
function GetCommandable(objectType: number, objectInstance: number): Commandable | null {
    if (objectType === OBJECT_TYPE_ANALOG_OUTPUT && objectInstance === ANALOG_OUTPUT_INSTANCE) {
        return g_analogOutput1;
    }
    if (objectType === OBJECT_TYPE_BINARY_OUTPUT && objectInstance === BINARY_OUTPUT_INSTANCE) {
        return g_binaryOutput1;
    }
    if (objectType === OBJECT_TYPE_MULTI_STATE_OUTPUT && objectInstance === MULTI_STATE_OUTPUT_INSTANCE) {
        return g_multiStateOutput1;
    }
    return null;
}

// =============================================================================
// 2. Get callbacks
// =============================================================================
// The stack PULLS: when a client reads a property the stack serves internally
// (Object_List, Protocol_Services_Supported, ...) it answers alone; for the
// values only the application knows, it calls these callbacks, routed by
// DATATYPE - one callback per BACnet primitive type.
//
// SILENT TRAP - a `false` return usually does NOT produce a BACnet error.
// The stack substitutes a default for everything it can invent: Object_Name
// becomes the literal "undefined", Units becomes no-units(95). It errors only
// for the values it refuses to invent: Present_Value, Number_Of_States,
// Relinquish_Default, Local_Date, Local_Time, and a Network Port's
// APDU_Length. So two half-added objects both report Object_Name "undefined" -
// duplicate names in one device, a spec violation - and every scan tool
// renders the device as healthy. Serve EVERY property of every object you add.

/** Write `text` into a CharacterString out-Buffer, clamped to the stack's
 *  maximum, and report the byte count + UTF-8 encoding. */
function ReturnCharacterString(
    text: string,
    value: Buffer,
    valueElementCount: Buffer,
    maxElementCount: number,
    encodingType: Buffer
): boolean {
    const bytes = Buffer.from(text, "utf8");
    const length = Math.min(bytes.length, maxElementCount); // silent truncation, like the C++ edition
    bytes.copy(value, 0, 0, length);
    valueElementCount.writeUInt32LE(length, 0);
    encodingType.writeUInt8(CHARACTER_STRING_ENCODING_UTF8, 0);
    return true;
}

function GetPropertyReal(
    _deviceInstance: number,
    objectType: number,
    objectInstance: number,
    propertyIdentifier: number,
    value: Buffer,
    useArrayIndex: boolean,
    propertyArrayIndex: number
): boolean {
    // Analog Input 1 ("Bronze") - the value this device exists to report.
    if (
        objectType === OBJECT_TYPE_ANALOG_INPUT &&
        objectInstance === ANALOG_INPUT_INSTANCE &&
        propertyIdentifier === PROPERTY_IDENTIFIER_PRESENT_VALUE
    ) {
        value.writeFloatLE(g_analogInput1Value, 0);
        return true;
    }
    // Analog Output 1 ("Chartreuse") - the commandable model serves
    // Present_Value, the Priority_Array slots (the stack asks slot-by-slot
    // with useArrayIndex), and Relinquish_Default.
    if (objectType === OBJECT_TYPE_ANALOG_OUTPUT && objectInstance === ANALOG_OUTPUT_INSTANCE) {
        if (propertyIdentifier === PROPERTY_IDENTIFIER_PRESENT_VALUE) {
            value.writeFloatLE(CommandRead(g_analogOutput1), 0);
            return true;
        }
        if (
            propertyIdentifier === PROPERTY_IDENTIFIER_PRIORITY_ARRAY &&
            useArrayIndex &&
            propertyArrayIndex >= 1 &&
            propertyArrayIndex <= 16
        ) {
            value.writeFloatLE(g_analogOutput1.value[propertyArrayIndex - 1], 0);
            return true;
        }
        if (propertyIdentifier === PROPERTY_IDENTIFIER_RELINQUISH_DEFAULT) {
            value.writeFloatLE(g_analogOutput1.relinquishDefault, 0);
            return true;
        }
    }
    return false;
}

function GetPropertyEnumerated(
    _deviceInstance: number,
    objectType: number,
    objectInstance: number,
    propertyIdentifier: number,
    value: Buffer,
    useArrayIndex: boolean,
    propertyArrayIndex: number
): boolean {
    // Binary Input 1 ("Emerald").
    if (objectType === OBJECT_TYPE_BINARY_INPUT && objectInstance === BINARY_INPUT_INSTANCE) {
        if (propertyIdentifier === PROPERTY_IDENTIFIER_PRESENT_VALUE) {
            value.writeUInt32LE(g_binaryInput1Value, 0);
            return true;
        }
        if (propertyIdentifier === PROPERTY_IDENTIFIER_POLARITY) {
            value.writeUInt32LE(POLARITY_NORMAL, 0);
            return true;
        }
    }
    // Binary Output 1 ("Fuchsia") - commandable (binary values travel as the
    // BACnetBinaryPV enumeration: 0 = inactive, 1 = active).
    if (objectType === OBJECT_TYPE_BINARY_OUTPUT && objectInstance === BINARY_OUTPUT_INSTANCE) {
        if (propertyIdentifier === PROPERTY_IDENTIFIER_PRESENT_VALUE) {
            value.writeUInt32LE(CommandRead(g_binaryOutput1), 0);
            return true;
        }
        if (
            propertyIdentifier === PROPERTY_IDENTIFIER_PRIORITY_ARRAY &&
            useArrayIndex &&
            propertyArrayIndex >= 1 &&
            propertyArrayIndex <= 16
        ) {
            value.writeUInt32LE(g_binaryOutput1.value[propertyArrayIndex - 1], 0);
            return true;
        }
        if (propertyIdentifier === PROPERTY_IDENTIFIER_RELINQUISH_DEFAULT) {
            value.writeUInt32LE(g_binaryOutput1.relinquishDefault, 0);
            return true;
        }
        if (propertyIdentifier === PROPERTY_IDENTIFIER_POLARITY) {
            value.writeUInt32LE(POLARITY_NORMAL, 0);
            return true;
        }
    }
    // Units are an enumeration, so they are served HERE, not in GetPropertyReal.
    if (propertyIdentifier === PROPERTY_IDENTIFIER_UNITS) {
        if (objectType === OBJECT_TYPE_ANALOG_INPUT && objectInstance === ANALOG_INPUT_INSTANCE) {
            value.writeUInt32LE(ENGINEERING_UNITS_DEGREES_CELSIUS, 0);
            return true;
        }
        if (objectType === OBJECT_TYPE_ANALOG_OUTPUT && objectInstance === ANALOG_OUTPUT_INSTANCE) {
            value.writeUInt32LE(ENGINEERING_UNITS_PERCENT, 0);
            return true;
        }
    }
    // Network Port 1 ("Vermilion").
    if (
        objectType === OBJECT_TYPE_NETWORK_PORT &&
        objectInstance === NETWORK_PORT_INSTANCE &&
        propertyIdentifier === PROPERTY_IDENTIFIER_BACNET_IP_MODE
    ) {
        value.writeUInt32LE(BACNET_IP_MODE_NORMAL, 0);
        return true;
    }
    return false;
}

function GetPropertyUnsignedInteger(
    _deviceInstance: number,
    objectType: number,
    objectInstance: number,
    propertyIdentifier: number,
    value: Buffer,
    useArrayIndex: boolean,
    propertyArrayIndex: number
): boolean {
    // Multi-State Input 1 ("Hot Pink").
    if (objectType === OBJECT_TYPE_MULTI_STATE_INPUT && objectInstance === MULTI_STATE_INPUT_INSTANCE) {
        if (propertyIdentifier === PROPERTY_IDENTIFIER_PRESENT_VALUE) {
            value.writeUInt32LE(g_multiStateInput1Value, 0);
            return true;
        }
        if (propertyIdentifier === PROPERTY_IDENTIFIER_NUMBER_OF_STATES) {
            value.writeUInt32LE(MULTI_STATE_TEXT.length, 0);
            return true;
        }
        // State_Text[0] is the ARRAY SIZE query (BACnet array index 0).
        if (
            propertyIdentifier === PROPERTY_IDENTIFIER_STATE_TEXT &&
            useArrayIndex &&
            propertyArrayIndex === 0
        ) {
            value.writeUInt32LE(MULTI_STATE_TEXT.length, 0);
            return true;
        }
    }
    // Multi-State Output 1 ("Indigo") - commandable.
    if (objectType === OBJECT_TYPE_MULTI_STATE_OUTPUT && objectInstance === MULTI_STATE_OUTPUT_INSTANCE) {
        if (propertyIdentifier === PROPERTY_IDENTIFIER_PRESENT_VALUE) {
            value.writeUInt32LE(CommandRead(g_multiStateOutput1), 0);
            return true;
        }
        if (
            propertyIdentifier === PROPERTY_IDENTIFIER_PRIORITY_ARRAY &&
            useArrayIndex &&
            propertyArrayIndex >= 1 &&
            propertyArrayIndex <= 16
        ) {
            value.writeUInt32LE(g_multiStateOutput1.value[propertyArrayIndex - 1], 0);
            return true;
        }
        if (propertyIdentifier === PROPERTY_IDENTIFIER_RELINQUISH_DEFAULT) {
            value.writeUInt32LE(g_multiStateOutput1.relinquishDefault, 0);
            return true;
        }
        if (propertyIdentifier === PROPERTY_IDENTIFIER_NUMBER_OF_STATES) {
            value.writeUInt32LE(MULTI_STATE_TEXT.length, 0);
            return true;
        }
    }
    // Device object.
    if (
        objectType === OBJECT_TYPE_DEVICE &&
        objectInstance === g_deviceInstance &&
        propertyIdentifier === PROPERTY_IDENTIFIER_VENDOR_IDENTIFIER
    ) {
        value.writeUInt32LE(VENDOR_IDENTIFIER, 0);
        return true;
    }
    // Network Port 1 ("Vermilion"). APDU_Length is one of the few properties
    // where returning false IS an error on the wire - serve it.
    if (objectType === OBJECT_TYPE_NETWORK_PORT && objectInstance === NETWORK_PORT_INSTANCE) {
        if (propertyIdentifier === PROPERTY_IDENTIFIER_APDU_LENGTH) {
            value.writeUInt32LE(MAX_APDU_LENGTH, 0);
            return true;
        }
        if (propertyIdentifier === PROPERTY_IDENTIFIER_REFERENCE_PORT) {
            value.writeUInt32LE(NETWORK_PORT_REFERENCE_PORT_NONE, 0);
            return true;
        }
        if (propertyIdentifier === PROPERTY_IDENTIFIER_BACNET_IP_UDP_PORT) {
            value.writeUInt32LE(g_udpPort, 0);
            return true;
        }
    }
    return false;
}

function GetPropertyBool(
    _deviceInstance: number,
    objectType: number,
    _objectInstance: number,
    propertyIdentifier: number,
    value: Buffer,
    useArrayIndex: boolean,
    propertyArrayIndex: number
): boolean {
    // Priority_Array slot-is-NULL query: before asking for a slot's VALUE (in
    // the datatype callback), the stack asks HERE whether the slot is NULL.
    // NOTE the series-wide asymmetry, kept deliberately identical across all
    // examples until changed in one sweep: this callback matches on TYPE only,
    // while the value callbacks match type AND instance. Fine while each
    // output type has one instance; carry the instance check if you add more.
    if (
        propertyIdentifier === PROPERTY_IDENTIFIER_PRIORITY_ARRAY &&
        useArrayIndex &&
        propertyArrayIndex >= 1 &&
        propertyArrayIndex <= 16
    ) {
        if (objectType === OBJECT_TYPE_ANALOG_OUTPUT) {
            value.writeUInt8(g_analogOutput1.isSet[propertyArrayIndex - 1] ? 0 : 1, 0);
            return true;
        }
        if (objectType === OBJECT_TYPE_BINARY_OUTPUT) {
            value.writeUInt8(g_binaryOutput1.isSet[propertyArrayIndex - 1] ? 0 : 1, 0);
            return true;
        }
        if (objectType === OBJECT_TYPE_MULTI_STATE_OUTPUT) {
            value.writeUInt8(g_multiStateOutput1.isSet[propertyArrayIndex - 1] ? 0 : 1, 0);
            return true;
        }
    }
    // Out_Of_Service: every object in this example is permanently in service.
    if (propertyIdentifier === PROPERTY_IDENTIFIER_OUT_OF_SERVICE) {
        value.writeUInt8(0, 0);
        return true;
    }
    return false;
}

function GetPropertyOctetString(
    _deviceInstance: number,
    objectType: number,
    objectInstance: number,
    propertyIdentifier: number,
    value: Buffer,
    valueElementCount: Buffer,
    maxElementCount: number,
    _useArrayIndex: boolean,
    _propertyArrayIndex: number
): boolean {
    // Network Port 1 ("Vermilion") - the IPv4 configuration, 4 octets each.
    if (objectType === OBJECT_TYPE_NETWORK_PORT && objectInstance === NETWORK_PORT_INSTANCE && maxElementCount >= 4) {
        let octets: number[] | null = null;
        if (propertyIdentifier === PROPERTY_IDENTIFIER_IP_ADDRESS) {
            octets = g_ipAddress;
        } else if (propertyIdentifier === PROPERTY_IDENTIFIER_IP_SUBNET_MASK) {
            octets = g_ipSubnetMask;
        } else if (propertyIdentifier === PROPERTY_IDENTIFIER_IP_DEFAULT_GATEWAY) {
            octets = g_ipDefaultGateway;
        }
        if (octets !== null) {
            value[0] = octets[0];
            value[1] = octets[1];
            value[2] = octets[2];
            value[3] = octets[3];
            valueElementCount.writeUInt32LE(4, 0);
            return true;
        }
    }
    return false;
}

function GetPropertyCharacterString(
    _deviceInstance: number,
    objectType: number,
    objectInstance: number,
    propertyIdentifier: number,
    value: Buffer,
    valueElementCount: Buffer,
    maxElementCount: number,
    encodingType: Buffer,
    useArrayIndex: boolean,
    propertyArrayIndex: number
): boolean {
    const text = (t: string) => ReturnCharacterString(t, value, valueElementCount, maxElementCount, encodingType);

    // Multi-State Input State_Text[1..3] (1-based array on the wire; [0] is
    // the size query, served in GetPropertyUnsignedInteger).
    if (
        objectType === OBJECT_TYPE_MULTI_STATE_INPUT &&
        objectInstance === MULTI_STATE_INPUT_INSTANCE &&
        propertyIdentifier === PROPERTY_IDENTIFIER_STATE_TEXT &&
        useArrayIndex &&
        propertyArrayIndex >= 1 &&
        propertyArrayIndex <= MULTI_STATE_TEXT.length
    ) {
        return text(MULTI_STATE_TEXT[propertyArrayIndex - 1]);
    }

    // Object_Name for every object - REQUIRED, must be unique in the device,
    // and one of the silent-default traps: forget one and the stack answers
    // the literal "undefined" instead of erroring.
    if (propertyIdentifier === PROPERTY_IDENTIFIER_OBJECT_NAME) {
        if (objectType === OBJECT_TYPE_DEVICE && objectInstance === g_deviceInstance) {
            return text(DEVICE_NAME);
        }
        if (objectType === OBJECT_TYPE_ANALOG_INPUT && objectInstance === ANALOG_INPUT_INSTANCE) {
            return text("Bronze");
        }
        if (objectType === OBJECT_TYPE_BINARY_INPUT && objectInstance === BINARY_INPUT_INSTANCE) {
            return text("Emerald");
        }
        if (objectType === OBJECT_TYPE_MULTI_STATE_INPUT && objectInstance === MULTI_STATE_INPUT_INSTANCE) {
            return text("Hot Pink");
        }
        if (objectType === OBJECT_TYPE_ANALOG_OUTPUT && objectInstance === ANALOG_OUTPUT_INSTANCE) {
            return text("Chartreuse");
        }
        if (objectType === OBJECT_TYPE_BINARY_OUTPUT && objectInstance === BINARY_OUTPUT_INSTANCE) {
            return text("Fuchsia");
        }
        if (objectType === OBJECT_TYPE_MULTI_STATE_OUTPUT && objectInstance === MULTI_STATE_OUTPUT_INSTANCE) {
            return text("Indigo");
        }
        if (objectType === OBJECT_TYPE_NETWORK_PORT && objectInstance === NETWORK_PORT_INSTANCE) {
            return text("Vermilion");
        }
    }

    // Device object strings.
    if (objectType === OBJECT_TYPE_DEVICE && objectInstance === g_deviceInstance) {
        if (propertyIdentifier === PROPERTY_IDENTIFIER_DESCRIPTION) {
            return text(DEVICE_DESCRIPTION);
        }
        if (propertyIdentifier === PROPERTY_IDENTIFIER_VENDOR_NAME) {
            return text(VENDOR_NAME);
        }
        if (propertyIdentifier === PROPERTY_IDENTIFIER_MODEL_NAME) {
            return text(MODEL_NAME);
        }
        if (propertyIdentifier === PROPERTY_IDENTIFIER_FIRMWARE_REVISION) {
            return text(APP_VERSION);
        }
        if (propertyIdentifier === PROPERTY_IDENTIFIER_APPLICATION_SOFTWARE_VERSION) {
            return text(APP_VERSION);
        }
    }
    return false;
}

// =============================================================================
// 2b. Set callbacks (DS-WP-B lands here)
// =============================================================================
// A WriteProperty to a commandable Present_Value arrives with a priority
// (1..16; 0 when the request carried none = act at 16). Writing NULL arrives
// separately in SetPropertyNull and means RELINQUISH that priority slot.
//
// To REJECT a write: write a BACnet error code into the errorCode out-Buffer
// (errorCode.writeUInt32LE(code, 0)) and return false. Validate before
// accepting - a tutorial that accepts anything teaches devices that accept
// anything.

function SetPropertyReal(
    _deviceInstance: number,
    objectType: number,
    objectInstance: number,
    propertyIdentifier: number,
    value: number,
    _useArrayIndex: boolean,
    _propertyArrayIndex: number,
    priority: number,
    _errorCode: Buffer
): boolean {
    if (propertyIdentifier === PROPERTY_IDENTIFIER_PRESENT_VALUE) {
        const c = GetCommandable(objectType, objectInstance);
        if (c === g_analogOutput1 && c !== null) {
            CommandWrite(c, priority, value); // any REAL is a valid percent command here
            console.log(`FYI: Analog Output 1 ("Chartreuse") commanded to ${value} at priority ${EffectivePriority(priority)}`);
            return true;
        }
    }
    return false;
}

function SetPropertyEnumerated(
    _deviceInstance: number,
    objectType: number,
    objectInstance: number,
    propertyIdentifier: number,
    value: number,
    _useArrayIndex: boolean,
    _propertyArrayIndex: number,
    priority: number,
    errorCode: Buffer
): boolean {
    if (propertyIdentifier === PROPERTY_IDENTIFIER_PRESENT_VALUE) {
        const c = GetCommandable(objectType, objectInstance);
        if (c === g_binaryOutput1 && c !== null) {
            if (value > 1) {
                // BACnetBinaryPV is inactive(0) / active(1) - nothing else.
                errorCode.writeUInt32LE(ERROR_CODE_VALUE_OUT_OF_RANGE, 0);
                return false;
            }
            CommandWrite(c, priority, value);
            console.log(`FYI: Binary Output 1 ("Fuchsia") commanded to ${value === 1 ? "active" : "inactive"} at priority ${EffectivePriority(priority)}`);
            return true;
        }
    }
    return false;
}

function SetPropertyUnsignedInteger(
    _deviceInstance: number,
    objectType: number,
    objectInstance: number,
    propertyIdentifier: number,
    value: number,
    _useArrayIndex: boolean,
    _propertyArrayIndex: number,
    priority: number,
    errorCode: Buffer
): boolean {
    if (propertyIdentifier === PROPERTY_IDENTIFIER_PRESENT_VALUE) {
        const c = GetCommandable(objectType, objectInstance);
        if (c === g_multiStateOutput1 && c !== null) {
            if (value < 1 || value > MULTI_STATE_TEXT.length) {
                errorCode.writeUInt32LE(ERROR_CODE_VALUE_OUT_OF_RANGE, 0);
                return false;
            }
            CommandWrite(c, priority, value);
            console.log(`FYI: Multi-State Output 1 ("Indigo") commanded to state ${value} ("${MULTI_STATE_TEXT[value - 1]}") at priority ${EffectivePriority(priority)}`);
            return true;
        }
    }
    return false;
}

function SetPropertyNull(
    _deviceInstance: number,
    objectType: number,
    objectInstance: number,
    propertyIdentifier: number,
    _useArrayIndex: boolean,
    _propertyArrayIndex: number,
    priority: number,
    _errorCode: Buffer
): boolean {
    // Writing NULL to a commandable Present_Value = relinquish that priority.
    if (propertyIdentifier === PROPERTY_IDENTIFIER_PRESENT_VALUE) {
        const c = GetCommandable(objectType, objectInstance);
        if (c !== null) {
            CommandRelinquish(c, priority);
            console.log(`FYI: priority ${EffectivePriority(priority)} relinquished on object type ${objectType} instance ${objectInstance}`);
            return true;
        }
    }
    return false;
}

// =============================================================================
// 2c. DeviceCommunicationControl (DM-DCC-B) - the B-ASC addition
// =============================================================================
// The one capability that turns a B-SA into a B-ASC: a client can tell this
// device to stop initiating (disable-initiation) or resume (enable),
// optionally for a limited time, optionally guarded by a password. The STACK
// enforces the resulting communication state; this callback only decides
// whether to accept the request.
//
// SILENT TRAP - there is no default errorCode: the stack pre-seeds it with
// success(84), so returning false WITHOUT writing errorCode puts the absurd
// "Error Class SERVICES, Error Code success" on the wire. Always write the
// code before returning false.
//
// Note: at Protocol_Revision >= 20 the plain disable(1) is deprecated - the
// STACK answers it service-request-denied AFTER this callback returns true.

function DeviceCommunicationControl(
    deviceInstance: number,
    enableDisable: number,
    password: Buffer, // the Buffer's own length IS the password length
    useTimeDuration: boolean,
    timeDuration: number,
    errorCode: Buffer
): boolean {
    if (deviceInstance !== g_deviceInstance) {
        // Not this device - a router/gateway product would route it onward.
        errorCode.writeUInt32LE(ERROR_CODE_OPTIONAL_FUNCTIONALITY_NOT_SUPPORTED, 0);
        return false;
    }
    // Compare length first, then bytes. Deliberately NOT a string compare: a
    // wire CharacterString may contain embedded NUL bytes, and converting to a
    // JS string then using === would treat "ab\0cd" and "ab" differently than
    // the wire did. Buffer.equals compares the exact bytes.
    const expected = Buffer.from(DCC_PASSWORD, "utf8");
    if (password.length !== expected.length || !password.equals(expected)) {
        errorCode.writeUInt32LE(ERROR_CODE_PASSWORD_FAILURE, 0);
        return false;
    }
    console.log(
        `FYI: DeviceCommunicationControl accepted: enableDisable=${enableDisable}` +
            (useTimeDuration ? ` for ${timeDuration} minute(s)` : "") +
            ". The stack now enforces the communication state."
    );
    return true;
}

// =============================================================================
// 3. main()
// =============================================================================

async function main(): Promise<void> {
    const argv = process.argv.slice(2);

    // Load the CAS BACnet Stack FIRST - deliberately before even --version,
    // because PrintVersion() calls BACnetStack_GetAPIMajorVersion(). Same
    // contract as every edition of this example: LoadBACnetFunctions() once,
    // before any stack call, and check the result.
    if (!LoadBACnetFunctions()) {
        console.error(`Error: failed to load the CAS BACnet Stack: ${CASBACnetStackAdapter_LastError()}`);
        process.exit(1);
    }

    if (HandleHelpAndVersionArgs(argv, APP_NAME, APP_VERSION)) {
        return;
    }
    g_udpPort = ParsePortArg(argv, 47808);
    g_deviceInstance = ParseDeviceIdArg(argv, g_deviceInstance);
    PrintVersion(APP_NAME, APP_VERSION);

    // The application owns the socket; the stack only sees the callbacks.
    const udp = new SimpleUDP();
    try {
        await udp.Setup(g_udpPort);
    } catch (err) {
        console.error(`Error: could not bind UDP port ${g_udpPort}: ${err instanceof Error ? err.message : err}`);
        console.error("Is another BACnet device already running on this machine? Try --port.");
        process.exit(1);
    }
    const local = GetLocalIPv4();
    g_ipAddress = local.address.split(".").map(Number);
    g_ipSubnetMask = local.netmask.split(".").map(Number);
    console.log(`FYI: listening on ${local.address}:${g_udpPort} (broadcast ${local.broadcast})`);

    // Callbacks BEFORE the device exists: transport/time first, then one
    // registration per datatype this example serves, then DCC.
    RegisterCommonCallbacks(udp);
    BACnetStack_RegisterCallbackGetPropertyReal(GetPropertyReal);
    BACnetStack_RegisterCallbackGetPropertyEnumerated(GetPropertyEnumerated);
    BACnetStack_RegisterCallbackGetPropertyUnsignedInteger(GetPropertyUnsignedInteger);
    BACnetStack_RegisterCallbackGetPropertyBool(GetPropertyBool);
    BACnetStack_RegisterCallbackGetPropertyOctetString(GetPropertyOctetString);
    BACnetStack_RegisterCallbackGetPropertyCharacterString(GetPropertyCharacterString);
    BACnetStack_RegisterCallbackSetPropertyReal(SetPropertyReal);
    BACnetStack_RegisterCallbackSetPropertyEnumerated(SetPropertyEnumerated);
    BACnetStack_RegisterCallbackSetPropertyUnsignedInteger(SetPropertyUnsignedInteger);
    BACnetStack_RegisterCallbackSetPropertyNull(SetPropertyNull);
    BACnetStack_RegisterCallbackDeviceCommunicationControl(DeviceCommunicationControl);

    // The device. AddDevice creates the Device object itself - do not AddObject it.
    if (!BACnetStack_AddDevice(g_deviceInstance)) {
        console.error("Error: BACnetStack_AddDevice failed.");
        process.exit(1);
    }

    // Exactly the services the B-ASC profile requires - nothing more. The
    // stack emits Protocol_Services_Supported verbatim from these flags, and
    // its defaults leave even I-Am/I-Have false: enable everything you claim.
    const services: Array<[number, string]> = [
        [SERVICE_READ_PROPERTY, "ReadProperty (DS-RP-B)"],
        [SERVICE_WRITE_PROPERTY, "WriteProperty (DS-WP-B)"],
        [SERVICE_DEVICE_COMMUNICATION_CONTROL, "DeviceCommunicationControl (DM-DCC-B)"],
        [SERVICE_WHO_IS, "Who-Is (DM-DDB-B)"],
        [SERVICE_I_AM, "I-Am (DM-DDB-B)"],
        [SERVICE_WHO_HAS, "Who-Has (DM-DOB-B)"],
        [SERVICE_I_HAVE, "I-Have (DM-DOB-B)"],
    ];
    for (const [service, label] of services) {
        if (!BACnetStack_SetServiceEnabled(g_deviceInstance, service, true)) {
            console.error(`Error: SetServiceEnabled failed for ${label}.`);
            process.exit(1);
        }
    }

    // The objects - the series' four base objects plus this profile's three
    // commandable outputs, plus the required Network Port.
    const objects: Array<[number, number, string]> = [
        [OBJECT_TYPE_ANALOG_INPUT, ANALOG_INPUT_INSTANCE, 'Analog Input 1 ("Bronze")'],
        [OBJECT_TYPE_BINARY_INPUT, BINARY_INPUT_INSTANCE, 'Binary Input 1 ("Emerald")'],
        [OBJECT_TYPE_MULTI_STATE_INPUT, MULTI_STATE_INPUT_INSTANCE, 'Multi-State Input 1 ("Hot Pink")'],
        [OBJECT_TYPE_ANALOG_OUTPUT, ANALOG_OUTPUT_INSTANCE, 'Analog Output 1 ("Chartreuse")'],
        [OBJECT_TYPE_BINARY_OUTPUT, BINARY_OUTPUT_INSTANCE, 'Binary Output 1 ("Fuchsia")'],
        [OBJECT_TYPE_MULTI_STATE_OUTPUT, MULTI_STATE_OUTPUT_INSTANCE, 'Multi-State Output 1 ("Indigo")'],
    ];
    for (const [objectType, objectInstance, label] of objects) {
        if (!BACnetStack_AddObject(g_deviceInstance, objectType, objectInstance)) {
            console.error(`Error: AddObject failed for ${label}.`);
            process.exit(1);
        }
    }
    if (
        !BACnetStack_AddNetworkPortObjectWithNetworkNumber(
            g_deviceInstance,
            NETWORK_PORT_INSTANCE,
            NETWORK_PORT_NETWORK_TYPE_IPV4, // GOTCHA: this enum (ipv4 = 5) is NOT the
            NETWORK_PORT_PROTOCOL_LEVEL_BACNET_APPLICATION, // message-callback enum (IP = 0)
            0, // networkNumber: not configured
            NETWORK_NUMBER_QUALITY_UNKNOWN,
            NETWORK_PORT_REFERENCE_PORT_NONE
        )
    ) {
        console.error('Error: Failed to add Network Port 1 (Vermilion).');
        process.exit(1);
    }

    // Enable the OPTIONAL properties this example serves. SILENT TRAP: the
    // stack enables an object's REQUIRED properties automatically, but an
    // OPTIONAL property that is served without being ENABLED answers
    // unknown-property before your callback is ever called - the callback is
    // dead code that looks alive. Description and State_Text are optional.
    if (!BACnetStack_SetPropertyEnabled(g_deviceInstance, OBJECT_TYPE_DEVICE, g_deviceInstance, PROPERTY_IDENTIFIER_DESCRIPTION, true)) {
        console.error("Error: SetPropertyEnabled failed for Device Description.");
        process.exit(1);
    }
    if (!BACnetStack_SetPropertyEnabled(g_deviceInstance, OBJECT_TYPE_MULTI_STATE_INPUT, MULTI_STATE_INPUT_INSTANCE, PROPERTY_IDENTIFIER_STATE_TEXT, true)) {
        console.error("Error: SetPropertyEnabled failed for Multi-State Input State_Text.");
        process.exit(1);
    }

    // Commandable-output plumbing, carried as {type, instance} PAIRS. For the
    // OUTPUT types these three calls are effectively no-ops (the stack already
    // treats them as commandable, with Present_Value required + writable) -
    // but the calls are load-bearing the moment this block is copied to a
    // VALUE type (Analog/Binary/Multi-State Value), where Priority_Array and
    // Relinquish_Default default to disabled. Keep the shape.
    const commandables: Array<[number, number]> = [
        [OBJECT_TYPE_ANALOG_OUTPUT, ANALOG_OUTPUT_INSTANCE],
        [OBJECT_TYPE_BINARY_OUTPUT, BINARY_OUTPUT_INSTANCE],
        [OBJECT_TYPE_MULTI_STATE_OUTPUT, MULTI_STATE_OUTPUT_INSTANCE],
    ];
    for (const [objectType, objectInstance] of commandables) {
        if (
            !BACnetStack_SetPropertyEnabled(g_deviceInstance, objectType, objectInstance, PROPERTY_IDENTIFIER_PRIORITY_ARRAY, true) ||
            !BACnetStack_SetPropertyEnabled(g_deviceInstance, objectType, objectInstance, PROPERTY_IDENTIFIER_RELINQUISH_DEFAULT, true) ||
            !BACnetStack_SetPropertyWritable(g_deviceInstance, objectType, objectInstance, PROPERTY_IDENTIFIER_PRESENT_VALUE, true)
        ) {
            console.error(`Error: commandable plumbing failed for object type ${objectType} instance ${objectInstance}.`);
            process.exit(1);
        }
    }

    // Announce ourselves - an unsolicited I-Am on start-up (DM-DDB-B).
    if (!SendIAm(g_deviceInstance, g_udpPort)) {
        console.error("Error: SendIAm failed.");
        process.exit(1);
    }

    console.log(`FYI: Device ${g_deviceInstance} ("${DEVICE_NAME}") ready. Vendor ID ${VENDOR_IDENTIFIER}. Press 'h' for help.`);

    // --- The main loop -------------------------------------------------------
    // BACnetStack_Tick() does everything: reads queued datagrams (through the
    // receive callback), processes requests, transmits responses. It returns
    // true while it did work, so drain it, then let the event loop breathe.
    // 10 ms is far inside BACnet timing. (The C++ edition polls Tick() every
    // millisecond in a while-loop; a timer is the Node-idiomatic equivalent -
    // a deliberate, documented divergence.)
    const tick = setInterval(() => {
        while (BACnetStack_Tick()) {
            // drain
        }
    }, 10);

    const shutdown = () => {
        clearInterval(tick);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        process.stdin.pause();
        udp.Shutdown();
        console.log("FYI: stopped.");
    };

    // Interactive keys (series-standard): h = help, q = quit, up/down = nudge
    // Analog Input 1 so a client can watch the value change.
    if (process.stdin.isTTY) {
        readline.emitKeypressEvents(process.stdin);
        process.stdin.setRawMode(true);
        process.stdin.on("keypress", (_chunk, key) => {
            if (key === undefined) {
                return;
            }
            if (key.name === "q" || (key.ctrl === true && key.name === "c")) {
                shutdown();
            } else if (key.name === "h") {
                PrintVersion(APP_NAME, APP_VERSION);
                console.log("Keys: h = this help, q = quit, up/down = Analog Input 1 +/- 1.1");
            } else if (key.name === "up") {
                g_analogInput1Value += 1.1;
                console.log(`FYI: Analog Input 1 ("Bronze") is now ${g_analogInput1Value.toFixed(1)}`);
            } else if (key.name === "down") {
                g_analogInput1Value -= 1.1;
                console.log(`FYI: Analog Input 1 ("Bronze") is now ${g_analogInput1Value.toFixed(1)}`);
            }
        });
    } else {
        // Not a terminal (CI smoke test): run until killed.
        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);
    }
}

main().catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.stack : err}`);
    process.exit(1);
});
