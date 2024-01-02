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

const crc8DvbS2Data = (data: Uint8Array, start: number, end: number) => {
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
