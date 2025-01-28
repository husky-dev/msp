import { EventEmitter } from 'events';
import { SerialPort } from 'serialport';

import { msp2GetTextCodes, MSPCodes } from './codes';
import {
  composeSetName,
  MSPAnalog,
  MSPApiVersion,
  MSPBatteryConfig,
  MSPBatteryState,
  MSPBeeperConfig,
  MSPBoardInfo,
  MSPCompGps,
  MSPCurrentMeter,
  MSPCurrentMeterConfig,
  MSPMotorConfig,
  MSPMotorTelemetry,
  MSPRawGPS,
  MSPRawIMU,
  MSPServoConfiguration,
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
  parseBeeperConfig,
  parseBoardInfo,
  parseBuildInfo,
  parseCompGPS,
  parseCurrentMeterConfig,
  parseCurrentMeters,
  parseFcVariant,
  parseFcVersion,
  parseGetText,
  parseMotor,
  parseMotorConfig,
  parseMotorTelemetry,
  parseMsg,
  parseName,
  parseRawGPS,
  parseRawIMU,
  parseRC,
  parseServo,
  parseServoConfigurations,
  parseSonar,
  parseStatus,
  parseStatusEx,
  parseUID,
  parseVoltageMeterConfig,
  parseVoltageMeters,
  parseModeRanges,
  MSPModeRange,
  parseModeRangesExtra,
  MSPModeRangeExtra,
  MSPMotor3DConfig,
  parseMotor3DConfig,
  MSPRcDeadbandConfig,
  parseRcDeadbandConfig,
  MSPGpsConfig,
  parseGpsConfig,
  MSPGpsRescueConfig,
  parseGpsRescue,
  MSPGpsSvInfo,
  parseGpsSvInfo,
  MSPVtxConfig,
  parseVtxConfig,
  MSPVtxTableBand,
  parseVtxTableBand,
  MSPVtxTablePowerLevel,
  parseVtxTablePowerLevel,
  MSPLedColor,
  parseLedColors,
  MSPLedStripModeColor,
  parseLedStripModeColor,
  MSPRxFailConfig,
  parseRxFailConfig,
  parseRxMap,
  MSPSensorConfig,
  parseSensorConfig,
  MSPSensorAlignment,
  parseSensorAlignment,
  MSPPid,
  parsePid,
  MSPBlackboxConfig,
  parseBlackboxConfig,
} from './msg';
import { BuffDataView, buffToDataView, decodeMessage, encodeMessage, push16 } from './utils';

interface MultiwiiSerialProtocolOpts {
  path: string;
  baudRate?: number;
  timeout?: number;
}

interface MultiwiiCommandCallback {
  code: number;
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
   * List
   */

  public static async list() {
    return SerialPort.list();
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
    const res = decodeMessage(buff);
    // Process events
    if (!res.success) {
      this.emit('error', res.error);
    } else {
      const msg = parseMsg(res.code, res.payload);
      if (msg) {
        this.emit('message', msg);
      } else {
        this.emit('error', new Error(`Unsupported message code: ${res.code}`));
      }
    }
    // Process callbacks
    for (let i = this.callbacks.length - 1; i >= 0; i--) {
      const callback = this.callbacks[i];
      if (callback.code === res.code) {
        clearTimeout(callback.timeout);
        this.callbacks.splice(i, 1);
        if (res.success) {
          callback.resolve(buffToDataView(res.payload));
        } else {
          callback.reject(res.error);
        }
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

  public async sendMessage(code: number, payload: Buffer = Buffer.from([])) {
    if (!this.conencted) {
      throw new Error('Not connected');
    }
    const bufferOut = encodeMessage(code, payload);
    this.port.write(bufferOut);
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

  /**
   * Status
   */

  /**
   * Retrieves the status of the flight controller
   * @see MSP_STATUS
   * @example
   * {
   *   cycleTime: 253,
   *   i2cError: 0,
   *   activeSensors: 35,
   *   mode: 0,
   *   profile: 0
   * }
   */
  public async getStatus(): Promise<MSPStatus> {
    return parseStatus(await this.sendMessage(MSPCodes.MSP_STATUS));
  }

  /**
   * Retrieves the extended status of the flight controller
   * @see MSP_STATUS_EX
   * @example
   *  {
   *    cycleTime: 254,
   *    i2cError: 0,
   *    activeSensors: 35,
   *    mode: 0,
   *    profile: 0,
   *    cpuload: 44,
   *    numProfiles: 4,
   *    rateProfile: 0,
   *    armingDisableCount: 26,
   *    armingDisableFlags: 1048580,
   *    configStateFlag: 0
   *  }
   */
  public async getStatusEx(): Promise<MSPStatusEx> {
    return parseStatusEx(await this.sendMessage(MSPCodes.MSP_STATUS_EX));
  }

  /**
   * IMU
   */

  /**
   * Retrieves the raw IMU data
   * @see MSP_RAW_IMU
   * @example
   * {
   *   accelerometer: [ 0.00048828125, 0.01806640625, 0.25341796875 ],
   *   gyroscope: [ 0.24390243902439027, 0, -0.48780487804878053 ],
   *   magnetometer: [ 0, 0, 0 ]
   * }
   */
  public async getRawIMU(): Promise<MSPRawIMU> {
    return parseRawIMU(await this.sendMessage(MSPCodes.MSP_RAW_IMU));
  }

  /**
   * Servo
   */

  /**
   * Retrieves the servo data
   * @see MSP_SERVO
   * @example
   * [ 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500 ]
   */
  public async getServo(): Promise<number[]> {
    return parseServo(await this.sendMessage(MSPCodes.MSP_SERVO));
  }

  // TODO: MSP_SERVO_MIX_RULES

  /**
   * Retrieves the servo configuration
   * @see MSP_SERVO_CONFIGURATIONS
   * @example
   * [
   *   {
   *     min: 1000,
   *     max: 2000,
   *     middle: 1500,
   *     rate: 100,
   *     indexOfChannelToForward: 255,
   *     reversedInputSources: 0
   *   },
   *   {
   *     min: 1000,
   *     max: 2000,
   *     middle: 1500,
   *     rate: 100,
   *     indexOfChannelToForward: 255,
   *     reversedInputSources: 0
   *   },
   *   {
   *     min: 1000,
   *     max: 2000,
   *     middle: 1500,
   *     rate: 100,
   *     indexOfChannelToForward: 255,
   *     reversedInputSources: 0
   *   },
   *   {
   *     min: 1000,
   *     max: 2000,
   *     middle: 1500,
   *     rate: 100,
   *     indexOfChannelToForward: 255,
   *     reversedInputSources: 0
   *   },
   *   {
   *     min: 1000,
   *     max: 2000,
   *     middle: 1500,
   *     rate: 100,
   *     indexOfChannelToForward: 255,
   *     reversedInputSources: 0
   *   },
   *   {
   *     min: 1000,
   *     max: 2000,
   *     middle: 1500,
   *     rate: 100,
   *     indexOfChannelToForward: 255,
   *     reversedInputSources: 0
   *   },
   *   {
   *     min: 1000,
   *     max: 2000,
   *     middle: 1500,
   *     rate: 100,
   *     indexOfChannelToForward: 255,
   *     reversedInputSources: 0
   *   },
   *   {
   *     min: 1000,
   *     max: 2000,
   *     middle: 1500,
   *     rate: 100,
   *     indexOfChannelToForward: 255,
   *     reversedInputSources: 0
   *   }
   * ]
   */
  public async getServoConfigurations(): Promise<MSPServoConfiguration[]> {
    return parseServoConfigurations(await this.sendMessage(MSPCodes.MSP_SERVO_CONFIGURATIONS));
  }

  // TODO: MSP_SET_SERVO_CONFIGURATION

  /**
   * Motor
   */

  /**
   * Retrieves the motor data
   * @see MSP_MOTOR
   * @example [ 1000, 1000, 1000, 1000, 0, 0, 0, 0 ]
   */
  public async getMotor(): Promise<number[]> {
    return parseMotor(await this.sendMessage(MSPCodes.MSP_MOTOR));
  }

  /**
   * Sets the motor data
   * @see MSP_SET_MOTOR
   * @todo Test
   */
  public async setMotor(motor: number[]): Promise<void> {
    let buffer: number[] = [];
    for (let i = 0; i < motor.length; i++) {
      buffer = push16(buffer, motor[1]);
    }
    await this.sendMessage(MSPCodes.MSP_SET_MOTOR, Buffer.from(buffer));
  }

  /**
   * Retrieves the motor config
   * @see MSP_MOTOR_CONFIG
   * @example
   * {
   *   minthrottle: 1070,
   *   maxthrottle: 2000,
   *   mincommand: 1000,
   *   motorCount: 4,
   *   motorPoles: 14,
   *   useDshotTelemetry: true,
   *   useEscSensor: true
   * }
   */
  public async getMotorConfig(): Promise<MSPMotorConfig> {
    return parseMotorConfig(await this.sendMessage(MSPCodes.MSP_MOTOR_CONFIG));
  }

  // TODO: MSP_SET_MOTOR_CONFIG

  /**
   * Retrieves the motor telemetry
   * @see MSP_MOTOR_TELEMETRY
   * @example
   * [
   *   {
   *     rpm: 0,
   *     invalidPercent: 10000,
   *     temperature: 0,
   *     voltage: 0,
   *     current: 0,
   *     consumption: 0
   *   },
   *   {
   *     rpm: 0,
   *     invalidPercent: 10000,
   *     temperature: 0,
   *     voltage: 0,
   *     current: 0,
   *     consumption: 0
   *   },
   *   {
   *     rpm: 0,
   *     invalidPercent: 10000,
   *     temperature: 0,
   *     voltage: 0,
   *     current: 0,
   *     consumption: 0
   *   },
   *   {
   *     rpm: 0,
   *     invalidPercent: 10000,
   *     temperature: 0,
   *     voltage: 0,
   *     current: 0,
   *     consumption: 0
   *   }
   * ]
   */
  public async getMotorTelemetry(): Promise<MSPMotorTelemetry[]> {
    return parseMotorTelemetry(await this.sendMessage(MSPCodes.MSP_MOTOR_TELEMETRY));
  }

  // TODO: MSP2_MOTOR_OUTPUT_REORDERING
  // TODO: MSP2_SET_MOTOR_OUTPUT_REORDERING

  /**
   * Retrieves the motor 3D config
   * @see MSP_MOTOR_3D_CONFIG
   * @example
   * {
   *   deadband3dLow: 1406,
   *   deadband3dHigh: 1514,
   *   neutral: 1460
   * }
   */
  public async getMotor3DConfig(): Promise<MSPMotor3DConfig> {
    return parseMotor3DConfig(await this.sendMessage(MSPCodes.MSP_MOTOR_3D_CONFIG));
  }

  // TODO: MSP_SET_MOTOR_3D_CONFIG

  /**
   * RC
   */

  /**
   * Retrieves the RC data. The data is an array of 8 channels with values between 1000 and 2000.
   * The first 4 channels are the sticks and the last 4 channels are the aux channels.
   * @see MSP_RC
   * @example  [ 1500, 1500, 1500,  885, 1675, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500 ]
   */
  public async getRc(): Promise<number[]> {
    return parseRC(await this.sendMessage(MSPCodes.MSP_RC));
  }

  // TODO: MSP_SET_RAW_RC

  // TODO: MSP_RC_TUNING
  // TODO: MSP_SET_RC_TUNING

  /**
   * Retrieves the RC deadband configuration
   * @see MSP_RC_DEADBAND
   * @example
   * {
   *   deadband: 0,
   *   yawDeadband: 0,
   *   altHoldDeadband: 40,
   *   deadband3dThrottle: 50
   * }
   */
  public async getRcDeadbandConfig(): Promise<MSPRcDeadbandConfig> {
    return parseRcDeadbandConfig(await this.sendMessage(MSPCodes.MSP_RC_DEADBAND));
  }

  // TODO: MSP_SET_RC_DEADBAND

  /**
   * GPS
   */

  /**
   * Retrieves the raw GPS data
   * @see MSP_RAW_GPS
   * @example
   * {
   *   fix: 0,
   *   numSat: 0,
   *   lat: 0,
   *   lon: 0,
   *   alt: 0,
   *   speed: 0,
   *   groundCourse: 0
   * }
   */
  public async getRawGPS(): Promise<MSPRawGPS> {
    return parseRawGPS(await this.sendMessage(MSPCodes.MSP_RAW_GPS));
  }

  /**
   * Retrieves the compas GPS data
   * @see MSP_COMP_GPS
   * @example { distanceToHome: 0, directionToHome: 0, update: 0 }
   */
  public async getCompGPS(): Promise<MSPCompGps> {
    return parseCompGPS(await this.sendMessage(MSPCodes.MSP_COMP_GPS));
  }

  /**
   * Retrieves the GPS config
   * @see MSP_GPS_CONFIG
   * @example
   * {
   *   provider: 1,
   *   ubloxSbas: 5,
   *   autoConfig: 1,
   *   autoBaud: 0,
   *   homePointOnce: 0,
   *   ubloxUseGalileo: 0
   * }
   */
  public async getGpsConfig(): Promise<MSPGpsConfig> {
    return parseGpsConfig(await this.sendMessage(MSPCodes.MSP_GPS_CONFIG));
  }

  // TODO: MSP_SET_GPS_CONFIG

  public async getGpsRescue(): Promise<MSPGpsRescueConfig> {
    return parseGpsRescue(await this.sendMessage(MSPCodes.MSP_GPS_RESCUE));
  }

  // TODO: MSP_SET_GPS_RESCUE

  /**
   * Retrieves the GPS SV info
   * @see MSP_GPS_SV_INFO
   * @example
   * {
   *   numCh: 0,
   *   chn: [],
   *   svid: [],
   *   quality: [],
   *   cno: []
   * }
   */
  public async getGpsSvInfo(): Promise<MSPGpsSvInfo> {
    return parseGpsSvInfo(await this.sendMessage(MSPCodes.MSP_GPS_SV_INFO));
  }

  /**
   * Compas
   */

  // TODO: MSP_COMPASS_CONFIG
  // TODO: MSP_SET_COMPASS_CONFIG

  /**
   * Attitude / Altitude / Sonar / Analog
   */

  /**
   * Retrieves the attitude data
   * @see MSP_ATTITUDE
   * @example [ 4.1, -0.1, 14.2 ]
   */
  public async getAttitude(): Promise<number[]> {
    return parseAttitude(await this.sendMessage(MSPCodes.MSP_ATTITUDE));
  }

  /**
   * Retrieves the altitude data
   * @see MSP_ALTITUDE
   * @example -0.14
   */
  public async getAltitude(): Promise<number> {
    return parseAltitude(await this.sendMessage(MSPCodes.MSP_ALTITUDE));
  }

  /**
   * Retrieves the sonar data
   * @see MSP_SONAR
   * @example 0
   */
  public async getSonar(): Promise<number> {
    return parseSonar(await this.sendMessage(MSPCodes.MSP_SONAR));
  }

  /**
   * Retrieves the analog data
   * @see MSP_ANALOG
   * @example
   * {
   *   voltage: 0.1,
   *   mAhdrawn: 0,
   *   rssi: 0,
   *   amperage: 0
   * }
   */
  public async getAnalog(): Promise<MSPAnalog> {
    return parseAnalog(await this.sendMessage(MSPCodes.MSP_ANALOG));
  }

  /**
   * Voltage
   */

  /**
   * Retrieves the voltage data
   * @see MSP_VOLTAGE_METERS
   * @example
   * [
   *   { id: 10, voltage: 0.1 },
   *   { id: 50, voltage: 0 },
   *   { id: 60, voltage: 0 },
   *   { id: 61, voltage: 0 },
   *   { id: 62, voltage: 0 },
   *   { id: 63, voltage: 0 }
   * ]
   */
  public async getVoltageMeters(): Promise<MSPVoltageMeter[]> {
    return parseVoltageMeters(await this.sendMessage(MSPCodes.MSP_VOLTAGE_METERS));
  }

  /**
   * Retrieves the voltage meter config
   * @see MSP_VOLTAGE_METER_CONFIG
   * @example
   * [
   *   { id: 10, sensorType: 0, vbatscale: 110, vbatresdivval: 10, vbatresdivmultiplier: 1 }
   * ];
   */
  public async getVoltageMeterConfig(): Promise<MSPVoltageMeterConfig[]> {
    return parseVoltageMeterConfig(await this.sendMessage(MSPCodes.MSP_VOLTAGE_METER_CONFIG));
  }

  // MSP_SET_VOLTAGE_METER_CONFIG
  // Not used

  /**
   * Current
   */

  /**
   * Retrieves the current meter data
   * @see MSP_CURRENT_METERS
   * @example
   * [
   *   { id: 10, mAhDrawn: 0, amperage: 0 },
   *   { id: 80, mAhDrawn: 0, amperage: 0 },
   *   { id: 50, mAhDrawn: 0, amperage: 0 },
   *   { id: 60, mAhDrawn: 0, amperage: 0 },
   *   { id: 61, mAhDrawn: 0, amperage: 0 },
   *   { id: 62, mAhDrawn: 0, amperage: 0 },
   *   { id: 63, mAhDrawn: 0, amperage: 0 }
   * ]
   */
  public async getCurrentMeters(): Promise<MSPCurrentMeter[]> {
    return parseCurrentMeters(await this.sendMessage(MSPCodes.MSP_CURRENT_METERS));
  }

  /**
   * Retrieves the current meter config
   * @see MSP_CURRENT_METER_CONFIG
   * @example
   * [
   *   { id: 10, sensorType: 1, scale: 400, offset: 0 },
   *   { id: 80, sensorType: 0, scale: 0, offset: 0 }
   * ]
   */
  public async getCurrentMeterConfig(): Promise<MSPCurrentMeterConfig[]> {
    return parseCurrentMeterConfig(await this.sendMessage(MSPCodes.MSP_CURRENT_METER_CONFIG));
  }

  // MSP_SET_CURRENT_METER_CONFIG
  // Not used

  /**
   * Batter
   */

  /**
   * Retrieves the battery state
   * @see MSP_BATTERY_STATE
   * @example
   * {
   *   cellCount: 0,
   *   capacity: 0,
   *   voltage: 0.1,
   *   mAhDrawn: 0,
   *   amperage: 0,
   *   batteryState: 3
   * }
   */
  public async getBatteryState(): Promise<MSPBatteryState> {
    return parseBatteryState(await this.sendMessage(MSPCodes.MSP_BATTERY_STATE));
  }

  /**
   * Retrieves the battery config
   * @see MSP_BATTERY_CONFIG
   * @example
   * {
   *   vbatmincellvoltage: 3.3,
   *   vbatmaxcellvoltage: 4.3,
   *   vbatwarningcellvoltage: 3.5,
   *   capacity: 0,
   *   voltageMeterSource: 1,
   *   currentMeterSource: 1
   * }
   */
  public async getBatteryConfig(): Promise<MSPBatteryConfig> {
    return parseBatteryConfig(await this.sendMessage(MSPCodes.MSP_BATTERY_CONFIG));
  }

  // TODO: MSP_SET_BATTERY_CONFIG

  /**
   * Get the API version of the flight controller
   * @see MSP_API_VERSION
   * @example
   * {
   *   mspProtocolVersion: 0,
   *   apiVersion: '1.45.0'
   * }
   */
  public async getApiVersion(): Promise<MSPApiVersion> {
    return parseApiVersion(await this.sendMessage(MSPCodes.MSP_API_VERSION));
  }

  /**
   * Get the flight controller variant
   * @see MSP_FC_VARIANT
   * @example 'BTFL'
   */
  public async getFcVariant(): Promise<string> {
    return parseFcVariant(await this.sendMessage(MSPCodes.MSP_FC_VARIANT));
  }

  /**
   * Get the flight controller version
   * @see MSP_FC_VERSION
   * @example '4.4.3'
   */
  public async getFcVersion(): Promise<string> {
    return parseFcVersion(await this.sendMessage(MSPCodes.MSP_FC_VERSION));
  }

  /**
   * Get the build info of the flight controller
   * @see MSP_BUILD_INFO
   * @example 'Nov 18 2023 06:49:34'
   */
  public async getBuildInfo(): Promise<string> {
    return parseBuildInfo(await this.sendMessage(MSPCodes.MSP_BUILD_INFO));
  }

  /**
   * Get the board info of the flight controller
   * @see MSP_BOARD_INFO
   * @example
   * {
   *   boardIdentifier: 'S405',
   *   boardVersion: 0,
   *   boardType: 2,
   *   targetCapabilities: 55,
   *   targetName: 'STM32F405',
   *   boardName: 'SPEEDYBEEF405V4',
   *   manufacturerId: 'SPBE',
   *   signature: [
   *     0, 0, 0, 0, 0, 0, 0, 0, 0,
   *     0, 0, 0, 0, 0, 0, 0, 0, 0,
   *     0, 0, 0, 0, 0, 0, 0, 0, 0,
   *     0, 0, 0, 0, 0
   *   ],
   *   mcuTypeId: 1
   * }
   */
  public async getBoardInfo(): Promise<MSPBoardInfo> {
    return parseBoardInfo(await this.sendMessage(MSPCodes.MSP_BOARD_INFO));
  }

  /**
   * VTX
   */

  /**
   * Retrieves the VTX config
   * @see MSP_VTX_CONFIG
   * @example
   * {
   *   vtxType: 3,
   *   vtxBand: 3,
   *   vtxChannel: 2,
   *   vtxPower: 2,
   *   vtxPitMode: false,
   *   vtxFrequency: 5685,
   *   vtxDeviceReady: false,
   *   vtxLowPowerDisarm: 2,
   *   vtxPitModeFrequency: 0,
   *   vtxTableAvailable: true,
   *   vtxTableBands: 6,
   *   vtxTableChannels: 8,
   *   vtxTablePowerLevels: 4,
   *   vtxTableClear: false
   * }
   */
  public async getVtxConfig(): Promise<MSPVtxConfig> {
    return parseVtxConfig(await this.sendMessage(MSPCodes.MSP_VTX_CONFIG));
  }

  // TODO: MSP_SET_VTX_CONFIG

  public async getVtxTableBand(): Promise<MSPVtxTableBand> {
    return parseVtxTableBand(await this.sendMessage(MSPCodes.MSP_VTXTABLE_BAND));
  }

  // TODO: MSP_SET_VTXTABLE_BAND

  public async getVtxTablePowerLevel(): Promise<MSPVtxTablePowerLevel> {
    return parseVtxTablePowerLevel(await this.sendMessage(MSPCodes.MSP_VTXTABLE_POWERLEVEL));
  }

  // TODO: MSP_SET_VTXTABLE_POWERLEVEL

  // TODO: MSP2_GET_VTX_DEVICE_STATUS

  /**
   * LED
   */

  // TODO: MSP_LED_STRIP_CONFIG
  // TODO: MSP_SET_LED_STRIP_CONFIG

  /**
   * Retrieves the LED colors
   * @see MSP_LED_COLORS
   * @example
   * [
   *   { h: 0, s: 0, v: 0 },
   *   { h: 0, s: 255, v: 255 },
   *   { h: 0, s: 0, v: 255 },
   *   { h: 30, s: 0, v: 255 },
   *   { h: 60, s: 0, v: 255 },
   *   { h: 90, s: 0, v: 255 },
   *   { h: 120, s: 0, v: 255 },
   *   { h: 150, s: 0, v: 255 },
   *   { h: 180, s: 0, v: 255 },
   *   { h: 210, s: 0, v: 255 },
   *   { h: 240, s: 0, v: 255 },
   *   { h: 270, s: 0, v: 255 },
   *   { h: 300, s: 0, v: 255 },
   *   { h: 330, s: 0, v: 255 },
   *   { h: 0, s: 0, v: 0 },
   *   { h: 0, s: 0, v: 0 }
   * ]
   */
  public async getLedColors(): Promise<MSPLedColor[]> {
    return parseLedColors(await this.sendMessage(MSPCodes.MSP_LED_COLORS));
  }

  // TODO: MSP_SET_LED_COLORS

  /**
   * Retrieves the LED strip mode color
   * @see MSP_LED_STRIP_MODECOLOR
   * @example
   * [
   *   { mode: 0, direction: 0, color: 1 },
   *   { mode: 0, direction: 1, color: 11 },
   *   { mode: 0, direction: 2, color: 2 },
   *   { mode: 0, direction: 3, color: 13 },
   *   { mode: 0, direction: 4, color: 10 },
   *   { mode: 0, direction: 5, color: 3 },
   *   { mode: 1, direction: 0, color: 5 },
   *   { mode: 1, direction: 1, color: 11 },
   *   { mode: 1, direction: 2, color: 3 },
   *   { mode: 1, direction: 3, color: 13 },
   *   { mode: 1, direction: 4, color: 10 },
   *   { mode: 1, direction: 5, color: 3 },
   * ]
   */
  public async getLedStripModeColor(): Promise<MSPLedStripModeColor[]> {
    return parseLedStripModeColor(await this.sendMessage(MSPCodes.MSP_LED_STRIP_MODECOLOR));
  }

  // TODO: MSP_SET_LED_STRIP_MODECOLOR

  // TODO: MSP2_SET_LED_STRIP_CONFIG_VALUES
  // TODO: MSP2_GET_LED_STRIP_CONFIG_VALUES

  /**
   * RX
   */

  // TODO: MSP_RX_CONFIG
  // TODO: MSP_SET_RX_CONFIG

  /**
   * Retrieves the RX fail config
   * @see MSP_RXFAIL_CONFIG
   * @example
   * [
   *   { mode: 0, value: 1500 },
   *   { mode: 0, value: 1500 },
   *   { mode: 0, value: 1500 },
   *   { mode: 0, value: 875 },
   *   { mode: 1, value: 1500 },
   *   { mode: 1, value: 1500 },
   *   { mode: 1, value: 1500 },
   *   { mode: 1, value: 1500 },
   *   { mode: 1, value: 1500 },
   *   { mode: 1, value: 1500 },
   *   { mode: 1, value: 1500 },
   *   { mode: 1, value: 1500 },
   *   { mode: 1, value: 1500 },
   *   { mode: 1, value: 1500 },
   *   { mode: 1, value: 1500 },
   *   { mode: 1, value: 1500 }
   * ]
   */
  public async getRxFailConfig(): Promise<MSPRxFailConfig[]> {
    return parseRxFailConfig(await this.sendMessage(MSPCodes.MSP_RXFAIL_CONFIG));
  }

  // TODO: MSP_SET_RXFAIL_CONFIG

  /**
   * Retrieves the RX map
   * @see MSP_RX_MAP
   * [
   *   0, 1, 3, 2,
   *   4, 5, 6, 7
   * ]
   */
  public async getRxMap(): Promise<number[]> {
    return parseRxMap(await this.sendMessage(MSPCodes.MSP_RX_MAP));
  }

  // TODO: MSP_SET_RX_MAP

  /**
   * Sensor
   */

  /**
   * Retrieves the sensor data
   * @see MSP_SENSOR
   * @example
   * {
   *   accHardware: 0,
   *   baroHardware: 0,
   *   magHardware: 0
   * }
   */
  public async getSensorConfig(): Promise<MSPSensorConfig> {
    return parseSensorConfig(await this.sendMessage(MSPCodes.MSP_SENSOR_CONFIG));
  }

  // TODO: MSP_SET_SENSOR_CONFIG

  /**
   * Retrieves the sensor alignment
   * @see MSP_SENSOR_ALIGNMENT
   * @example
   * {
   *   alignGyro: 2,
   *   alignAcc: 2,
   *   alignMag: 0,
   *   gyroDetectionFlags: 1,
   *   gyroToUse: 0,
   *   gyro1Align: 2,
   *   gyro2Align: 1
   * }
   */
  public async getSensorAlignment(): Promise<MSPSensorAlignment> {
    return parseSensorAlignment(await this.sendMessage(MSPCodes.MSP_SENSOR_ALIGNMENT));
  }

  // TODO: MSP_SET_SENSOR_ALIGNMENT

  // TODO: MSP2_SENSOR_CONFIG_ACTIVE

  /**
   * PID
   */

  /**
   * Retrieves the PID data
   * @see MSP_PID
   * [
   *   { p: 45, i: 80, d: 36 },
   *   { p: 47, i: 84, d: 41 },
   *   { p: 45, i: 80, d: 0 },
   *   { p: 50, i: 50, d: 75 },
   *   { p: 40, i: 0, d: 0 }
   * ]
   */
  public async getPid(): Promise<MSPPid[]> {
    return parsePid(await this.sendMessage(MSPCodes.MSP_PID));
  }

  // TODO: MSP_SET_PID

  // TODO: MSP_PID_ADVANCED
  // TODO: MSP_SET_PID_ADVANCED

  /**
   * Blackbox
   */

  /**
   * Retrieves the blackbox config
   * @see MSP_BLACKBOX_CONFIG
   * @example
   * {
   *   supported: true,
   *   blackboxDevice: 2,
   *   blackboxRateNum: 1,
   *   blackboxRateDenom: 2,
   *   blackboxPDenom: 64,
   *   blackboxSampleRate: 1
   * }
   */
  public async getBlackboxConfig(): Promise<MSPBlackboxConfig> {
    return parseBlackboxConfig(await this.sendMessage(MSPCodes.MSP_BLACKBOX_CONFIG));
  }

  // TODO: MSP_SET_BLACKBOX_CONFIG

  /**
   * OSD
   */

  // TODO: MSP_OSD_CANVAS
  // TODO: MSP_SET_OSD_CANVAS

  // TODO: MSP_OSD_CONFIG
  // TODO: MSP_SET_OSD_CONFIG

  // TODO: MSP_OSD_CHAR_READ
  // TODO: MSP_OSD_CHAR_WRITE

  /**
   * Text
   */

  async getPilotName(): Promise<string> {
    const data = await this.sendMessage(MSPCodes.MSP2_GET_TEXT, Buffer.from([msp2GetTextCodes.PILOT_NAME]));
    const { type: textType, value } = parseGetText(data);
    return textType === msp2GetTextCodes.PILOT_NAME ? value : '';
  }

  async setPilotName(name: string): Promise<void> {
    const data = Buffer.from([msp2GetTextCodes.PILOT_NAME, name.length, ...name.split('').map((c) => c.charCodeAt(0))]);
    await this.sendMessage(MSPCodes.MSP2_SET_TEXT, data);
  }

  // TODO: MSP2_GET_TEXT
  // TODO: MSP2_SET_TEXT
  // TODO: PILOT_NAME
  // TODO: CRAFT_NAME
  // TODO: PID_PROFILE_NAME
  // TODO: RATE_PROFILE_NAME

  // TODO: BUILD_KEY
  // TODO: MSP_SET_CHANNEL_FORWARDING

  /**
   * Retrieves the mode ranges configuration from the flight controller.
   * The mode ranges define the activation ranges for specific flight modes based
   * on auxiliary (AUX) channel values.
   * @see MSP_MODE_RANGES
   * @example
   * [
   *   { id: 0, auxChannelIndex: 0, range: { start: 1700, end: 2100 } },
   *   { id: 1, auxChannelIndex: 1, range: { start: 900, end: 1300 } },
   *   { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } },
   *   { id: 13, auxChannelIndex: 5, range: { start: 1700, end: 2100 } },
   *   { id: 26, auxChannelIndex: 3, range: { start: 1900, end: 2100 } },
   *   { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } },
   *   { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } },
   *   { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } },
   *   { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } },
   *   { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } },
   *   { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } },
   *   { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } },
   *   { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } },
   *   { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } },
   *   { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } },
   *   { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } },
   *   { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } },
   *   { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } },
   *   { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } },
   *   { id: 0, auxChannelIndex: 0, range: { start: 900, end: 900 } }
   * ]
   */
  public async getModeRanges(): Promise<MSPModeRange[]> {
    return parseModeRanges(await this.sendMessage(MSPCodes.MSP_MODE_RANGES));
  }

  /**
   * Retrieves the extended mode ranges configuration from the flight controller.
   * The extended mode ranges provide additional configuration options for specific flight modes.
   * @see MSP_MODE_RANGES_EXTRA
   * @example
   * [
   *   { id: 0, modeLogic: 0, linkedTo: 0 },
   *   { id: 1, modeLogic: 0, linkedTo: 0 },
   *   { id: 0, modeLogic: 0, linkedTo: 0 },
   *   { id: 13, modeLogic: 0, linkedTo: 0 },
   *   { id: 26, modeLogic: 0, linkedTo: 0 },
   *   { id: 0, modeLogic: 0, linkedTo: 0 },
   *   { id: 0, modeLogic: 0, linkedTo: 0 },
   *   { id: 0, modeLogic: 0, linkedTo: 0 },
   *   { id: 0, modeLogic: 0, linkedTo: 0 },
   *   { id: 0, modeLogic: 0, linkedTo: 0 },
   *   { id: 0, modeLogic: 0, linkedTo: 0 },
   *   { id: 0, modeLogic: 0, linkedTo: 0 },
   *   { id: 0, modeLogic: 0, linkedTo: 0 },
   *   { id: 0, modeLogic: 0, linkedTo: 0 },
   *   { id: 0, modeLogic: 0, linkedTo: 0 },
   *   { id: 0, modeLogic: 0, linkedTo: 0 },
   *   { id: 0, modeLogic: 0, linkedTo: 0 },
   *   { id: 0, modeLogic: 0, linkedTo: 0 },
   *   { id: 0, modeLogic: 0, linkedTo: 0 },
   *   { id: 0, modeLogic: 0, linkedTo: 0 }
   * ]
   */
  public async getModeRangesExtra(): Promise<MSPModeRangeExtra[]> {
    return parseModeRangesExtra(await this.sendMessage(MSPCodes.MSP_MODE_RANGES_EXTRA));
  }

  // TODO: MSP_SET_MODE_RANGE
  // TODO: MSP_ADJUSTMENT_RANGES
  // TODO: MSP_SET_ADJUSTMENT_RANGE

  // TODO: MSP_SET_RTC
  // TODO: MSP_BOXIDS
  // TODO: MSP_BOXNAMES
  // TODO: MSP_CALCULATE_SIMPLIFIED_DTERM
  // TODO: MSP_CALCULATE_SIMPLIFIED_GYRO
  // TODO: MSP_CALCULATE_SIMPLIFIED_PID
  // TODO: MSP_COPY_PROFILE
  // TODO: MSP_DATAFLASH_ERASE
  // TODO: MSP_DATAFLASH_READ
  // TODO: MSP_DATAFLASH_SUMMARY
  // TODO: MSP_DEBUG
  // TODO: MSP_DISPLAYPORT
  // TODO: MSP_EEPROM_WRITE
  // TODO: MSP_ACC_CALIBRATION
  // TODO: MSP_MAG_CALIBRATION
  // TODO: MSP_MISC
  // TODO: MSP_MULTIPLE_MSP
  // TODO: MSP_PIDNAMES
  // TODO: MSP_RESET_CONF
  // TODO: MSP_SDCARD_SUMMARY
  // TODO: MSP_SELECT_SETTING
  // TODO: MSP_SET_RESET_CURR_PID
  // TODO: MSP2_SEND_DSHOT_COMMAND

  // TODO: MSP_RSSI_CONFIG
  // TODO: MSP_SET_RSSI_CONFIG

  // TODO: MSP_ADVANCED_CONFIG
  // TODO: MSP_SET_ADVANCED_CONFIG

  // TODO: MSP_FILTER_CONFIG
  // TODO: MSP_SET_FILTER_CONFIG

  // TODO: MSP2_COMMON_SERIAL_CONFIG
  // TODO: MSP2_COMMON_SET_SERIAL_CONFIG

  // TODO: MSP_FAILSAFE_CONFIG
  // TODO: MSP_SET_FAILSAFE_CONFIG

  // TODO: MSP_CF_SERIAL_CONFIG
  // TODO: MSP_SET_CF_SERIAL_CONFIG

  // TODO: MSP_TRANSPONDER_CONFIG
  // TODO: MSP_SET_TRANSPONDER_CONFIG

  // TODO: MSP_SIMPLIFIED_TUNING
  // TODO: MSP_SET_SIMPLIFIED_TUNING
  // TODO: MSP_VALIDATE_SIMPLIFIED_TUNING

  // TODO: MSP_BOARD_ALIGNMENT_CONFIG
  // TODO: MSP_SET_BOARD_ALIGNMENT_CONFIG

  // TODO: MSP_PID_CONTROLLER
  // TODO: MSP_SET_PID_CONTROLLER

  // TODO: MSP_SET_LOOP_TIME
  // TODO: MSP_LOOP_TIME

  // TODO: MSP_ARMING_CONFIG
  // TODO: MSP_SET_ARMING_CONFIG
  // TODO: MSP_ARMING_DISABLE

  // TODO: MSP_SET_MIXER_CONFIG
  // TODO: MSP_MIXER_CONFIG

  // TODO: MSP_ACC_TRIM
  // TODO: MSP_SET_ACC_TRIM

  // TODO: MSP_FEATURE_CONFIG
  // TODO: MSP_SET_FEATURE_CONFIG

  /**
   * Get the beeper config of the flight controller
   * @see MSP_BEEPER_CONFIG
   * @example
   * {
   *   disabledMask: 131328,
   *   dshotBeaconTone: 4,
   *   dshotBeaconConditionsMask: 2
   * }
   */
  public async getBeeperConfig(): Promise<MSPBeeperConfig> {
    return parseBeeperConfig(await this.sendMessage(MSPCodes.MSP_BEEPER_CONFIG));
  }

  // TODO: MSP_SET_BEEPER_CONFIG

  // TODO: MSP_SET_REBOOT

  /**
   * Get the name of the flight controller
   * @see MSP_NAME
   * @example 'SDUA_123456'
   */
  public async getName(): Promise<string> {
    return parseName(await this.sendMessage(MSPCodes.MSP_NAME));
  }

  /**
   * Set the name of the flight controller
   * @see MSP_SET_NAME
   */
  public async setName(name: string): Promise<void> {
    await this.sendMessage(MSPCodes.MSP_SET_NAME, composeSetName(name));
  }

  /**
   * Get the UID of the flight controller
   * @see MSP_UID
   * @example '3009386739576c95837562'
   */
  public async getUid(): Promise<string> {
    return parseUID(await this.sendMessage(MSPCodes.MSP_UID));
  }
}

export * from './codes';
export * from './msg';
