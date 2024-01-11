import { EventEmitter } from 'events';
import { SerialPort } from 'serialport';

import { MSPCodes } from './codes';
import {
  composeSetMotor,
  composeSetName,
  parseApiVersion,
  parseBoardInfo,
  parseBuildInfo,
  parseCompGPS,
  parseFcVariant,
  parseFcVersion,
  parseMotor,
  parseMotorTelemetry,
  parseMsg,
  parseName,
  parseRC,
  parseRawGPS,
  parseRawIMU,
  parseServo,
  parseStatus,
  parseStatusEx,
} from './msg';
import { BuffDataView, buffToDataView, encodeMessageV1, encodeMessageV2 } from './utils';

interface MultiwiiSerialProtocolOpts {
  path: string;
  baudRate?: number;
  timeout?: number;
}

interface MultiwiiCommandCallback {
  code: MSPCodes;
  timeout: NodeJS.Timeout;
  resolve: (data: BuffDataView) => void;
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
        callback.resolve(buffToDataView(payload));
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

    return new Promise<BuffDataView>((resolve, reject) => {
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

  // MSP_STATUS
  public async getStatus() {
    return parseStatus(await this.sendMessage(MSPCodes.MSP_STATUS));
  }

  // MSP_STATUS_EX
  public async getStatusEx() {
    return parseStatusEx(await this.sendMessage(MSPCodes.MSP_STATUS_EX));
  }

  // MSP_RAW_IMU
  public async getRawIMU() {
    return parseRawIMU(await this.sendMessage(MSPCodes.MSP_RAW_IMU));
  }

  // MSP_SERVO
  public async getServo() {
    return parseServo(await this.sendMessage(MSPCodes.MSP_SERVO));
  }

  // MSP_MOTOR
  public async getMotor() {
    return parseMotor(await this.sendMessage(MSPCodes.MSP_MOTOR));
  }

  // MSP_SET_MOTOR
  public async setMotor(motor: number[]) {
    await this.sendMessage(MSPCodes.MSP_SET_MOTOR, composeSetMotor(motor));
  }

  // MSP_MOTOR_TELEMETRY
  public async getMotorTelemetry() {
    return parseMotorTelemetry(await this.sendMessage(MSPCodes.MSP_MOTOR_TELEMETRY));
  }

  // MSP_RC
  public async getRc() {
    return parseRC(await this.sendMessage(MSPCodes.MSP_RC));
  }

  // MSP_RAW_GPS
  public async getRawGPS() {
    return parseRawGPS(await this.sendMessage(MSPCodes.MSP_RAW_GPS));
  }

  // MSP_COMP_GPS
  public async getCompGPS() {
    return parseCompGPS(await this.sendMessage(MSPCodes.MSP_COMP_GPS));
  }

  // MSP_API_VERSION
  public async getApiVersion() {
    return parseApiVersion(await this.sendMessage(MSPCodes.MSP_API_VERSION));
  }

  // MSP_FC_VARIANT
  public async getFcVariant() {
    return parseFcVariant(await this.sendMessage(MSPCodes.MSP_FC_VARIANT)).fcVariantIdentifier;
  }

  // MSP_FC_VERSION
  public async getFcVersion() {
    return parseFcVersion(await this.sendMessage(MSPCodes.MSP_FC_VERSION)).flightControllerVersion;
  }

  // MSP_BUILD_INFO
  public async getBuildInfo() {
    return parseBuildInfo(await this.sendMessage(MSPCodes.MSP_BUILD_INFO)).buildInfo;
  }

  // MSP_BOARD_INFO
  public async getBoardInfo() {
    return parseBoardInfo(await this.sendMessage(MSPCodes.MSP_BOARD_INFO));
  }

  // MSP_NAME
  public async getName() {
    return parseName(await this.sendMessage(MSPCodes.MSP_NAME)).value;
  }

  // MSP_SET_NAME
  public async setName(name: string) {
    await this.sendMessage(MSPCodes.MSP_SET_NAME, composeSetName(name));
  }
}

export * from './codes';
export * from './msg';
