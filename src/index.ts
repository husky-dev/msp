import { SerialPort } from 'serialport';
import { MSPCodes } from './codes';

const port = new SerialPort({
  path: '/dev/tty.usbmodem0x80000001',
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  autoOpen: false,
});

port.on('open', () => {
  console.log('Port opened');
});

port.on('close', () => {
  console.log('Port closed');
});

port.on('error', error => {
  console.error(error);
});

port.on('data', buff => {
  console.log('data', buff);
  const len = buff[3];
  const type = buff[4];
  const data = buff.slice(5, 5 + len);
  if (type === MSPCodes.MSP_STATUS) {
    const status = {
      cycleTime: data.readUInt16LE(0),
      i2cError: data.readUInt16LE(2),
      activeSensors: data.readUInt16LE(4),
      mode: data.readUInt32LE(6),
      profile: data.readUInt8(10),
    };
    return console.log({ buff, len, type, status, data });
  }
  if (type === MSPCodes.MSP_RC) {
    const activeChannels = data.length / 2;
    const channels = [];
    for (let i = 0; i < activeChannels; i++) {
      channels.push(data.readUInt16LE(i * 2));
    }
    return console.log(channels);
  }
  console.log({ buff, len, type, data });
});

const sendMessage = async (code: number, data: Buffer = Buffer.from([])) => {
  const bufferOut = code <= 254 ? encodeMessageV1(code, data) : encodeMessageV2(code, data);
  return port.write(bufferOut);
};

const encodeMessageV1 = (code: number, data: Buffer) => {
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

const encodeMessageV2 = (code: number, data: Buffer) => {
  const dataLength = data ? data.length : 0;
  // 9 bytes for protocol overhead
  const bufferSize = dataLength + 9;
  const bufferOut = Buffer.alloc(bufferSize);
  const bufView = new Uint8Array(bufferOut);
  bufView[0] = 36; // $
  bufView[1] = 88; // X
  bufView[2] = 60; // <
  bufView[3] = 0; // flag
  bufView[4] = code & 0xff;
  bufView[5] = (code >> 8) & 0xff;
  bufView[6] = dataLength & 0xff;
  bufView[7] = (dataLength >> 8) & 0xff;
  for (let ii = 0; ii < dataLength; ii++) {
    bufView[8 + ii] = data[ii];
  }
  bufView[bufferSize - 1] = crc8DvbS2Data(bufView, 3, bufferSize - 1);
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

const getMspStatus = async () => {
  // await sendMessage(MSPCodes.MSP_STATUS);
  await sendMessage(MSPCodes.MSP_RC);
};

const main = async () => {
  // const list = await SerialPort.list();
  // console.log(list);
  console.log('Opening port...');
  await port.open();
  console.log('Port opened');
  await getMspStatus();
};

main();
