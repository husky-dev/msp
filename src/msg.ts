/**
 * Original doucmentation:
 * http://www.multiwii.com/wiki/index.php?title=Multiwii_Serial_Protocol
 * Betaflight extended documentation:
 * https://github.com/betaflight/betaflight/blob/master/src/main/msp/msp_protocol.h
 */
import { MSPCodes } from './codes';
import {
  API_VERSION_1_42,
  API_VERSION_1_43,
  API_VERSION_1_45,
  API_VERSION_1_46,
  API_VERSION_1_47,
  BuffDataView,
  buffToDataView,
  push8,
} from './utils';
import semver from 'semver';

export interface MSPStatus {
  /** Cycle time in milliseconds. Example: `20` */
  cycleTime: number;
  /** Number of I2C errors. Example: `0` */
  i2cError: number;
  /** Bitmask indicating active sensors. Example: `3` (gyro + accelerometer) */
  activeSensors: number;
  /** Current mode as a bitmask. Example: `1` (stabilized) */
  mode: number;
  /** Current profile index. Example: `1` */
  profile: number;
}

export const parseStatus = (data: BuffDataView): MSPStatus => ({
  cycleTime: data.readU16(),
  i2cError: data.readU16(),
  activeSensors: data.readU16(),
  mode: data.readU32(),
  profile: data.readU8(),
});

export interface MSPStatusEx {
  /** Cycle time in milliseconds. Example: `20` */
  cycleTime: number;
  /** Number of I2C errors. Example: `0` */
  i2cError: number;
  /** Bitmask indicating active sensors. Example: `3` (gyro + accelerometer) */
  activeSensors: number;
  /**
    Current mode as a bitmask. Example: `1` (stabilized) */
  mode: number;
  /** Current profile index. Example: `1` */
  profile: number;
  /** CPU load in percentage. Example: `15` */
  cpuload: number;
  /** Number of available profiles. Example: `3` */
  numProfiles: number;
  /** Current rate profile index. Example: `1` */
  rateProfile: number;
  /** Arming disable count. Example: `0` */
  armingDisableCount: number;
  /** Arming disable flags as a bitmask. Example: `1` (condition not met) */
  armingDisableFlags: number;
  /** Configuration state flag. Example: `1` (config changed) */
  configStateFlag: number;
  /** CPU temperature in degrees Celsius. Example: `40` */
  cpuTemp?: number;
}

export const parseStatusEx = (data: BuffDataView, apiVersion: string | undefined): MSPStatusEx => {
  const cycleTime = data.readU16();
  const i2cError = data.readU16();
  const activeSensors = data.readU16();
  const mode = data.readU32();
  const profile = data.readU8();
  const cpuload = data.readU16();
  const numProfiles = data.readU8();
  const rateProfile = data.readU8();

  // Read flight mode flags
  const byteCount = data.readU8();
  for (let i = 0; i < byteCount; i++) {
    data.readU8();
  }

  // Read arming disable flags
  const armingDisableCount = data.readU8(); // Flag count
  const armingDisableFlags = data.readU32();

  // Read config state flags - bits to indicate the state of the configuration, reboot required, etc.
  const configStateFlag = data.readU8();

  // Read CPU temp, from API version 1.46
  let cpuTemp;
  if (apiVersion && semver.gte(apiVersion, API_VERSION_1_46)) {
    cpuTemp = data.readU16();
  }

  return {
    cycleTime,
    i2cError,
    activeSensors,
    mode,
    profile,
    cpuload,
    numProfiles,
    rateProfile,
    armingDisableCount,
    armingDisableFlags,
    configStateFlag,
    cpuTemp,
  };
};

export interface MSPRawIMU {
  /** Accelerometer data as an array of XYZ values. Example: `[0.13720703125, -0.0546875, 0.20458984375]` */
  accelerometer: number[];
  /** Gyroscope data as an array of XYZ rotational values. Example: `[-0.48780487804878053, 0.7317073170731708, 0]` */
  gyroscope: number[];
  /** Magnetometer data as an array of XYZ magnetic field values. Example: `[0, 0, 0]` */
  magnetometer: number[];
}

export const parseRawIMU = (data: BuffDataView): MSPRawIMU => {
  // 2048 for mpu6050, 1024 for mma (times 4 since we don't scale in the firmware)
  // currently we are unable to differentiate between the sensor types, so we are going with 2048
  const accelerometer: number[] = [];
  accelerometer.push(data.read16() / 2048);
  accelerometer.push(data.read16() / 2048);
  accelerometer.push(data.read16() / 2048);

  // properly scaled
  const gyroscope: number[] = [];
  gyroscope.push(data.read16() * (4 / 16.4));
  gyroscope.push(data.read16() * (4 / 16.4));
  gyroscope.push(data.read16() * (4 / 16.4));

  // no clue about scaling factor
  const magnetometer: number[] = [];
  magnetometer.push(data.read16());
  magnetometer.push(data.read16());
  magnetometer.push(data.read16());

  return {
    accelerometer,
    gyroscope,
    magnetometer,
  };
};

export const parseServo = (data: BuffDataView) => {
  const servo: number[] = [];
  for (let i = 0; i < data.length() / 2; i++) {
    servo.push(data.readU16());
  }
  return servo;
};

export const parseMotor = (data: BuffDataView) => {
  const motor: number[] = [];
  for (let i = 0; i < data.length() / 2; i++) {
    motor.push(data.readU16());
  }
  return motor;
};

export interface MSPMotorTelemetry {
  /** Revolutions per minute of the motor. Example: `4500` */
  rpm: number;
  /** Percentage of invalid data packets. Example: `2` */
  invalidPercent: number;
  /** Motor temperature in degrees Celsius. Example: `35` */
  temperature: number;
  /** Motor voltage in volts. Example: `11.1` */
  voltage: number;
  /** Motor current in amperes. Example: `1.5` */
  current: number;
  /** Total power consumption in milliampere-hours. Example: `500` */
  consumption: number;
}

export const parseMotorTelemetry = (data: BuffDataView): MSPMotorTelemetry[] => {
  const motors: MSPMotorTelemetry[] = [];
  const telemMotorCount = data.readU8();
  for (let i = 0; i < telemMotorCount; i++) {
    motors.push({
      rpm: data.readU32(),
      invalidPercent: data.readU16(),
      temperature: data.readU8(),
      voltage: data.readU16(),
      current: data.readU16(),
      consumption: data.readU16(),
    });
  }
  return motors;
};

/**
 * Parses buffer data to extract remote control (RC) channel values.
 * @returns {number[]} An array of RC channel values.
 */
export const parseRC = (data: BuffDataView) => {
  const activeChannels = data.length() / 2;
  const channels = [];
  for (let i = 0; i < activeChannels; i++) {
    channels.push(data.readU16());
  }
  return channels;
};

export interface MSPRawGPS {
  /** GPS fix type. 0: No Fix, 1: 2D Fix, 2: 3D Fix. Example: `2` */
  fix: number;
  /** Number of satellites. Example: `8` */
  numSat: number;
  /** Latitude in decimal degrees. Example: `52.5200` */
  lat: number;
  /** Longitude in decimal degrees. Example: `13.4050` */
  lon: number;
  /** Altitude in meters. Example: `30` */
  alt: number;
  /** Speed in meters per second. Example: `1.5` */
  speed: number;
  /** Ground course in degrees. Example: `200` */
  groundCourse: number;
}

export const parseRawGPS = (data: BuffDataView): MSPRawGPS => ({
  fix: data.readU8(),
  numSat: data.readU8(),
  lat: data.read32(),
  lon: data.read32(),
  alt: data.readU16(),
  speed: data.readU16(),
  groundCourse: data.readU16(),
});

export interface MSPCompGPS {
  /** Distance to home point in meters. Example: `100` */
  distanceToHome: number;
  /** Direction to home point in degrees from North. Example: `270` (West) */
  directionToHome: number;
  /** Update status. 0: No update, 1: Updated. Example: `1` */
  update: number;
}

export const parseCompGPS = (data: BuffDataView): MSPCompGPS => ({
  distanceToHome: data.readU16(),
  directionToHome: data.readU16(),
  update: data.readU8(),
});

export const parseAttitude = (data: BuffDataView) => [
  data.read16() / 10, // Roll: Divides by 10 to convert to degrees.
  data.read16() / 10, // Pitch: Divides by 10 to convert to degrees.
  data.read16() / 10, // Yaw: Divides by 10 to convert to degrees.
];

export const parseAltitude = (data: BuffDataView) =>
  // Converts the 32-bit value to altitude in meters with correct scale factor.
  parseFloat((data.read32() / 100.0).toFixed(2));

export const parseSonar = (data: BuffDataView) => data.read32();

export interface MSPAnalog {
  /** Battery voltage in volts. Example: `11.1` */
  voltage: number;
  /** Total current consumption in milliampere-hours (mAh). Example: `1500` */
  mAhdrawn: number;
  /** Received Signal Strength Indicator (RSSI). Example: `75` */
  rssi: number;
  /** Current draw in amperes. Example: `15.5` */
  amperage: number;
}

export const parseAnalog = (data: BuffDataView): MSPAnalog => ({
  voltage: data.readU8() / 10.0,
  mAhdrawn: data.readU16(),
  rssi: data.readU16(), // 0-1023
  amperage: data.read16() / 100, // A
  // FC.ANALOG.voltage = data.readU16() / 100; ???
});

export interface MSPVoltageMeter {
  /** Identifier for the voltage meter. Example: `1` */
  id: number;
  /** Voltage reading from the meter in volts. Example: `11.1` */
  voltage: number;
}

export const parseVoltageMeters = (data: BuffDataView): MSPVoltageMeter[] => {
  const voltageMeters: MSPVoltageMeter[] = [];
  const voltageMeterLength = 2;
  for (let i = 0; i < data.length() / voltageMeterLength; i++) {
    const voltageMeter: MSPVoltageMeter = {
      id: data.readU8(),
      voltage: data.readU8() / 10.0,
    };
    voltageMeters.push(voltageMeter);
  }
  return voltageMeters;
};

export interface MSPCurrentMeter {
  /** Identifier for the current meter. Example: `1` */
  id: number;
  /** Total current consumption in milliampere-hours (mAh). Example: `1500` */
  mAhDrawn: number;
  /** Current draw in amperes. Example: `15.5` */
  amperage: number;
}

export const parseCurrentMeters = (data: BuffDataView) => {
  const currentMeters: MSPCurrentMeter[] = [];
  const currentMeterLength = 5;
  for (let i = 0; i < data.length() / currentMeterLength; i++) {
    currentMeters.push({
      id: data.readU8(),
      mAhDrawn: data.readU16(),
      amperage: data.readU16() / 1000,
    });
  }
  return currentMeters;
};

export interface MSPBatteryState {
  /** Number of cells in the battery. Example: `4` */
  cellCount: number;
  /** Total battery capacity in milliampere-hours (mAh). Example: `5000` */
  capacity: number;
  /** Current battery voltage in volts. Example: `14.8` */
  voltage: number;
  /** Total current consumed since start in milliampere-hours (mAh). Example: `1500` */
  mAhDrawn: number;
  /** Current draw in amperes. Example: `15.5` */
  amperage: number;
  /** Battery state indicator (e.g., 0 for low, 1 for good). Example: `1` */
  batteryState: number;
}

export const parseBatteryState = (data: BuffDataView): MSPBatteryState => ({
  cellCount: data.readU8(),
  capacity: data.readU16(),
  voltage: data.readU8() / 10.0,
  mAhDrawn: data.readU16(),
  amperage: data.readU16() / 100,
  batteryState: data.readU8(),
  // FC.BATTERY_STATE.voltage = data.readU16() / 100; ???
});

export interface MSPVoltageMeterConfig {
  /** Identifier for the voltage meter. Example: `1` */
  id: number;
  /** Type of sensor used for voltage measurement. Example: `0` (for a specific sensor type) */
  sensorType: number;
  /** Scale factor for voltage measurement. Example: `110` */
  vbatscale: number;
  /** Voltage meter resistance divider value. Example: `10` */
  vbatresdivval: number;
  /** Voltage meter resistance divider multiplier. Example: `1` */
  vbatresdivmultiplier: number;
}

export const parseVoltageMeterConfig = (data: BuffDataView): MSPVoltageMeterConfig[] => {
  const voltageMeterConfigs: MSPVoltageMeterConfig[] = [];
  const voltageMeterCount = data.readU8();

  for (let i = 0; i < voltageMeterCount; i++) {
    const subframeLength = data.readU8();
    if (subframeLength !== 5) {
      for (let j = 0; j < subframeLength; j++) {
        data.readU8();
      }
    } else {
      voltageMeterConfigs.push({
        id: data.readU8(),
        sensorType: data.readU8(),
        vbatscale: data.readU8(),
        vbatresdivval: data.readU8(),
        vbatresdivmultiplier: data.readU8(),
      });
    }
  }

  return voltageMeterConfigs;
};

export interface MSPCurrentMeterConfig {
  /** Identifier for the current meter. Example: `1` */
  id: number;
  /** Type of sensor used for current measurement. Example: `0` (for a specific sensor type) */
  sensorType: number;
  /** Scale factor for current measurement. Example: `400` */
  scale: number;
  /** Offset for current measurement calibration. Example: `0` */
  offset: number;
}

export const parseCurrentMeterConfig = (data: BuffDataView): MSPCurrentMeterConfig[] => {
  const currentMeterConfigs: MSPCurrentMeterConfig[] = [];
  const currentMeterCount = data.readU8();

  for (let i = 0; i < currentMeterCount; i++) {
    const subframeLength = data.readU8();

    if (subframeLength !== 6) {
      for (let j = 0; j < subframeLength; j++) {
        data.readU8();
      }
    } else {
      currentMeterConfigs.push({
        id: data.readU8(),
        sensorType: data.readU8(),
        scale: data.read16(),
        offset: data.read16(),
      });
    }
  }

  return currentMeterConfigs;
};

export interface MSPBatteryConfig {
  /** Minimum cell voltage for battery in volts. Example: `3.3` */
  vbatmincellvoltage: number;
  /** Maximum cell voltage for battery in volts. Example: `4.2` */
  vbatmaxcellvoltage: number;
  /** Warning cell voltage for battery in volts. Example: `3.5` */
  vbatwarningcellvoltage: number;
  /** Total battery capacity in milliampere-hours (mAh). Example: `5000` */
  capacity: number;
  /** Source for voltage measurement. Example: `1` (specific source type) */
  voltageMeterSource: number;
  /** Source for current measurement. Example: `1` (specific source type) */
  currentMeterSource: number;
}

export const parseBatteryConfig = (data: BuffDataView): MSPBatteryConfig => ({
  vbatmincellvoltage: data.readU8() / 10,
  vbatmaxcellvoltage: data.readU8() / 10,
  vbatwarningcellvoltage: data.readU8() / 10,
  capacity: data.readU16(),
  voltageMeterSource: data.readU8(),
  currentMeterSource: data.readU8(),
  // FC.BATTERY_CONFIG.vbatmincellvoltage = data.readU16() / 100; ???
  // FC.BATTERY_CONFIG.vbatmaxcellvoltage = data.readU16() / 100; ???
  // FC.BATTERY_CONFIG.vbatwarningcellvoltage = data.readU16() / 100; ???
});

export interface MSPMotorConfig {
  /** Minimum throttle value. Example: `1000` */
  minthrottle: number;
  /** Maximum throttle value. Example: `2000` */
  maxthrottle: number;
  /** Minimum command signal to send to ESCs. Example: `1000` */
  mincommand: number;
  /** Number of motors. Optional. Example: `4` */
  motorCount?: number;
  /** Number of poles in the motor. Optional. Example: `14` */
  motorPoles?: number;
  /** Flag to use Dshot telemetry. Optional. Example: `true` for use, `false` for not use */
  useDshotTelemetry?: boolean;
  /** Flag to use ESC sensor. Optional. Example: `true` for use, `false` for not use */
  useEscSensor?: boolean;
}

export const parseMotorConfig = (data: BuffDataView, apiVersion: string | undefined): MSPMotorConfig => {
  const msg: MSPMotorConfig = {
    minthrottle: data.readU16(),
    maxthrottle: data.readU16(),
    mincommand: data.readU16(),
  };
  msg.motorCount = data.readU8();
  msg.motorPoles = data.readU8();
  msg.useDshotTelemetry = data.readU8() !== 0;
  msg.useEscSensor = data.readU8() !== 0;
  if (apiVersion && semver.gte(apiVersion, API_VERSION_1_42)) {
    msg.motorCount = data.readU8();
    msg.motorPoles = data.readU8();
    msg.useDshotTelemetry = data.readU8() != 0;
    msg.useEscSensor = data.readU8() != 0;
  }
  return msg;
};

export interface MSPApiVersion {
  /** MSP protocol version number. Example: `2` */
  mspProtocolVersion: number;
  /** API version as a string. Example: `"1.40"` */
  apiVersion: string;
}

export const parseApiVersion = (data: BuffDataView): MSPApiVersion => ({
  mspProtocolVersion: data.readU8(),
  apiVersion: `${data.readU8()}.${data.readU8()}.0`,
});

export const parseFcVariant = (data: BuffDataView) => {
  let fcVariantIdentifier = '';
  for (let i = 0; i < 4; i++) {
    fcVariantIdentifier += String.fromCharCode(data.readU8());
  }
  return fcVariantIdentifier;
};

export const parseFcVersion = (data: BuffDataView) => `${data.readU8()}.${data.readU8()}.${data.readU8()}`;

export const parseBuildInfo = (data: BuffDataView) => {
  const dateLength = 11;
  const buff: number[] = [];

  for (let i = 0; i < dateLength; i++) {
    buff.push(data.readU8());
  }
  buff.push(32); // ascii space

  const timeLength = 8;
  for (let i = 0; i < timeLength; i++) {
    buff.push(data.readU8());
  }

  return String.fromCharCode.apply(null, buff);
};

export interface MSPBoardInfo {
  /** Unique identifier for the board. Example: `"AFNA"` */
  boardIdentifier: string;
  /** Board version number. Example: `3` */
  boardVersion: number;
  /** Type of the board. Example: `1` (specific type) */
  boardType: number;
  /** Bitmask of the target's capabilities. Example: `0b10101` */
  targetCapabilities: number;
  /** Name of the target. Example: `"Naze32"` */
  targetName: string;
  /** Name of the board. Example: `"SP Racing F3"` */
  boardName: string;
  /** Manufacturer ID. Example: `"ABCD"` */
  manufacturerId: string;
  /** Signature as an array of numbers. Example: `[1, 2, 3, 4, 5]` */
  signature: number[];
  /** MCU type ID. Example: `1` (specific MCU type) */
  mcuTypeId: number;
  /** Configuration state. Example: `1` (config changed) */
  configurationState?: number;
  /** Sample rate in Hz. Example: `1000` */
  sampleRateHz?: number;
  /** Configuration problems. Example: `0` */
  configurationProblems?: number;
}

export const parseBoardInfo = (data: BuffDataView, apiVersion: string | undefined): MSPBoardInfo => {
  const SIGNATURE_LENGTH = 32;

  let boardIdentifier: string = '';
  for (let i = 0; i < 4; i++) {
    boardIdentifier += String.fromCharCode(data.readU8());
  }
  const boardVersion = data.readU16();
  const boardType = data.readU8();

  const targetCapabilities = data.readU8();
  const targetName = data.readText();

  const boardName = data.readText();
  const manufacturerId = data.readText();

  const signature: number[] = [];
  for (let i = 0; i < SIGNATURE_LENGTH; i++) {
    signature.push(data.readU8());
  }

  const mcuTypeId = data.readU8();

  let configurationState;
  if (apiVersion && semver.gte(apiVersion, API_VERSION_1_42)) {
    configurationState = data.readU8();
  }

  let sampleRateHz;
  let configurationProblems;
  if (apiVersion && semver.gte(apiVersion, API_VERSION_1_43)) {
    sampleRateHz = data.readU16();
    configurationProblems = data.readU32();
  } else {
    configurationProblems = 0;
  }

  return {
    boardIdentifier,
    boardVersion,
    boardType,
    targetCapabilities,
    targetName,
    boardName,
    manufacturerId,
    signature,
    mcuTypeId,
    configurationState,
    sampleRateHz,
    configurationProblems,
  };
};

export const parseName = (data: BuffDataView) => {
  let value: string = '';
  let char: number | null;
  for (let i = 0; i < data.length(); i++) {
    char = data.readU8();
    if (char === 0) {
      break;
    }
    value += String.fromCharCode(char);
  }
  return value;
};

export const composeSetName = (name: string) => {
  let buffer: number[] = [];
  const MSP_BUFFER_SIZE = 64;
  for (let i = 0; i < name.length && i < MSP_BUFFER_SIZE; i++) {
    buffer = push8(buffer, name.charCodeAt(i));
  }
  return Buffer.from(buffer);
};

export const parseUID = (data: BuffDataView): string => {
  const uid: number[] = [0, 0, 0];
  uid[0] = data.readU32();
  uid[1] = data.readU32();
  uid[2] = data.readU32();
  return uid[0].toString(16) + uid[1].toString(16) + uid[2].toString(16);
};

export const parseGetText = (data: BuffDataView) => {
  const textType = data.readU8();
  const value = data.readText();
  return { type: textType, value };
};

export interface MSPBeeperConfig {
  /** Disabled mask for beepers. Example: `0b101010` */
  disabledMask: number;
  /** Dshot beacon tone. Example: `1` */
  dshotBeaconTone: number;
  /** Disabled mask for dshot beacon conditions. Example: `0b1100` */
  dshotBeaconConditionsMask: number;
}

export const parseBeeperConfig = (data: BuffDataView): MSPBeeperConfig => ({
  disabledMask: data.readU32(),
  dshotBeaconTone: data.readU8(),
  dshotBeaconConditionsMask: data.readU32(),
});

export interface MSPServoConfiguration {
  min: number;
  max: number;
  middle: number;
  rate: number;
  indexOfChannelToForward: number;
  reversedInputSources: number;
}

export const parseServoConfigurations = (data: BuffDataView): MSPServoConfiguration[] => {
  const servoConfigurations: MSPServoConfiguration[] = [];

  if (data.length() % 12 === 0) {
    for (let i = 0; i < data.length(); i += 12) {
      const servoConfiguration: MSPServoConfiguration = {
        min: data.readU16(),
        max: data.readU16(),
        middle: data.readU16(),
        rate: data.read8(),
        indexOfChannelToForward: data.readU8(),
        reversedInputSources: data.readU32(),
      };

      servoConfigurations.push(servoConfiguration);
    }
  }

  return servoConfigurations;
};

export interface MSPModeRange {
  id: number;
  auxChannelIndex: number;
  range: {
    start: number;
    end: number;
  };
}

// MSP_MODE_RANGES
export const parseModeRanges = (data: BuffDataView): MSPModeRange[] => {
  const modeRanges: MSPModeRange[] = [];
  const modeRangeCount = data.length() / 4; // 4 bytes per item.
  for (let i = 0; i < modeRangeCount; i++) {
    const modeRange: MSPModeRange = {
      id: data.readU8(),
      auxChannelIndex: data.readU8(),
      range: {
        start: 900 + data.readU8() * 25,
        end: 900 + data.readU8() * 25,
      },
    };
    modeRanges.push(modeRange);
  }
  return modeRanges;
};

export interface MSPModeRangeExtra {
  /** Identifier for the mode range. Example: `1` */
  id: number;
  /** Logic for the mode. Example: `0` (specific logic type) */
  modeLogic: number;
  /** Linked mode identifier. Example: `2` */
  linkedTo: number;
}

export const parseModeRangesExtra = (data: BuffDataView): MSPModeRangeExtra[] => {
  const modeRangesExtra: MSPModeRangeExtra[] = [];
  const modeRangeExtraCount = data.readU8();
  for (let i = 0; i < modeRangeExtraCount; i++) {
    const modeRangeExtra: MSPModeRangeExtra = {
      id: data.readU8(),
      modeLogic: data.readU8(),
      linkedTo: data.readU8(),
    };
    modeRangesExtra.push(modeRangeExtra);
  }
  return modeRangesExtra;
};

export interface MSPMotor3DConfig {
  /** Low deadband value for 3D mode. Example: `1000` */
  deadband3dLow: number;
  /** High deadband value for 3D mode. Example: `2000` */
  deadband3dHigh: number;
  /** Neutral value for 3D mode. Example: `1500` */
  neutral: number;
}

// MSP_MOTOR_3D_CONFIG
export const parseMotor3DConfig = (data: BuffDataView): MSPMotor3DConfig => ({
  deadband3dLow: data.readU16(),
  deadband3dHigh: data.readU16(),
  neutral: data.readU16(),
});

export interface MSPRcDeadbandConfig {
  deadband: number;
  yawDeadband: number;
  altHoldDeadband: number;
  deadband3dThrottle: number;
}

// MSP_RC_DEADBAND
export const parseRcDeadbandConfig = (data: BuffDataView): MSPRcDeadbandConfig => ({
  deadband: data.readU8(),
  yawDeadband: data.readU8(),
  altHoldDeadband: data.readU8(),
  deadband3dThrottle: data.readU16(),
});

export interface MSPGpsConfig {
  provider: number;
  ubloxSbas: number;
  autoConfig: number;
  autoBaud: number;
  homePointOnce?: number;
  ubloxUseGalileo?: number;
}

// MSP_GPS_CONFIG
export const parseGpsConfig = (data: BuffDataView): MSPGpsConfig => {
  const gpsConfig: MSPGpsConfig = {
    provider: data.readU8(),
    ubloxSbas: data.readU8(),
    autoConfig: data.readU8(),
    autoBaud: data.readU8(),
  };
  // Introduced in API version 1.43
  gpsConfig.homePointOnce = data.readU8();
  gpsConfig.ubloxUseGalileo = data.readU8();

  return gpsConfig;
};

export interface MSPGpsRescueConfig {
  angle: number;
  returnAltitudeM: number;
  descentDistanceM: number;
  groundSpeed: number;
  throttleMin: number;
  throttleMax: number;
  throttleHover: number;
  sanityChecks: number;
  minSats: number;
  ascendRate?: number;
  descendRate?: number;
  allowArmingWithoutFix?: number;
  altitudeMode?: number;
  minStartDistM?: number;
  initialClimbM?: number;
}

// MSP_GPS_RESCUE
export const parseGpsRescue = (data: BuffDataView): MSPGpsRescueConfig => {
  const gpsRescueConfig: MSPGpsRescueConfig = {
    angle: data.readU16(),
    returnAltitudeM: data.readU16(),
    descentDistanceM: data.readU16(),
    groundSpeed: data.readU16(),
    throttleMin: data.readU16(),
    throttleMax: data.readU16(),
    throttleHover: data.readU16(),
    sanityChecks: data.readU8(),
    minSats: data.readU8(),
  };

  // Introduced in API version 1.43
  gpsRescueConfig.ascendRate = data.readU16();
  gpsRescueConfig.descendRate = data.readU16();
  gpsRescueConfig.allowArmingWithoutFix = data.readU8();
  gpsRescueConfig.altitudeMode = data.readU8();

  // Introduced in API version 1.44
  gpsRescueConfig.minStartDistM = data.readU16();

  // Introduced in API version 1.46
  gpsRescueConfig.initialClimbM = data.readU16();

  return gpsRescueConfig;
};

export interface MSPGpsSvInfo {
  /** Number of channels. Example: `12` */
  numCh: number;
  /** Array of channel numbers. Example: `[1, 2, 3, ...]` */
  chn: number[];
  /** Array of satellite IDs. Example: `[1, 2, 3, ...]` */
  svid: number[];
  /** Array of quality indicators. Example: `[1, 2, 3, ...]` */
  quality: number[];
  /** Array of carrier-to-noise ratios. Example: `[1, 2, 3, ...]` */
  cno: number[];
}

// MSP_GPS_SV_INFO
export const parseGpsSvInfo = (data: BuffDataView): MSPGpsSvInfo => {
  const numCh = data.readU8();
  const chn: number[] = [];
  const svid: number[] = [];
  const quality: number[] = [];
  const cno: number[] = [];

  for (let i = 0; i < numCh; i++) {
    chn.push(data.readU8());
    svid.push(data.readU8());
    quality.push(data.readU8());
    cno.push(data.readU8());
  }

  return {
    numCh,
    chn,
    svid,
    quality,
    cno,
  };
};

export interface MSPVtxConfig {
  vtxType: number;
  vtxBand: number;
  vtxChannel: number;
  vtxPower: number;
  vtxPitMode: boolean;
  vtxFrequency: number;
  vtxDeviceReady: boolean;
  vtxLowPowerDisarm: number;
  vtxPitModeFrequency?: number;
  vtxTableAvailable?: boolean;
  vtxTableBands?: number;
  vtxTableChannels?: number;
  vtxTablePowerLevels?: number;
  vtxTableClear?: boolean;
}

// MSP_VTX_CONFIG
export const parseVtxConfig = (data: BuffDataView): MSPVtxConfig => {
  const vtxConfig: MSPVtxConfig = {
    vtxType: data.readU8(),
    vtxBand: data.readU8(),
    vtxChannel: data.readU8(),
    vtxPower: data.readU8(),
    vtxPitMode: data.readU8() !== 0,
    vtxFrequency: data.readU16(),
    vtxDeviceReady: data.readU8() !== 0,
    vtxLowPowerDisarm: data.readU8(),
  };

  // Introduced in API version 1.42
  vtxConfig.vtxPitModeFrequency = data.readU16();
  vtxConfig.vtxTableAvailable = data.readU8() !== 0;
  vtxConfig.vtxTableBands = data.readU8();
  vtxConfig.vtxTableChannels = data.readU8();
  vtxConfig.vtxTablePowerLevels = data.readU8();
  vtxConfig.vtxTableClear = false;

  return vtxConfig;
};

export interface MSPVtxTableBand {
  vtxTableBandNumber: number;
  vtxTableBandName: string;
  vtxTableBandLetter: string;
  vtxTableBandIsFactoryBand: boolean;
  vtxTableBandFrequencies: number[];
}

// MSP_VTXTABLE_BAND
export const parseVtxTableBand = (data: BuffDataView): MSPVtxTableBand => {
  const vtxTableBandNumber = data.readU8();

  const bandNameLength = data.readU8();
  let vtxTableBandName = '';
  for (let i = 0; i < bandNameLength; i++) {
    vtxTableBandName += String.fromCharCode(data.readU8());
  }

  const vtxTableBandLetter = String.fromCharCode(data.readU8());
  const vtxTableBandIsFactoryBand = data.readU8() !== 0;

  const bandFrequenciesLength = data.readU8();
  const vtxTableBandFrequencies: number[] = [];
  for (let i = 0; i < bandFrequenciesLength; i++) {
    vtxTableBandFrequencies.push(data.readU16());
  }

  return {
    vtxTableBandNumber,
    vtxTableBandName,
    vtxTableBandLetter,
    vtxTableBandIsFactoryBand,
    vtxTableBandFrequencies,
  };
};

export interface MSPVtxTablePowerLevel {
  vtxTablePowerLevelNumber: number;
  vtxTablePowerLevelValue: number;
  vtxTablePowerLevelLabel: string;
}

// MSP_VTXTABLE_POWERLEVEL
export const parseVtxTablePowerLevel = (data: BuffDataView): MSPVtxTablePowerLevel => {
  const vtxTablePowerLevelNumber = data.readU8();
  const vtxTablePowerLevelValue = data.readU16();

  const powerLabelLength = data.readU8();
  let vtxTablePowerLevelLabel = '';
  for (let i = 0; i < powerLabelLength; i++) {
    vtxTablePowerLevelLabel += String.fromCharCode(data.readU8());
  }

  return {
    vtxTablePowerLevelNumber,
    vtxTablePowerLevelValue,
    vtxTablePowerLevelLabel,
  };
};

export interface MSPLedColor {
  h: number;
  s: number;
  v: number;
}

// MSP_LED_COLORS
export const parseLedColors = (data: BuffDataView): MSPLedColor[] => {
  const ledColors: MSPLedColor[] = [];
  const ledColorCount = data.length() / 4;

  for (let i = 0; i < ledColorCount; i++) {
    const color: MSPLedColor = {
      h: data.readU16(),
      s: data.readU8(),
      v: data.readU8(),
    };
    ledColors.push(color);
  }

  return ledColors;
};

export interface MSPLedStripModeColor {
  mode: number;
  direction: number;
  color: number;
}

// MSP_LED_STRIP_MODECOLOR
export const parseLedStripModeColor = (data: BuffDataView): MSPLedStripModeColor[] => {
  const ledStripModeColors: MSPLedStripModeColor[] = [];
  const colorCount = data.length() / 3;

  for (let i = 0; i < colorCount; i++) {
    const modeColor: MSPLedStripModeColor = {
      mode: data.readU8(),
      direction: data.readU8(),
      color: data.readU8(),
    };
    ledStripModeColors.push(modeColor);
  }

  return ledStripModeColors;
};

export interface MSPRxFailConfig {
  mode: number;
  value: number;
}

// MSP_RXFAIL_CONFIG
export const parseRxFailConfig = (data: BuffDataView): MSPRxFailConfig[] => {
  const rxFailConfig: MSPRxFailConfig[] = [];
  const channelCount = data.length() / 3;

  for (let i = 0; i < channelCount; i++) {
    const rxfailChannel: MSPRxFailConfig = {
      mode: data.readU8(),
      value: data.readU16(),
    };
    rxFailConfig.push(rxfailChannel);
  }

  return rxFailConfig;
};

// MSP_RX_MAP
export const parseRxMap = (data: BuffDataView): number[] => {
  const rcMap: number[] = [];
  for (let i = 0; i < data.length(); i++) {
    rcMap.push(data.readU8());
  }
  return rcMap;
};

export interface MSPSensorConfig {
  accHardware: number;
  baroHardware: number;
  magHardware: number;
  sonarHardware?: number;
}

// MSP_SENSOR_CONFIG
export const parseSensorConfig = (data: BuffDataView, apiVersion: string | undefined): MSPSensorConfig => {
  const sensorConfig: MSPSensorConfig = {
    accHardware: data.readU8(),
    baroHardware: data.readU8(),
    magHardware: data.readU8(),
  };

  // Introduced in API version 1.46
  if (apiVersion && semver.gte(apiVersion, API_VERSION_1_46)) {
    sensorConfig.sonarHardware = data.readU8();
  }

  return sensorConfig;
};

export interface MSPSensorAlignment {
  alignGyro: number;
  alignAcc: number;
  alignMag: number;
  gyroDetectionFlags: number;
  gyroToUse: number;
  gyro1Align: number;
  gyro2Align: number;
  gyroAlignRoll?: number;
  gyroAlignPitch?: number;
  gyroAlignYaw?: number;
  magAlignRoll?: number;
  magAlignPitch?: number;
  magAlignYaw?: number;
}

// MSP_SENSOR_ALIGNMENT
export const parseSensorAlignment = (data: BuffDataView, apiVersion: string | undefined): MSPSensorAlignment => {
  const sensorAlignment: MSPSensorAlignment = {
    alignGyro: data.readU8(),
    alignAcc: data.readU8(),
    alignMag: data.readU8(),
    gyroDetectionFlags: data.readU8(),
    gyroToUse: data.readU8(),
    gyro1Align: data.readU8(),
    gyro2Align: data.readU8(),
  };

  // Introduced in API version 1.47
  if (apiVersion && semver.gte(apiVersion, API_VERSION_1_47)) {
    sensorAlignment.gyroAlignRoll = data.read16() / 10;
    sensorAlignment.gyroAlignPitch = data.read16() / 10;
    sensorAlignment.gyroAlignYaw = data.read16() / 10;
    sensorAlignment.magAlignRoll = data.read16() / 10;
    sensorAlignment.magAlignPitch = data.read16() / 10;
    sensorAlignment.magAlignYaw = data.read16() / 10;
  }

  return sensorAlignment;
};

export interface MSPPid {
  p: number;
  i: number;
  d: number;
}

// MSP_PID
export const parsePid = (data: BuffDataView): MSPPid[] => {
  const pids: MSPPid[] = [];
  const pidCount = data.length() / 3;

  for (let i = 0; i < pidCount; i++) {
    const pid: MSPPid = {
      p: data.readU8(),
      i: data.readU8(),
      d: data.readU8(),
    };
    pids.push(pid);
  }

  return pids;
};

export interface MSPBlackboxConfig {
  supported: boolean;
  blackboxDevice: number;
  blackboxRateNum: number;
  blackboxRateDenom: number;
  blackboxPDenom: number;
  blackboxSampleRate?: number;
  blackboxDisabledMask?: number;
}

// MSP_BLACKBOX_CONFIG
export const parseBlackboxConfig = (data: BuffDataView, apiVersion: string | undefined): MSPBlackboxConfig => {
  const blackboxConfig: MSPBlackboxConfig = {
    supported: (data.readU8() & 1) !== 0,
    blackboxDevice: data.readU8(),
    blackboxRateNum: data.readU8(),
    blackboxRateDenom: data.readU8(),
    blackboxPDenom: data.readU16(),
  };

  // Introduced in API version 1.44
  blackboxConfig.blackboxSampleRate = data.readU8();

  // Introduced in API version 1.45
  if (apiVersion && semver.gte(apiVersion, API_VERSION_1_45)) {
    blackboxConfig.blackboxDisabledMask = data.readU32();
  }

  return blackboxConfig;
};

export interface MSPOsdCanvas {
  videoColsHD: number;
  videoRowsHD: number;
  videoBufferCharsHD: number;
}

// MSP_OSD_CANVAS
export const parseOsdCanvas = (data: BuffDataView): MSPOsdCanvas => {
  const videoColsHD = data.readU8();
  const videoRowsHD = data.readU8();
  const videoBufferCharsHD = videoColsHD * videoRowsHD;

  return {
    videoColsHD,
    videoRowsHD,
    videoBufferCharsHD,
  };
};

// TODO: MSP_RC_TUNING
// TODO: MSP_COMPASS_CONFIG
// TODO: MSP_LED_STRIP_CONFIG
// TODO: MSP_RX_CONFIG
// TODO: MSP_PID_ADVANCED

// TODO: PILOT_NAME
// TODO: CRAFT_NAME
// TODO: PID_PROFILE_NAME
// TODO: RATE_PROFILE_NAME
// TODO: BUILD_KEY
// TODO: MSP_ADJUSTMENT_RANGES
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
// TODO: MSP_RSSI_CONFIG
// TODO: MSP_ADVANCED_CONFIG
// TODO: MSP_FILTER_CONFIG
// TODO: MSP_FAILSAFE_CONFIG
// TODO: MSP_CF_SERIAL_CONFIG
// TODO: MSP_TRANSPONDER_CONFIG
// TODO: MSP_SIMPLIFIED_TUNING
// TODO: MSP_VALIDATE_SIMPLIFIED_TUNING
// TODO: MSP_BOARD_ALIGNMENT_CONFIG
// TODO: MSP_PID_CONTROLLER
// TODO: MSP_LOOP_TIME
// TODO: MSP_ARMING_CONFIG
// TODO: MSP_ARMING_DISABLE
// TODO: MSP_MIXER_CONFIG
// TODO: MSP_ACC_TRIM
// TODO: MSP_FEATURE_CONFIG

// Setters (will do later):
// TODO: MSP_SET_SERVO_CONFIGURATION
// TODO: MSP_SET_MOTOR_CONFIG
// TODO: MSP_SET_MOTOR_3D_CONFIG
// TODO: MSP_SET_RAW_RC
// TODO: MSP_SET_RC_TUNING
// TODO: MSP_SET_RC_DEADBAND
// TODO: MSP_SET_GPS_CONFIG
// TODO: MSP_SET_GPS_RESCUE
// TODO: MSP_SET_COMPASS_CONFIG
// TODO: MSP_SET_BATTERY_CONFIG
// TODO: MSP_SET_VTX_CONFIG
// TODO: MSP_SET_VTXTABLE_BAND
// TODO: MSP_SET_VTXTABLE_POWERLEVEL
// TODO: MSP_SET_LED_STRIP_CONFIG
// TODO: MSP_SET_LED_COLORS
// TODO: MSP_SET_LED_STRIP_MODECOLOR
// TODO: MSP_SET_RX_CONFIG
// TODO: MSP_SET_RXFAIL_CONFIG
// TODO: MSP_SET_RX_MAP
// TODO: MSP_SET_SENSOR_CONFIG
// TODO: MSP_SET_SENSOR_ALIGNMENT
// TODO: MSP_SET_PID
// TODO: MSP_SET_PID_ADVANCED
// TODO: MSP_SET_BLACKBOX_CONFIG
// TODO: MSP_SET_OSD_CANVAS
// TODO: MSP_SET_OSD_CONFIG
// TODO: MSP_SET_CHANNEL_FORWARDING
// TODO: MSP_SET_MODE_RANGE
// TODO: MSP_SET_ADJUSTMENT_RANGE
// TODO: MSP_SET_RTC
// TODO: MSP_SET_RESET_CURR_PID
// TODO: MSP_SET_RSSI_CONFIG
// TODO: MSP_SET_ADVANCED_CONFIG
// TODO: MSP_SET_FILTER_CONFIG
// TODO: MSP_SET_FAILSAFE_CONFIG
// TODO: MSP_SET_CF_SERIAL_CONFIG
// TODO: MSP_SET_TRANSPONDER_CONFIG
// TODO: MSP_SET_SIMPLIFIED_TUNING
// TODO: MSP_SET_BOARD_ALIGNMENT_CONFIG
// TODO: MSP_SET_PID_CONTROLLER
// TODO: MSP_SET_LOOP_TIME
// TODO: MSP_SET_ARMING_CONFIG
// TODO: MSP_SET_MIXER_CONFIG
// TODO: MSP_SET_ACC_TRIM
// TODO: MSP_SET_FEATURE_CONFIG
// TODO: MSP_SET_BEEPER_CONFIG
// TODO: MSP_SET_REBOOT

// MSP2
// TODO: MSP2_MOTOR_OUTPUT_REORDERING
// TODO: MSP2_SET_MOTOR_OUTPUT_REORDERING
// TODO: MSP2_SENSOR_CONFIG_ACTIVE
// TODO: MSP2_GET_TEXT
// TODO: MSP2_SET_TEXT
// TODO: MSP2_SEND_DSHOT_COMMAND
// TODO: MSP2_COMMON_SERIAL_CONFIG
// TODO: MSP2_COMMON_SET_SERIAL_CONFIG
// TODO: MSP2_GET_VTX_DEVICE_STATUS
// TODO: MSP2_SET_LED_STRIP_CONFIG_VALUES
// TODO: MSP2_GET_LED_STRIP_CONFIG_VALUES

// Not documented:
// TODO: MSP_SERVO_MIX_RULES
// TODO: MSP_OSD_CONFIG
// TODO: MSP_OSD_CHAR_READ
// TODO: MSP_OSD_CHAR_WRITE

interface MSPMsgBase<C extends number> {
  code: C;
}

interface MSPMsgWithPayload<C extends number, P> extends MSPMsgBase<C> {
  payload: P;
}

export type MSPMsg =
  | MSPMsgWithPayload<MSPCodes.MSP_STATUS, MSPStatus>
  | MSPMsgWithPayload<MSPCodes.MSP_STATUS_EX, MSPStatusEx>
  | MSPMsgWithPayload<MSPCodes.MSP_RAW_IMU, MSPRawIMU>
  | MSPMsgWithPayload<MSPCodes.MSP_SERVO, number[]>
  | MSPMsgWithPayload<MSPCodes.MSP_SERVO_CONFIGURATIONS, MSPServoConfiguration[]>
  | MSPMsgWithPayload<MSPCodes.MSP_MOTOR, number[]>
  | MSPMsgWithPayload<MSPCodes.MSP_MOTOR_TELEMETRY, MSPMotorTelemetry[]>
  | MSPMsgWithPayload<MSPCodes.MSP_RC, number[]>
  | MSPMsgWithPayload<MSPCodes.MSP_RAW_GPS, MSPRawGPS>
  | MSPMsgWithPayload<MSPCodes.MSP_COMP_GPS, MSPCompGPS>
  | MSPMsgWithPayload<MSPCodes.MSP_ATTITUDE, number[]>
  | MSPMsgWithPayload<MSPCodes.MSP_ALTITUDE, number>
  | MSPMsgWithPayload<MSPCodes.MSP_SONAR, number>
  | MSPMsgWithPayload<MSPCodes.MSP_ANALOG, MSPAnalog>
  | MSPMsgWithPayload<MSPCodes.MSP_VOLTAGE_METERS, MSPVoltageMeter[]>
  | MSPMsgWithPayload<MSPCodes.MSP_CURRENT_METERS, MSPCurrentMeter[]>
  | MSPMsgWithPayload<MSPCodes.MSP_BATTERY_STATE, MSPBatteryState>
  | MSPMsgWithPayload<MSPCodes.MSP_VOLTAGE_METER_CONFIG, MSPVoltageMeterConfig[]>
  | MSPMsgWithPayload<MSPCodes.MSP_CURRENT_METER_CONFIG, MSPCurrentMeterConfig[]>
  | MSPMsgWithPayload<MSPCodes.MSP_BATTERY_CONFIG, MSPBatteryConfig>
  | MSPMsgBase<MSPCodes.MSP_SET_BATTERY_CONFIG>
  | MSPMsgWithPayload<MSPCodes.MSP_MOTOR_CONFIG, MSPMotorConfig>
  | MSPMsgBase<MSPCodes.MSP_DISPLAYPORT>
  | MSPMsgBase<MSPCodes.MSP_SET_RAW_RC>
  | MSPMsgBase<MSPCodes.MSP_SET_PID>
  | MSPMsgBase<MSPCodes.MSP_SET_RC_TUNING>
  | MSPMsgBase<MSPCodes.MSP_ACC_CALIBRATION>
  | MSPMsgBase<MSPCodes.MSP_MAG_CALIBRATION>
  | MSPMsgBase<MSPCodes.MSP_SET_MOTOR_CONFIG>
  | MSPMsgBase<MSPCodes.MSP_SET_GPS_CONFIG>
  | MSPMsgBase<MSPCodes.MSP_SET_GPS_RESCUE>
  | MSPMsgBase<MSPCodes.MSP_SET_RSSI_CONFIG>
  | MSPMsgBase<MSPCodes.MSP_SET_FEATURE_CONFIG>
  | MSPMsgBase<MSPCodes.MSP_SET_BEEPER_CONFIG>
  | MSPMsgBase<MSPCodes.MSP_RESET_CONF>
  | MSPMsgBase<MSPCodes.MSP_SELECT_SETTING>
  | MSPMsgBase<MSPCodes.MSP_SET_SERVO_CONFIGURATION>
  | MSPMsgBase<MSPCodes.MSP_EEPROM_WRITE>
  | MSPMsgBase<MSPCodes.MSP_SET_CURRENT_METER_CONFIG>
  | MSPMsgBase<MSPCodes.MSP_SET_VOLTAGE_METER_CONFIG>
  | MSPMsgBase<MSPCodes.MSP_SET_MOTOR>
  | MSPMsgBase<MSPCodes.MSP_SET_VTXTABLE_POWERLEVEL>
  | MSPMsgBase<MSPCodes.MSP_SET_MODE_RANGE>
  | MSPMsgBase<MSPCodes.MSP_SET_ADJUSTMENT_RANGE>
  | MSPMsgBase<MSPCodes.MSP_SET_BOARD_ALIGNMENT_CONFIG>
  | MSPMsgBase<MSPCodes.MSP_PID_CONTROLLER>
  | MSPMsgBase<MSPCodes.MSP_SET_PID_CONTROLLER>
  | MSPMsgBase<MSPCodes.MSP_SET_LOOP_TIME>
  | MSPMsgBase<MSPCodes.MSP_SET_ARMING_CONFIG>
  | MSPMsgBase<MSPCodes.MSP_SET_RESET_CURR_PID>
  | MSPMsgBase<MSPCodes.MSP_SET_MOTOR_3D_CONFIG>
  | MSPMsgBase<MSPCodes.MSP_SET_MIXER_CONFIG>
  | MSPMsgBase<MSPCodes.MSP_SET_RC_DEADBAND>
  | MSPMsgBase<MSPCodes.MSP_SET_SENSOR_ALIGNMENT>
  | MSPMsgBase<MSPCodes.MSP_SET_RX_CONFIG>
  | MSPMsgBase<MSPCodes.MSP_SET_RXFAIL_CONFIG>
  | MSPMsgBase<MSPCodes.MSP_SET_FAILSAFE_CONFIG>
  | MSPMsgBase<MSPCodes.MSP_SET_NAME>
  | MSPMsgWithPayload<MSPCodes.MSP_API_VERSION, MSPApiVersion>
  | MSPMsgWithPayload<MSPCodes.MSP_FC_VARIANT, string>
  | MSPMsgWithPayload<MSPCodes.MSP_FC_VERSION, string>
  | MSPMsgWithPayload<MSPCodes.MSP_BUILD_INFO, string>
  | MSPMsgWithPayload<MSPCodes.MSP_BOARD_INFO, MSPBoardInfo>
  | MSPMsgWithPayload<MSPCodes.MSP_NAME, string>
  | MSPMsgWithPayload<MSPCodes.MSP_UID, string>
  | MSPMsgWithPayload<MSPCodes.MSP2_GET_TEXT, { type: number; value: string }>
  | MSPMsgBase<MSPCodes.MSP2_SET_TEXT>
  | MSPMsgWithPayload<MSPCodes.MSP_BEEPER_CONFIG, MSPBeeperConfig>
  | MSPMsgWithPayload<MSPCodes.MSP_MODE_RANGES, MSPModeRange[]>
  | MSPMsgWithPayload<MSPCodes.MSP_MODE_RANGES_EXTRA, MSPModeRangeExtra[]>
  | MSPMsgWithPayload<MSPCodes.MSP_MOTOR_3D_CONFIG, MSPMotor3DConfig>
  | MSPMsgWithPayload<MSPCodes.MSP_RC_DEADBAND, MSPRcDeadbandConfig>
  | MSPMsgWithPayload<MSPCodes.MSP_GPS_CONFIG, MSPGpsConfig>
  | MSPMsgWithPayload<MSPCodes.MSP_GPS_RESCUE, MSPGpsRescueConfig>
  | MSPMsgWithPayload<MSPCodes.MSP_GPS_SV_INFO, MSPGpsSvInfo>
  | MSPMsgWithPayload<MSPCodes.MSP_VTX_CONFIG, MSPVtxConfig>
  | MSPMsgWithPayload<MSPCodes.MSP_VTXTABLE_BAND, MSPVtxTableBand>
  | MSPMsgWithPayload<MSPCodes.MSP_VTXTABLE_POWERLEVEL, MSPVtxTablePowerLevel>
  | MSPMsgWithPayload<MSPCodes.MSP_LED_COLORS, MSPLedColor[]>
  | MSPMsgWithPayload<MSPCodes.MSP_LED_STRIP_MODECOLOR, MSPLedStripModeColor[]>
  | MSPMsgWithPayload<MSPCodes.MSP_RXFAIL_CONFIG, MSPRxFailConfig[]>
  | MSPMsgWithPayload<MSPCodes.MSP_RX_MAP, number[]>
  | MSPMsgWithPayload<MSPCodes.MSP_SENSOR_CONFIG, MSPSensorConfig>
  | MSPMsgWithPayload<MSPCodes.MSP_SENSOR_ALIGNMENT, MSPSensorAlignment>
  | MSPMsgWithPayload<MSPCodes.MSP_PID, MSPPid[]>
  | MSPMsgWithPayload<MSPCodes.MSP_BLACKBOX_CONFIG, MSPBlackboxConfig>
  | MSPMsgWithPayload<MSPCodes.MSP_OSD_CANVAS, MSPOsdCanvas>;

export const parseMsg = (code: number, payload: Buffer, apiVersion?: string): MSPMsg | undefined => {
  const data = buffToDataView(payload);
  switch (code) {
    case MSPCodes.MSP_STATUS:
      return { code: MSPCodes.MSP_STATUS, payload: parseStatus(data) };
    case MSPCodes.MSP_STATUS_EX:
      return { code: MSPCodes.MSP_STATUS_EX, payload: parseStatusEx(data, apiVersion) };
    case MSPCodes.MSP_RAW_IMU:
      return { code: MSPCodes.MSP_RAW_IMU, payload: parseRawIMU(data) };
    case MSPCodes.MSP_SERVO:
      return { code: MSPCodes.MSP_SERVO, payload: parseServo(data) };
    case MSPCodes.MSP_SERVO_CONFIGURATIONS:
      return {
        code: MSPCodes.MSP_SERVO_CONFIGURATIONS,

        payload: parseServoConfigurations(data),
      };
    case MSPCodes.MSP_MOTOR:
      return { code: MSPCodes.MSP_MOTOR, payload: parseMotor(data) };
    case MSPCodes.MSP_MOTOR_TELEMETRY:
      return { code: MSPCodes.MSP_MOTOR_TELEMETRY, payload: parseMotorTelemetry(data) };
    case MSPCodes.MSP_RC:
      return { code: MSPCodes.MSP_RC, payload: parseRC(data) };
    case MSPCodes.MSP_RAW_GPS:
      return { code: MSPCodes.MSP_RAW_GPS, payload: parseRawGPS(data) };
    case MSPCodes.MSP_COMP_GPS:
      return { code: MSPCodes.MSP_COMP_GPS, payload: parseCompGPS(data) };
    case MSPCodes.MSP_ATTITUDE:
      return { code: MSPCodes.MSP_ATTITUDE, payload: parseAttitude(data) };
    case MSPCodes.MSP_ALTITUDE:
      return { code: MSPCodes.MSP_ALTITUDE, payload: parseAltitude(data) };
    case MSPCodes.MSP_SONAR:
      return { code: MSPCodes.MSP_SONAR, payload: parseSonar(data) };
    case MSPCodes.MSP_ANALOG:
      return { code: MSPCodes.MSP_ANALOG, payload: parseAnalog(data) };
    case MSPCodes.MSP_VOLTAGE_METERS:
      return { code: MSPCodes.MSP_VOLTAGE_METERS, payload: parseVoltageMeters(data) };
    case MSPCodes.MSP_CURRENT_METERS:
      return { code: MSPCodes.MSP_CURRENT_METERS, payload: parseCurrentMeters(data) };
    case MSPCodes.MSP_BATTERY_STATE:
      return { code: MSPCodes.MSP_BATTERY_STATE, payload: parseBatteryState(data) };
    case MSPCodes.MSP_VOLTAGE_METER_CONFIG:
      return {
        code: MSPCodes.MSP_VOLTAGE_METER_CONFIG,

        payload: parseVoltageMeterConfig(data),
      };
    case MSPCodes.MSP_CURRENT_METER_CONFIG:
      return {
        code: MSPCodes.MSP_CURRENT_METER_CONFIG,

        payload: parseCurrentMeterConfig(data),
      };
    case MSPCodes.MSP_BATTERY_CONFIG:
      return { code: MSPCodes.MSP_BATTERY_CONFIG, payload: parseBatteryConfig(data) };
    case MSPCodes.MSP_SET_BATTERY_CONFIG:
      return { code: MSPCodes.MSP_SET_BATTERY_CONFIG };
    case MSPCodes.MSP_MOTOR_CONFIG:
      return { code: MSPCodes.MSP_MOTOR_CONFIG, payload: parseMotorConfig(data, apiVersion) };
    case MSPCodes.MSP_DISPLAYPORT:
      return { code: MSPCodes.MSP_DISPLAYPORT };
    case MSPCodes.MSP_SET_RAW_RC:
      return { code: MSPCodes.MSP_SET_RAW_RC };
    case MSPCodes.MSP_SET_PID:
      return { code: MSPCodes.MSP_SET_PID };
    case MSPCodes.MSP_SET_RC_TUNING:
      return { code: MSPCodes.MSP_SET_RC_TUNING };
    case MSPCodes.MSP_ACC_CALIBRATION:
      return { code: MSPCodes.MSP_ACC_CALIBRATION };
    case MSPCodes.MSP_MAG_CALIBRATION:
      return { code: MSPCodes.MSP_MAG_CALIBRATION };
    case MSPCodes.MSP_SET_MOTOR_CONFIG:
      return { code: MSPCodes.MSP_SET_MOTOR_CONFIG };
    case MSPCodes.MSP_SET_GPS_CONFIG:
      return { code: MSPCodes.MSP_SET_GPS_CONFIG };
    case MSPCodes.MSP_SET_GPS_RESCUE:
      return { code: MSPCodes.MSP_SET_GPS_RESCUE };
    case MSPCodes.MSP_SET_RSSI_CONFIG:
      return { code: MSPCodes.MSP_SET_RSSI_CONFIG };
    case MSPCodes.MSP_SET_FEATURE_CONFIG:
      return { code: MSPCodes.MSP_SET_FEATURE_CONFIG };
    case MSPCodes.MSP_SET_BEEPER_CONFIG:
      return { code: MSPCodes.MSP_SET_BEEPER_CONFIG };
    case MSPCodes.MSP_RESET_CONF:
      return { code: MSPCodes.MSP_RESET_CONF };
    case MSPCodes.MSP_SELECT_SETTING:
      return { code: MSPCodes.MSP_SELECT_SETTING };
    case MSPCodes.MSP_SET_SERVO_CONFIGURATION:
      return { code: MSPCodes.MSP_SET_SERVO_CONFIGURATION };
    case MSPCodes.MSP_EEPROM_WRITE:
      return { code: MSPCodes.MSP_EEPROM_WRITE };
    case MSPCodes.MSP_SET_CURRENT_METER_CONFIG:
      return { code: MSPCodes.MSP_SET_CURRENT_METER_CONFIG };
    case MSPCodes.MSP_SET_VOLTAGE_METER_CONFIG:
      return { code: MSPCodes.MSP_SET_VOLTAGE_METER_CONFIG };
    case MSPCodes.MSP_SET_MOTOR:
      return { code: MSPCodes.MSP_SET_MOTOR };
    case MSPCodes.MSP_SET_VTXTABLE_POWERLEVEL:
      return { code: MSPCodes.MSP_SET_VTXTABLE_POWERLEVEL };
    case MSPCodes.MSP_SET_MODE_RANGE:
      return { code: MSPCodes.MSP_SET_MODE_RANGE };
    case MSPCodes.MSP_SET_ADJUSTMENT_RANGE:
      return { code: MSPCodes.MSP_SET_ADJUSTMENT_RANGE };
    case MSPCodes.MSP_SET_BOARD_ALIGNMENT_CONFIG:
      return { code: MSPCodes.MSP_SET_BOARD_ALIGNMENT_CONFIG };
    case MSPCodes.MSP_PID_CONTROLLER:
      return { code: MSPCodes.MSP_PID_CONTROLLER };
    case MSPCodes.MSP_SET_PID_CONTROLLER:
      return { code: MSPCodes.MSP_SET_PID_CONTROLLER };
    case MSPCodes.MSP_SET_LOOP_TIME:
      return { code: MSPCodes.MSP_SET_LOOP_TIME };
    case MSPCodes.MSP_SET_ARMING_CONFIG:
      return { code: MSPCodes.MSP_SET_ARMING_CONFIG };
    case MSPCodes.MSP_SET_RESET_CURR_PID:
      return { code: MSPCodes.MSP_SET_RESET_CURR_PID };
    case MSPCodes.MSP_SET_MOTOR_3D_CONFIG:
      return { code: MSPCodes.MSP_SET_MOTOR_3D_CONFIG };
    case MSPCodes.MSP_SET_MIXER_CONFIG:
      return { code: MSPCodes.MSP_SET_MIXER_CONFIG };
    case MSPCodes.MSP_SET_RC_DEADBAND:
      return { code: MSPCodes.MSP_SET_RC_DEADBAND };
    case MSPCodes.MSP_SET_SENSOR_ALIGNMENT:
      return { code: MSPCodes.MSP_SET_SENSOR_ALIGNMENT };
    case MSPCodes.MSP_SET_RX_CONFIG:
      return { code: MSPCodes.MSP_SET_RX_CONFIG };
    case MSPCodes.MSP_SET_RXFAIL_CONFIG:
      return { code: MSPCodes.MSP_SET_RXFAIL_CONFIG };
    case MSPCodes.MSP_SET_FAILSAFE_CONFIG:
      return { code: MSPCodes.MSP_SET_FAILSAFE_CONFIG };
    case MSPCodes.MSP_SET_NAME:
      return { code: MSPCodes.MSP_SET_NAME };
    case MSPCodes.MSP_API_VERSION:
      return { code: MSPCodes.MSP_API_VERSION, payload: parseApiVersion(data) };
    case MSPCodes.MSP_FC_VARIANT:
      return { code: MSPCodes.MSP_FC_VARIANT, payload: parseFcVariant(data) };
    case MSPCodes.MSP_FC_VERSION:
      return { code: MSPCodes.MSP_FC_VERSION, payload: parseFcVersion(data) };
    case MSPCodes.MSP_BUILD_INFO:
      return { code: MSPCodes.MSP_BUILD_INFO, payload: parseBuildInfo(data) };
    case MSPCodes.MSP_BOARD_INFO:
      return { code: MSPCodes.MSP_BOARD_INFO, payload: parseBoardInfo(data, apiVersion) };
    case MSPCodes.MSP_NAME:
      return { code: MSPCodes.MSP_NAME, payload: parseName(data) };
    case MSPCodes.MSP_UID:
      return { code: MSPCodes.MSP_UID, payload: parseUID(data) };
    case MSPCodes.MSP2_GET_TEXT:
      return { code: MSPCodes.MSP2_GET_TEXT, payload: parseGetText(data) };
    case MSPCodes.MSP2_SET_TEXT:
      return { code: MSPCodes.MSP2_SET_TEXT };
    case MSPCodes.MSP_BEEPER_CONFIG:
      return { code: MSPCodes.MSP_BEEPER_CONFIG, payload: parseBeeperConfig(data) };
    case MSPCodes.MSP_MODE_RANGES:
      return { code: MSPCodes.MSP_MODE_RANGES, payload: parseModeRanges(data) };
    case MSPCodes.MSP_MODE_RANGES_EXTRA:
      return { code: MSPCodes.MSP_MODE_RANGES_EXTRA, payload: parseModeRangesExtra(data) };
    case MSPCodes.MSP_MOTOR_3D_CONFIG:
      return { code: MSPCodes.MSP_MOTOR_3D_CONFIG, payload: parseMotor3DConfig(data) };
    case MSPCodes.MSP_RC_DEADBAND:
      return { code: MSPCodes.MSP_RC_DEADBAND, payload: parseRcDeadbandConfig(data) };
    case MSPCodes.MSP_GPS_CONFIG:
      return { code: MSPCodes.MSP_GPS_CONFIG, payload: parseGpsConfig(data) };
    case MSPCodes.MSP_GPS_RESCUE:
      return { code: MSPCodes.MSP_GPS_RESCUE, payload: parseGpsRescue(data) };
    case MSPCodes.MSP_GPS_SV_INFO:
      return { code: MSPCodes.MSP_GPS_SV_INFO, payload: parseGpsSvInfo(data) };
    case MSPCodes.MSP_VTX_CONFIG:
      return { code: MSPCodes.MSP_VTX_CONFIG, payload: parseVtxConfig(data) };
    case MSPCodes.MSP_VTXTABLE_BAND:
      return { code: MSPCodes.MSP_VTXTABLE_BAND, payload: parseVtxTableBand(data) };
    case MSPCodes.MSP_VTXTABLE_POWERLEVEL:
      return { code: MSPCodes.MSP_VTXTABLE_POWERLEVEL, payload: parseVtxTablePowerLevel(data) };
    case MSPCodes.MSP_LED_COLORS:
      return { code: MSPCodes.MSP_LED_COLORS, payload: parseLedColors(data) };
    case MSPCodes.MSP_LED_STRIP_MODECOLOR:
      return { code: MSPCodes.MSP_LED_STRIP_MODECOLOR, payload: parseLedStripModeColor(data) };
    case MSPCodes.MSP_RXFAIL_CONFIG:
      return { code: MSPCodes.MSP_RXFAIL_CONFIG, payload: parseRxFailConfig(data) };
    case MSPCodes.MSP_RX_MAP:
      return { code: MSPCodes.MSP_RX_MAP, payload: parseRxMap(data) };
    case MSPCodes.MSP_SENSOR_CONFIG:
      return { code: MSPCodes.MSP_SENSOR_CONFIG, payload: parseSensorConfig(data, apiVersion) };
    case MSPCodes.MSP_SENSOR_ALIGNMENT:
      return { code: MSPCodes.MSP_SENSOR_ALIGNMENT, payload: parseSensorAlignment(data, apiVersion) };
    case MSPCodes.MSP_PID:
      return { code: MSPCodes.MSP_PID, payload: parsePid(data) };
    case MSPCodes.MSP_BLACKBOX_CONFIG:
      return { code: MSPCodes.MSP_BLACKBOX_CONFIG, payload: parseBlackboxConfig(data, apiVersion) };
    case MSPCodes.MSP_OSD_CANVAS:
      return { code: MSPCodes.MSP_OSD_CANVAS, payload: parseOsdCanvas(data) };
  }
  return undefined;
};
