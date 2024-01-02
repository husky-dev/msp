import { SerialPort } from 'serialport';
import { parseIncomingBuff } from './msg';
import { encodeMessageV1, encodeMessageV2 } from './utils';
import { EventEmitter } from 'events';
import { MSPCodes } from './codes';

interface MSPPortOpts {
  path: string;
  baudRate: number;
}

// const port = new SerialPort({
//   path: '/dev/tty.usbmodem0x80000001',
//   baudRate: 115200,
//   dataBits: 8,
//   stopBits: 1,
//   parity: 'none',
//   autoOpen: false,
// });

export class MultiwiiSerialProtocol extends EventEmitter {
  private port: SerialPort;
  private conencted: boolean = false;

  constructor(opt: MSPPortOpts) {
    super();
    this.port = new SerialPort({ ...opt, autoOpen: false });
    this.port.on('open', this.onOpen.bind(this));
    this.port.on('close', this.onClose.bind(this));
    this.port.on('error', this.onError.bind(this));
    this.port.on('data', this.onData.bind(this));
  }

  /**
   * Event handlers
   */

  private onOpen() {
    this.conencted = true;
    this.emit('connect');
  }

  private onClose() {
    this.conencted = false;
    this.emit('disconnect');
  }

  private onError(err: Error) {
    this.emit('error', err);
  }

  private onData(buff: Buffer) {
    const msg = parseIncomingBuff(buff);
    if (msg) {
      this.emit('message', msg);
    } else {
      const len = buff[3];
      const code = buff[4];
      const data = buff.slice(5, 5 + len);
      console.log('Unknown message', { len, code, data });
    }
  }

  /**
   * Connection
   */

  public async connect() {
    return await this.port.open();
  }

  public async disconnect() {
    return await this.port.close();
  }

  /**
   * Commands
   */

  public async sendMessage(code: MSPCodes, payload: Buffer = Buffer.from([])): Promise<boolean> {
    const bufferOut = code <= 254 ? encodeMessageV1(code, payload) : encodeMessageV2(code, payload);
    return this.port.write(bufferOut);
  }
}

export * from './codes';
export * from './msg';
