import { EventEmitter } from 'events';
import { SerialPort } from 'serialport';

import { MSPCodes } from './codes';
import {
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
  parseSonar,
  parseStatus,
  parseStatusEx,
  parseUID,
  parseVoltageMeterConfig,
  parseVoltageMeters,
} from './msg';
import { BuffDataView, buffToDataView, decodeMessage, encodeMessage, push16, push8 } from './utils';

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

  /**
   * Status
   */

  // MSP_STATUS
  public async getStatus(): Promise<MSPStatus> {
    return parseStatus(await this.sendMessage(MSPCodes.MSP_STATUS));
  }

  // MSP_STATUS_EX
  public async getStatusEx(): Promise<MSPStatusEx> {
    return parseStatusEx(await this.sendMessage(MSPCodes.MSP_STATUS_EX));
  }

  /**
   * IMU
   */

  // MSP_RAW_IMU
  public async getRawIMU(): Promise<MSPRawIMU> {
    return parseRawIMU(await this.sendMessage(MSPCodes.MSP_RAW_IMU));
  }

  /**
   * Servo
   */

  // MSP_SERVO
  public async getServo(): Promise<number[]> {
    return parseServo(await this.sendMessage(MSPCodes.MSP_SERVO));
  }

  // TODO: MSP_SERVO_MIX_RULES

  // TODO: MSP_SERVO_CONFIGURATIONS
  // TODO: MSP_SET_SERVO_CONFIGURATION

  /**
   * Motor
   */

  // MSP_MOTOR
  public async getMotor(): Promise<number[]> {
    return parseMotor(await this.sendMessage(MSPCodes.MSP_MOTOR));
  }

  // MSP_SET_MOTOR
  public async setMotor(motor: number[]): Promise<void> {
    let buffer: number[] = [];
    for (let i = 0; i < motor.length; i++) {
      buffer = push16(buffer, motor[1]);
    }
    await this.sendMessage(MSPCodes.MSP_SET_MOTOR, Buffer.from(buffer));
  }

  // MSP_MOTOR_CONFIG
  public async getMotorConfig(): Promise<MSPMotorConfig> {
    return parseMotorConfig(await this.sendMessage(MSPCodes.MSP_MOTOR_CONFIG));
  }

  // TODO: MSP_SET_MOTOR_CONFIG

  // MSP_MOTOR_TELEMETRY
  public async getMotorTelemetry(): Promise<MSPMotorTelemetry[]> {
    return parseMotorTelemetry(await this.sendMessage(MSPCodes.MSP_MOTOR_TELEMETRY));
  }

  // TODO: MSP2_MOTOR_OUTPUT_REORDERING
  // TODO: MSP2_SET_MOTOR_OUTPUT_REORDERING

  // TODO: MSP_MOTOR_3D_CONFIG
  // TODO: MSP_SET_MOTOR_3D_CONFIG

  /**
   * RC
   */

  // MSP_RC
  public async getRc(): Promise<number[]> {
    return parseRC(await this.sendMessage(MSPCodes.MSP_RC));
  }

  // TODO: MSP_SET_RAW_RC

  // TODO: MSP_RC_TUNING
  // TODO: MSP_SET_RC_TUNING

  // TODO: MSP_RC_DEADBAND
  // TODO: MSP_SET_RC_DEADBAND

  /**
   * GPS
   */

  // MSP_RAW_GPS
  public async getRawGPS(): Promise<MSPRawGPS> {
    return parseRawGPS(await this.sendMessage(MSPCodes.MSP_RAW_GPS));
  }

  // MSP_COMP_GPS
  public async getCompGPS(): Promise<MSPCompGps> {
    return parseCompGPS(await this.sendMessage(MSPCodes.MSP_COMP_GPS));
  }

  // TODO: MSP_GPS_CONFIG
  // TODO: MSP_SET_GPS_CONFIG

  // TODO: MSP_GPS_RESCUE
  // TODO: MSP_SET_GPS_RESCUE

  // TODO: MSP_GPS_SV_INFO

  /**
   * Compas
   */

  // TODO: MSP_COMPASS_CONFIG
  // TODO: MSP_SET_COMPASS_CONFIG

  /**
   * Attitude / Altitude / Sonar / Analog
   */

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

  /**
   * Voltage
   */

  // MSP_VOLTAGE_METERS
  public async getVoltageMeters(): Promise<MSPVoltageMeter[]> {
    return parseVoltageMeters(await this.sendMessage(MSPCodes.MSP_VOLTAGE_METERS));
  }

  // MSP_VOLTAGE_METER_CONFIG
  public async getVoltageMeterConfig(): Promise<MSPVoltageMeterConfig[]> {
    return parseVoltageMeterConfig(await this.sendMessage(MSPCodes.MSP_VOLTAGE_METER_CONFIG));
  }

  // MSP_SET_VOLTAGE_METER_CONFIG
  // Not used

  /**
   * Current
   */

  // MSP_CURRENT_METERS
  public async getCurrentMeters(): Promise<MSPCurrentMeter[]> {
    return parseCurrentMeters(await this.sendMessage(MSPCodes.MSP_CURRENT_METERS));
  }

  // MSP_CURRENT_METER_CONFIG
  public async getCurrentMeterConfig(): Promise<MSPCurrentMeterConfig[]> {
    return parseCurrentMeterConfig(await this.sendMessage(MSPCodes.MSP_CURRENT_METER_CONFIG));
  }

  // MSP_SET_CURRENT_METER_CONFIG
  // Not used

  /**
   * Batter
   */

  // MSP_BATTERY_STATE
  public async getBatteryState(): Promise<MSPBatteryState> {
    return parseBatteryState(await this.sendMessage(MSPCodes.MSP_BATTERY_STATE));
  }
  // MSP_BATTERY_CONFIG
  public async getBatteryConfig(): Promise<MSPBatteryConfig> {
    return parseBatteryConfig(await this.sendMessage(MSPCodes.MSP_BATTERY_CONFIG));
  }

  // TODO: MSP_SET_BATTERY_CONFIG

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

  /**
   * VTX
   */

  // TODO: MSP_VTX_CONFIG
  // TODO: MSP_SET_VTX_CONFIG

  // TODO: MSP_VTXTABLE_BAND
  // TODO: MSP_SET_VTXTABLE_BAND

  // TODO: MSP_VTXTABLE_POWERLEVEL
  // TODO: MSP_SET_VTXTABLE_POWERLEVEL

  // TODO: MSP2_GET_VTX_DEVICE_STATUS

  /**
   * LED
   */

  // TODO: MSP_LED_STRIP_CONFIG
  // TODO: MSP_SET_LED_STRIP_CONFIG

  // TODO: MSP_LED_COLORS
  // TODO: MSP_SET_LED_COLORS

  // TODO: MSP_LED_STRIP_MODECOLOR
  // TODO: MSP_SET_LED_STRIP_MODECOLOR

  // TODO: MSP2_SET_LED_STRIP_CONFIG_VALUES
  // TODO: MSP2_GET_LED_STRIP_CONFIG_VALUES

  /**
   * RX
   */

  // TODO: MSP_RX_CONFIG
  // TODO: MSP_SET_RX_CONFIG

  // TODO: MSP_RXFAIL_CONFIG
  // TODO: MSP_SET_RXFAIL_CONFIG

  // TODO: MSP_RX_MAP
  // TODO: MSP_SET_RX_MAP

  /**
   * Sensor
   */

  // TODO: MSP_SENSOR_CONFIG
  // TODO: MSP_SET_SENSOR_CONFIG

  // TODO: MSP_SENSOR_ALIGNMENT
  // TODO: MSP_SET_SENSOR_ALIGNMENT

  // TODO: MSP2_SENSOR_CONFIG_ACTIVE

  /**
   * PID
   */

  // TODO: MSP_PID
  // TODO: MSP_SET_PID

  // TODO: MSP_PID_ADVANCED
  // TODO: MSP_SET_PID_ADVANCED

  /**
   * Blackbox
   */

  // TODO: MSP_BLACKBOX_CONFIG
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
    const data = await this.sendMessage(MSPCodes.MSP2_GET_TEXT, Buffer.from([MSPCodes.PILOT_NAME]));
    const { type: textType, value } = parseGetText(data);
    return textType === MSPCodes.PILOT_NAME ? value : '';
  }

  async setPilotName(name: string): Promise<void> {
    const data = Buffer.from([MSPCodes.PILOT_NAME, name.length, ...name.split('').map((c) => c.charCodeAt(0))]);
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

  // TODO: MSP_MODE_RANGES
  // TODO: MSP_MODE_RANGES_EXTRA
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

  // MSP_BEEPER_CONFIG
  public async getBeeperConfig(): Promise<MSPBeeperConfig> {
    return parseBeeperConfig(await this.sendMessage(MSPCodes.MSP_BEEPER_CONFIG));
  }

  // TODO: MSP_SET_BEEPER_CONFIG

  // TODO: MSP_SET_REBOOT

  // MSP_NAME
  public async getName(): Promise<string> {
    return parseName(await this.sendMessage(MSPCodes.MSP_NAME));
  }

  // MSP_SET_NAME
  public async setName(name: string): Promise<void> {
    let buffer: number[] = [];
    const MSP_BUFFER_SIZE = 64;
    for (let i = 0; i < name.length && i < MSP_BUFFER_SIZE; i++) {
      buffer = push8(buffer, name.charCodeAt(i));
    }
    await this.sendMessage(MSPCodes.MSP_SET_NAME, Buffer.from(buffer));
  }

  // MPS_UID
  public async getUid(): Promise<string> {
    return parseUID(await this.sendMessage(MSPCodes.MSP_UID));
  }
}

export * from './codes';
export * from './msg';
