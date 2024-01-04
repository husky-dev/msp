import { SerialPort } from 'serialport';
import { parseIncomingBuff } from './msg';
import { encodeMessageV1, encodeMessageV2, push8 } from './utils';
import { EventEmitter } from 'events';
import { MSPCodes } from './codes';

interface MultiwiiSerialProtocolOpts {
  path: string;
  baudRate?: number;
}

export class MultiwiiSerialProtocol extends EventEmitter {
  private port: SerialPort;
  private conencted: boolean = false;

  constructor(opt: MultiwiiSerialProtocolOpts) {
    const { path, baudRate = 115200 } = opt;
    super();
    this.port = new SerialPort({ path, baudRate, autoOpen: false });
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
      this.emit('error', new Error(`Invalid message, code: ${code}`));
    }
  }

  /**
   * Connection
   */

  public async connect() {
    return this.port.open();
  }

  public async disconnect() {
    return this.port.close();
  }

  /**
   * Commands
   */

  public async sendMessage(code: MSPCodes, payload: Buffer = Buffer.from([])): Promise<boolean> {
    if (!this.conencted) {
      throw new Error('Not connected');
    }
    const bufferOut = code <= 254 ? encodeMessageV1(code, payload) : encodeMessageV2(code, payload);
    return this.port.write(bufferOut);
  }

  public async setName(name: string) {
    let buffer: number[] = [];
    const MSP_BUFFER_SIZE = 64;
    for (let i = 0; i < name.length && i < MSP_BUFFER_SIZE; i++) {
      buffer = push8(buffer, name.charCodeAt(i));
    }
    return this.sendMessage(MSPCodes.MSP_SET_NAME, Buffer.from(buffer));
  }
}

export * from './codes';
export * from './msg';
