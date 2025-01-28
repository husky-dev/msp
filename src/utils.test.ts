import { describe, expect, it } from '@jest/globals';
import {
  push8,
  push16,
  push32,
  encodeMessageV1,
  decodeMessageV1,
  encodeMessageV2,
  decodeMessageV2,
  encodeMessage,
  decodeMessage,
} from './utils';
import { MSPCodes } from './codes';

/**
 * Encoding and decoding for V1 and V2 messages
 */

describe('encodeMessage', () => {
  it('should encode a V1 message correctly when code is less than or equal to 254', () => {
    const code = 0x01;
    const payload = Buffer.from([0x01, 0x02, 0x03]);
    const expected = encodeMessageV1(code, payload);
    expect(encodeMessage(code, payload)).toEqual(expected);
  });

  it('should encode a V2 message correctly when code is greater than 254', () => {
    const code: MSPCodes = 0x0100 as MSPCodes;
    const payload = Buffer.from([0x01, 0x02, 0x03]);
    const expected = encodeMessageV2(code, payload);
    expect(encodeMessage(code, payload)).toEqual(expected);
  });

  it('should encode a V1 message with no payload correctly', () => {
    const code = 0x01;
    const payload = Buffer.from([]);
    const expected = encodeMessageV1(code, payload);
    expect(encodeMessage(code, payload)).toEqual(expected);
  });

  it('should encode a V2 message with no payload correctly', () => {
    const code = 0x0100 as MSPCodes;
    const payload = Buffer.from([]);
    const expected = encodeMessageV2(code, payload);
    expect(encodeMessage(code, payload)).toEqual(expected);
  });
});

describe('decodeMessage', () => {
  it('should decode a V1 message correctly', () => {
    const buff = Buffer.from([36, 77, 60, 3, 0x01, 1, 2, 3, 1]);
    const expected = decodeMessageV1(buff);
    expect(decodeMessage(buff)).toEqual(expected);
  });

  it('should decode a V2 message correctly', () => {
    const buff = Buffer.from([36, 88, 60, 0, 0x00, 0x01, 0, 0, 0x83]);
    const expected = decodeMessageV2(buff);
    expect(decodeMessage(buff)).toEqual(expected);
  });

  it('should handle unsupported V1 message correctly', () => {
    const buff = Buffer.from([36, 77, 33, 0, 0x01, 1]);
    const expected = decodeMessageV1(buff);
    expect(decodeMessage(buff)).toEqual(expected);
  });

  it('should handle unsupported V2 message correctly', () => {
    const buff = Buffer.from([36, 88, 33, 0, 0x00, 0x01, 0, 0, 0x83]);
    const expected = decodeMessageV2(buff);
    expect(decodeMessage(buff)).toEqual(expected);
  });
});

/**
 * Message V1 encoding and decoding tests
 */

describe('encodeMessageV1', () => {
  it('should encode a message with no payload correctly', () => {
    const code = 0x01;
    const payload = Buffer.from([]);
    const expected = Buffer.from([36, 77, 60, 0, code, 1]);
    expect(encodeMessageV1(code, payload)).toEqual(expected);
  });

  it('should encode a message with payload correctly', () => {
    const code = 0x02;
    const payload = Buffer.from([0x01, 0x02, 0x03]);
    const expected = Buffer.from([36, 77, 60, 3, code, 1, 2, 3, 1]);
    expect(encodeMessageV1(code, payload)).toEqual(expected);
  });

  it('should handle maximum code value correctly', () => {
    const code = 0xfe;
    const payload = Buffer.from([0x01, 0x02]);
    const expected = Buffer.from([36, 77, 60, 2, code, 1, 2, 255]);
    expect(encodeMessageV1(code, payload)).toEqual(expected);
  });

  it('should handle maximum payload length correctly', () => {
    const code = 0x03;
    const payload = Buffer.from(new Array(255).fill(0x01));
    const expected = Buffer.concat([
      Buffer.from([36, 77, 60, 255, code]),
      Buffer.from(new Array(255).fill(0x01)),
      Buffer.from([253]),
    ]);
    expect(encodeMessageV1(code, payload)).toEqual(expected);
  });
});

describe('decodeMessageV1', () => {
  it('should decode a message with no payload correctly', () => {
    const buff = Buffer.from([36, 77, 60, 0, 0x01, 1]);
    const expected = {
      success: true,
      code: 0x01,
      len: 0,
      payload: Buffer.from([]),
      checksum: 1,
    };
    expect(decodeMessageV1(buff)).toEqual(expected);
  });

  it('should decode a message with payload correctly', () => {
    const buff = Buffer.from([36, 77, 60, 3, 0x02, 1, 2, 3, 1]);
    const expected = {
      success: true,
      code: 0x02,
      len: 3,
      payload: Buffer.from([1, 2, 3]),
      checksum: 1,
    };
    expect(decodeMessageV1(buff)).toEqual(expected);
  });

  it('should handle unsupported message correctly', () => {
    const buff = Buffer.from([36, 77, 33, 0, 0x01, 1]);
    const expected = {
      success: false,
      code: 0x01,
      error: new Error('MSP code 1 is not supported by the flight controller'),
    };
    expect(decodeMessageV1(buff)).toEqual(expected);
  });

  it('should handle maximum payload length correctly', () => {
    const payload = Buffer.from(new Array(255).fill(0x01));
    const buff = Buffer.concat([Buffer.from([36, 77, 60, 255, 0x03]), payload, Buffer.from([253])]);
    const expected = {
      success: true,
      code: 0x03,
      len: 255,
      payload,
      checksum: 253,
    };
    expect(decodeMessageV1(buff)).toEqual(expected);
  });
});

/**
 * Message V2 encoding and decoding tests
 */

describe('encodeMessageV2', () => {
  it('should encode a message with no payload correctly', () => {
    const code = 0x0100;
    const payload = Buffer.from([]);
    const expected = Buffer.from([36, 88, 60, 0, 0x00, 0x01, 0, 0, 0x83]);
    expect(encodeMessageV2(code, payload)).toEqual(expected);
  });

  it('should encode a message with payload correctly', () => {
    const code = 0x0200;
    const payload = Buffer.from([0x01, 0x02, 0x03]);
    const expected = Buffer.from([36, 88, 60, 0, 0x00, 0x02, 3, 0, 1, 2, 3, 0xd5]);
    expect(encodeMessageV2(code, payload)).toEqual(expected);
  });

  it('should handle maximum code value correctly', () => {
    const code = 0xffff;
    const payload = Buffer.from([0x01, 0x02]);
    const expected = Buffer.from([36, 88, 60, 0, 0xff, 0xff, 2, 0, 1, 2, 0xe0]);
    expect(encodeMessageV2(code, payload)).toEqual(expected);
  });

  it('should handle maximum payload length correctly', () => {
    const code = 0x0300;
    const payload = Buffer.from(new Array(65535).fill(0x01));
    const expected = Buffer.concat([
      Buffer.from([36, 88, 60, 0, 0x00, 0x03, 0xff, 0xff]),
      Buffer.from(new Array(65535).fill(0x01)),
      Buffer.from([0xe9]),
    ]);
    expect(encodeMessageV2(code, payload)).toEqual(expected);
  });
});

describe('decodeMessageV2', () => {
  it('should decode a message with no payload correctly', () => {
    const buff = Buffer.from([36, 88, 60, 0, 0x00, 0x01, 0, 0, 0x83]);
    const expected = {
      success: true,
      code: 0x0100,
      len: 0,
      payload: Buffer.from([]),
      checksum: 0x83,
    };
    expect(decodeMessageV2(buff)).toEqual(expected);
  });

  it('should decode a message with payload correctly', () => {
    const buff = Buffer.from([36, 88, 60, 0, 0x00, 0x02, 3, 0, 1, 2, 3, 0xd5]);
    const expected = {
      success: true,
      code: 0x0200,
      len: 3,
      payload: Buffer.from([1, 2, 3]),
      checksum: 0xd5,
    };
    expect(decodeMessageV2(buff)).toEqual(expected);
  });

  it('should handle unsupported message correctly', () => {
    const buff = Buffer.from([36, 88, 33, 0, 0x00, 0x01, 0, 0, 0x83]);
    const expected = {
      success: false,
      code: 0x0100,
      error: new Error('MSP code 256 is not supported by the flight controller'),
    };
    expect(decodeMessageV2(buff)).toEqual(expected);
  });

  it('should handle maximum payload length correctly', () => {
    const payload = Buffer.from(new Array(65535).fill(0x01));
    const buff = Buffer.concat([Buffer.from([36, 88, 60, 0, 0x00, 0x03, 0xff, 0xff]), payload, Buffer.from([0xe9])]);
    const expected = {
      success: true,
      code: 0x0300,
      len: 65535,
      payload,
      checksum: 0xe9,
    };
    expect(decodeMessageV2(buff)).toEqual(expected);
  });
});

/**
 * Bitwise operations tests
 */

describe('push8', () => {
  it('should push an 8-bit value into an array correctly', () => {
    const arr: number[] = [];
    const val = 0x12;
    expect(push8(arr, val)).toEqual([0x12]);
  });

  it('should handle zero value correctly', () => {
    const arr: number[] = [];
    const val = 0x00; // Zero value
    expect(push8(arr, val)).toEqual([0x00]);
  });

  it('should handle maximum 8-bit value correctly', () => {
    const arr: number[] = [];
    const val = 0xff; // Maximum 8-bit value
    expect(push8(arr, val)).toEqual([0xff]);
  });

  it('should append to an existing array correctly', () => {
    const arr: number[] = [0x01, 0x02];
    const val = 0x12; // Example 8-bit value
    expect(push8(arr, val)).toEqual([0x01, 0x02, 0x12]);
  });
});

describe('push16', () => {
  it('should push a 16-bit value into an array correctly', () => {
    const arr: number[] = [];
    const val = 0x1234;
    expect(push16(arr, val)).toEqual([0x34, 0x12]);
  });

  it('should handle zero value correctly', () => {
    const arr: number[] = [];
    const val = 0x0000; // Zero value
    expect(push16(arr, val)).toEqual([0x00, 0x00]);
  });

  it('should handle maximum 16-bit value correctly', () => {
    const arr: number[] = [];
    const val = 0xffff; // Maximum 16-bit value
    expect(push16(arr, val)).toEqual([0xff, 0xff]);
  });

  it('should append to an existing array correctly', () => {
    const arr: number[] = [0x01, 0x02];
    const val = 0x1234; // Example 16-bit value
    expect(push16(arr, val)).toEqual([0x01, 0x02, 0x34, 0x12]);
  });
});

describe('push32', () => {
  it('should push a 32-bit value into an array correctly', () => {
    const arr: number[] = [];
    const val = 0x12345678;
    expect(push32(arr, val)).toEqual([0x78, 0x56, 0x34, 0x12]);
  });

  it('should handle zero value correctly', () => {
    const arr: number[] = [];
    const val = 0x00000000; // Zero value
    expect(push32(arr, val)).toEqual([0x00, 0x00, 0x00, 0x00]);
  });

  it('should handle maximum 32-bit value correctly', () => {
    const arr: number[] = [];
    const val = 0xffffffff; // Maximum 32-bit value
    expect(push32(arr, val)).toEqual([0xff, 0xff, 0xff, 0xff]);
  });

  it('should append to an existing array correctly', () => {
    const arr: number[] = [0x01, 0x02];
    const val = 0x12345678; // Example 32-bit value
    expect(push32(arr, val)).toEqual([0x01, 0x02, 0x78, 0x56, 0x34, 0x12]);
  });
});
