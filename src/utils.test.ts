import { describe, expect, it } from '@jest/globals';
import { push16 } from './utils';

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
