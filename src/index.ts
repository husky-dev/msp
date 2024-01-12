import { EventEmitter } from 'events';
import { SerialPort } from 'serialport';

import { MSPCodes } from './codes';
import {
  composeSetMotor,
  composeSetName,
  MSPAnalog,
  MSPApiVersion,
  MSPBatteryConfig,
  MSPBatteryState,
  MSPBoardInfo,
  MSPCompGps,
  MSPCurrentMeter,
  MSPCurrentMeterConfig,
  MSPMotorConfig,
  MSPMotorTelemetry,
  MSPRawGPS,
  MSPRawIMU,
  MSPStatus,
  MSPStatusEx,
  MSPVoltageMeter,
  MSPVoltageMeterConfig,
  parseAltitude,
  parseAnalog,
  parseApiVersion,
  parseAttitude,
  parseBatteryConfig,
  parseBatteryState,
  parseBoardInfo,
  parseBuildInfo,
  parseCompGPS,
  parseCurrentMeterConfig,
  parseCurrentMeters,
  parseFcVariant,
  parseFcVersion,
  parseMotor,
  parseMotorConfig,
  parseMotorTelemetry,
  parseMsg,
  parseName,
  parseRawGPS,
  parseRawIMU,
  parseRC,
  parseServo,
  parseSonar,
  parseStatus,
  parseStatusEx,
  parseVoltageMeterConfig,
  parseVoltageMeters,
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
  public async getStatus(): Promise<MSPStatus> {
    return parseStatus(await this.sendMessage(MSPCodes.MSP_STATUS));
  }

  // MSP_STATUS_EX
  public async getStatusEx(): Promise<MSPStatusEx> {
    return parseStatusEx(await this.sendMessage(MSPCodes.MSP_STATUS_EX));
  }

  // MSP_RAW_IMU
  public async getRawIMU(): Promise<MSPRawIMU> {
    return parseRawIMU(await this.sendMessage(MSPCodes.MSP_RAW_IMU));
  }

  // MSP_SERVO
  public async getServo(): Promise<number[]> {
    return parseServo(await this.sendMessage(MSPCodes.MSP_SERVO));
  }

  // MSP_MOTOR
  public async getMotor(): Promise<number[]> {
    return parseMotor(await this.sendMessage(MSPCodes.MSP_MOTOR));
  }

  // MSP_SET_MOTOR
  public async setMotor(motor: number[]): Promise<void> {
    await this.sendMessage(MSPCodes.MSP_SET_MOTOR, composeSetMotor(motor));
  }

  // MSP_MOTOR_TELEMETRY
  public async getMotorTelemetry(): Promise<MSPMotorTelemetry[]> {
    return parseMotorTelemetry(await this.sendMessage(MSPCodes.MSP_MOTOR_TELEMETRY));
  }

  // MSP_RC
  public async getRc(): Promise<number[]> {
    return parseRC(await this.sendMessage(MSPCodes.MSP_RC));
  }

  // MSP_RAW_GPS
  public async getRawGPS(): Promise<MSPRawGPS> {
    return parseRawGPS(await this.sendMessage(MSPCodes.MSP_RAW_GPS));
  }

  // MSP_COMP_GPS
  public async getCompGPS(): Promise<MSPCompGps> {
    return parseCompGPS(await this.sendMessage(MSPCodes.MSP_COMP_GPS));
  }

  // MSP_ATTITUDE
  public async getAttitude(): Promise<number[]> {
    return parseAttitude(await this.sendMessage(MSPCodes.MSP_ATTITUDE));
  }

  // MSP_ALTITUDE
  public async getAltitude(): Promise<number> {
    return parseAltitude(await this.sendMessage(MSPCodes.MSP_ALTITUDE));
  }

  // MSP_SONAR
  public async getSonar(): Promise<number> {
    return parseSonar(await this.sendMessage(MSPCodes.MSP_SONAR));
  }

  // MSP_ANALOG
  public async getAnalog(): Promise<MSPAnalog> {
    return parseAnalog(await this.sendMessage(MSPCodes.MSP_ANALOG));
  }

  // MSP_VOLTAGE_METERS
  public async getVoltageMeters(): Promise<MSPVoltageMeter[]> {
    return parseVoltageMeters(await this.sendMessage(MSPCodes.MSP_VOLTAGE_METERS));
  }

  // MSP_CURRENT_METERS
  public async getCurrentMeters(): Promise<MSPCurrentMeter[]> {
    return parseCurrentMeters(await this.sendMessage(MSPCodes.MSP_CURRENT_METERS));
  }

  // MSP_BATTERY_STATE
  public async getBatteryState(): Promise<MSPBatteryState> {
    return parseBatteryState(await this.sendMessage(MSPCodes.MSP_BATTERY_STATE));
  }

  // MSP_VOLTAGE_METER_CONFIG
  public async getVoltageMeterConfig(): Promise<MSPVoltageMeterConfig[]> {
    return parseVoltageMeterConfig(await this.sendMessage(MSPCodes.MSP_VOLTAGE_METER_CONFIG));
  }

  // MSP_CURRENT_METER_CONFIG
  public async getCurrentMeterConfig(): Promise<MSPCurrentMeterConfig[]> {
    return parseCurrentMeterConfig(await this.sendMessage(MSPCodes.MSP_CURRENT_METER_CONFIG));
  }

  // MSP_BATTERY_CONFIG
  public async getBatteryConfig(): Promise<MSPBatteryConfig> {
    return parseBatteryConfig(await this.sendMessage(MSPCodes.MSP_BATTERY_CONFIG));
  }

  // TODO: MSP_SET_BATTERY_CONFIG

  // MSP_MOTOR_CONFIG
  public async getMotorConfig(): Promise<MSPMotorConfig> {
    return parseMotorConfig(await this.sendMessage(MSPCodes.MSP_MOTOR_CONFIG));
  }

  // TODO: MSP_DISPLAYPORT
  // TODO: MSP_SET_RAW_RC
  // TODO: MSP_SET_PID
  // TODO: MSP_SET_RC_TUNING
  // TODO: MSP_ACC_CALIBRATION
  // TODO: MSP_MAG_CALIBRATION
  // TODO: MSP_SET_MOTOR_CONFIG
  // TODO: MSP_SET_GPS_CONFIG
  // TODO: MSP_SET_GPS_RESCUE
  // TODO: MSP_SET_RSSI_CONFIG
  // TODO: MSP_SET_FEATURE_CONFIG
  // TODO: MSP_SET_BEEPER_CONFIG
  // TODO: MSP_RESET_CONF
  // TODO: MSP_SELECT_SETTING
  // TODO: MSP_SET_SERVO_CONFIGURATION
  // TODO: MSP_EEPROM_WRITE
  // TODO: MSP_SET_CURRENT_METER_CONFIG
  // TODO: MSP_SET_VOLTAGE_METER_CONFIG

  // MSP_API_VERSION
  public async getApiVersion(): Promise<MSPApiVersion> {
    return parseApiVersion(await this.sendMessage(MSPCodes.MSP_API_VERSION));
  }

  // MSP_FC_VARIANT
  public async getFcVariant(): Promise<string> {
    return parseFcVariant(await this.sendMessage(MSPCodes.MSP_FC_VARIANT));
  }

  // MSP_FC_VERSION
  public async getFcVersion(): Promise<string> {
    return parseFcVersion(await this.sendMessage(MSPCodes.MSP_FC_VERSION));
  }

  // MSP_BUILD_INFO
  public async getBuildInfo(): Promise<string> {
    return parseBuildInfo(await this.sendMessage(MSPCodes.MSP_BUILD_INFO));
  }

  // MSP_BOARD_INFO
  public async getBoardInfo(): Promise<MSPBoardInfo> {
    return parseBoardInfo(await this.sendMessage(MSPCodes.MSP_BOARD_INFO));
  }

  // MSP_NAME
  public async getName(): Promise<string> {
    return parseName(await this.sendMessage(MSPCodes.MSP_NAME));
  }

  // MSP_SET_NAME
  public async setName(name: string): Promise<void> {
    await this.sendMessage(MSPCodes.MSP_SET_NAME, composeSetName(name));
  }
}

export * from './codes';
export * from './msg';
