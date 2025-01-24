export const API_VERSION_1_39 = '1.39.0';
export const API_VERSION_1_40 = '1.40.0';

export const API_VERSION_1_41 = '1.41.0';
export const API_VERSION_1_42 = '1.42.0';
export const API_VERSION_1_43 = '1.43.0';
export const API_VERSION_1_44 = '1.44.0';
export const API_VERSION_1_45 = '1.45.0';
export const API_VERSION_1_46 = '1.46.0';

const mspSymbols = {
  BEGIN: '$'.charCodeAt(0),
  PROTO_V1: 'M'.charCodeAt(0),
  PROTO_V2: 'X'.charCodeAt(0),
  FROM_MWC: '>'.charCodeAt(0),
  TO_MWC: '<'.charCodeAt(0),
  UNSUPPORTED: '!'.charCodeAt(0),
};

type MSPDecodeResult =
  | {
      success: true;
      code: number;
      len: number;
      payload: Buffer;
      checksum: number;
    }
  | {
      success: false;
      code: number;
      error: Error;
    };

export const encodeMessage = (code: number, payload: Buffer = Buffer.from([])) => {
  return code <= 254 ? encodeMessageV1(code, payload) : encodeMessageV2(code, payload);
};

export const decodeMessage = (buff: Buffer): MSPDecodeResult => {
  const msgVersion = buff[1];
  return msgVersion === mspSymbols.PROTO_V1 ? decodeMessageV1(buff) : decodeMessageV2(buff);
};

export const encodeMessageV1 = (code: number, data: Buffer) => {
  const dataLength = data.length;
  const bufSize = dataLength + 6;
  const bufOut = Buffer.alloc(bufSize);

  bufOut[0] = 36; // $
  bufOut[1] = 77; // M
  bufOut[2] = 60; // <
  bufOut[3] = dataLength;
  bufOut[4] = code;

  let checksum = bufOut[3] ^ bufOut[4];

  for (let i = 0; i < dataLength; i++) {
    bufOut[i + 5] = data[i];
    checksum ^= bufOut[i + 5];
  }

  bufOut[5 + dataLength] = checksum;
  return bufOut;
};

export const decodeMessageV1 = (buff: Buffer): MSPDecodeResult => {
  const symbol = buff[2];
  const code = buff[4];
  if (symbol === mspSymbols.UNSUPPORTED) {
    return {
      success: false,
      code,
      error: new Error(`MSP code ${code} is not supported by the flight controller`),
    };
  }
  const len = buff[3];
  const payload = buff.slice(5, 5 + len);
  const checksum = buff[5 + len];
  return { success: true, len, code, payload, checksum };
};

export const encodeMessageV2 = (code: number, data: Buffer) => {
  const dataLength = data ? data.length : 0;
  // 9 bytes for protocol overhead
  const bufferSize = dataLength + 9;
  const bufferOut = Buffer.alloc(bufferSize);
  bufferOut[0] = 36; // $
  bufferOut[1] = 88; // X
  bufferOut[2] = 60; // <
  bufferOut[3] = 0; // flag
  bufferOut[4] = code & 0xff;
  bufferOut[5] = (code >> 8) & 0xff;
  bufferOut[6] = dataLength & 0xff;
  bufferOut[7] = (dataLength >> 8) & 0xff;
  for (let ii = 0; ii < dataLength; ii++) {
    bufferOut[8 + ii] = data[ii];
  }
  bufferOut[bufferSize - 1] = crc8DvbS2Data(bufferOut, 3, bufferSize - 1);
  return bufferOut;
};

export const decodeMessageV2 = (buff: Buffer): MSPDecodeResult => {
  const symbol = buff[2];
  const code = buff.readUInt16LE(4);
  if (symbol === mspSymbols.UNSUPPORTED) {
    return {
      success: false,
      code,
      error: new Error(`MSP code ${code} is not supported by the flight controller`),
    };
  }
  const len = buff.readUInt16LE(6);
  const payload = len ? buff.slice(8, 8 + len) : Buffer.from([]);
  const checksum = buff[buff.length - 1];
  return { success: true, len, code, payload, checksum };
};

const crc8DvbS2Data = (data: Buffer, start: number, end: number) => {
  let crc = 0;
  for (let ii = start; ii < end; ii++) {
    crc = crc8DvbS2(crc, data[ii]);
  }
  return crc;
};

const crc8DvbS2 = (crc: number, ch: number): number => {
  crc ^= ch;
  for (let ii = 0; ii < 8; ii++) {
    if (crc & 0x80) {
      crc = ((crc << 1) & 0xff) ^ 0xd5;
    } else {
      crc = (crc << 1) & 0xff;
    }
  }
  return crc;
};

export const buffToDataView = (buff: Buffer) => {
  let offset = 0;

  const readU8 = () => {
    const val = buff.readUInt8(offset);
    offset += 1;
    return val;
  };

  const readU16 = () => {
    const val = buff.readUInt16LE(offset);
    offset += 2;
    return val;
  };

  const readU32 = () => {
    const val = buff.readUInt32LE(offset);
    offset += 4;
    return val;
  };

  const read8 = () => {
    const val = buff.readInt8(offset);
    offset += 1;
    return val;
  };

  const read16 = () => {
    const val = buff.readInt16LE(offset);
    offset += 2;
    return val;
  };

  const read32 = () => {
    const val = buff.readInt32LE(offset);
    offset += 4;
    return val;
  };

  const readText = () => {
    const size = readU8();
    let str = '';
    for (let i = 0; i < size; i++) {
      str += String.fromCharCode(readU8());
    }
    return str;
  };

  const remaining = () => buff.length - offset;

  const length = () => buff.length;

  return { readU8, readU16, readU32, read8, read16, read32, readText, remaining, length };
};

export const push8 = (arr: number[], val: number) => {
  arr.push(0xff & val);
  return arr;
};

export const push16 = (arr: number[], val: number) => {
  // low byte
  arr.push(0x00ff & val);
  // high byte
  arr.push(val >> 8);
  return arr;
};

export const push32 = (arr: number[], val: number) => {
  arr = push8(arr, val);
  arr = push8(arr, val >> 8);
  arr = push8(arr, val >> 16);
  arr = push8(arr, val >> 24);
  return arr;
};

export type BuffDataView = ReturnType<typeof buffToDataView>;
