import { SerialPort } from 'serialport';
import { composeSetMotor, composeSetName, parseMsg } from './msg';
import { encodeMessageV1, encodeMessageV2, push8 } from './utils';
import { EventEmitter } from 'events';
import { MSPCodes } from './codes';

interface MultiwiiSerialProtocolOpts {
  path: string;
  baudRate?: number;
  timeout?: number;
}

interface MultiwiiCommandCallback {
  code: MSPCodes;
  timeout: NodeJS.Timeout;
  resolve: (data: Buffer) => void;
  reject: (err: Error) => void;
}

export class MultiwiiSerialProtocol extends EventEmitter {
  private port: SerialPort;
  private conencted: boolean = false;

  private minTimeout: number = 50;
  private maxTimeout: number = 2000;
  private timeout: number = 200;

  private callbacks: MultiwiiCommandCallback[] = [];

  constructor(opt: MultiwiiSerialProtocolOpts) {
    const { path, baudRate = 115200, timeout = 200 } = opt;
    super();
    this.timeout = timeout;
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
    const len = buff[3];
    const code = buff[4];
    const payload = buff.slice(5, 5 + len);
    const msg = parseMsg(code, payload);
    // Process events
    if (msg) {
      this.emit('message', msg);
    } else {
      this.emit('error', new Error(`Unsupported message code: ${code}`));
    }
    // Process callbacks
    for (let i = this.callbacks.length - 1; i >= 0; i--) {
      const callback = this.callbacks[i];
      if (callback.code === code) {
        clearTimeout(callback.timeout);
        this.callbacks.splice(i, 1);
        callback.resolve(payload);
      }
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

  public async sendMessage(code: MSPCodes, payload: Buffer = Buffer.from([])) {
    if (!this.conencted) {
      throw new Error('Not connected');
    }
    const bufferOut = code <= 254 ? encodeMessageV1(code, payload) : encodeMessageV2(code, payload);
    await this.port.write(bufferOut);

    return new Promise<Buffer>((resolve, reject) => {
      this.callbacks.push({
        code,
        resolve,
        reject,
        timeout: setTimeout(() => {
          reject(new Error(`Command timeout, code: ${code}`));
        }, this.timeout),
      });
    });
  }

  public async getName() {
    const payload = await this.sendMessage(MSPCodes.MSP_NAME);
    const msg = parseMsg(MSPCodes.MSP_NAME, payload);
    return msg.code === MSPCodes.MSP_NAME ? msg.value : '';
  }

  public async setName(name: string) {
    await this.sendMessage(MSPCodes.MSP_SET_NAME, composeSetName(name));
  }

  public async getMotor() {
    const payload = await this.sendMessage(MSPCodes.MSP_MOTOR);
    const msg = parseMsg(MSPCodes.MSP_MOTOR, payload);
    return msg.code === MSPCodes.MSP_MOTOR ? msg.motor : [];
  }

  public async setMotor(motor: number[]) {
    await this.sendMessage(MSPCodes.MSP_SET_MOTOR, composeSetMotor(motor));
  }
}

export * from './codes';
export * from './msg';
