import { MSPCodes } from './codes';
import { BuffDataView, buffToDataView, push8 } from './utils';

// Original doucmentation:
// http://www.multiwii.com/wiki/index.php?title=Multiwii_Serial_Protocol
// Betaflight extended documentation:
// https://github.com/betaflight/betaflight/blob/master/src/main/msp/msp_protocol.h

/**
 * Represents the status of the Multiwii Serial Protocol (MSP).
 */
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

/**
 * Represents the extended status of the Multiwii Serial Protocol (MSP).
 */
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
}

export const parseStatusEx = (data: BuffDataView): MSPStatusEx => {
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

  // TODO: Read CPU temp, from API version 1.46
  // if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_46)) {
  //   FC.CONFIG.cpuTemp = data.readU16();
  // }
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
  };
};

/**
 * Represents the raw sensor data from the flight controller.
 */
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

/**
 * Represents the telemetry data for a motor in Multiwii Serial Protocol.
 */
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
 * @param {BuffDataView} data - The buffer data to be parsed.
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

/**
 * Represents the raw GPS data from the flight controller.
 */
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

/**
 * Represents the computed GPS data for navigation purposes.
 */
export interface MSPCompGps {
  /** Distance to home point in meters. Example: `100` */
  distanceToHome: number;
  /** Direction to home point in degrees from North. Example: `270` (West) */
  directionToHome: number;
  /** Update status. 0: No update, 1: Updated. Example: `1` */
  update: number;
}

export const parseCompGPS = (data: BuffDataView): MSPCompGps => ({
  distanceToHome: data.readU16(),
  directionToHome: data.readU16(),
  update: data.readU8(),
});

/**
 * Parses buffer data into an array representing attitude (orientation) in degrees.
 * @param {BuffDataView} data - The buffer data to be parsed.
 * @returns {number[]} An array of attitude values in degrees for x (roll), y (pitch), and z (yaw) axes.
 */
export const parseAttitude = (data: BuffDataView) => [
  data.read16() / 10, // Roll: Divides by 10 to convert to degrees.
  data.read16() / 10, // Pitch: Divides by 10 to convert to degrees.
  data.read16() / 10, // Yaw: Divides by 10 to convert to degrees.
];

/**
 * Parses buffer data to extract altitude information.
 * @param {BuffDataView} data - The buffer data to be parsed.
 * @returns {number} Altitude value in meters with two decimal places.
 */
export const parseAltitude = (data: BuffDataView) =>
  // Converts the 32-bit value to altitude in meters with correct scale factor.
  parseFloat((data.read32() / 100.0).toFixed(2));

export const parseSonar = (data: BuffDataView) => data.read32();

/**
 * Represents the analog data readings in Multiwii Serial Protocol.
 */
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

/**
 * Represents a voltage meter reading in Multiwii Serial Protocol.
 */
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

/**
 * Represents a current meter reading in Multiwii Serial Protocol.
 */
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

/**
 * Represents the state of a battery in Multiwii Serial Protocol.
 */
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

/**
 * Represents the configuration settings for a voltage meter in Multiwii Serial Protocol.
 */
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

/**
 * Represents the configuration settings for a current meter in Multiwii Serial Protocol.
 */
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

/**
 * Represents the battery configuration settings in Multiwii Serial Protocol.
 */
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

/**
 * Represents the motor configuration settings in Multiwii Serial Protocol.
 */
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

export const parseMotorConfig = (data: BuffDataView): MSPMotorConfig => {
  const msg: MSPMotorConfig = {
    minthrottle: data.readU16(),
    maxthrottle: data.readU16(),
    mincommand: data.readU16(),
  };
  msg.motorCount = data.readU8();
  msg.motorPoles = data.readU8();
  msg.useDshotTelemetry = data.readU8() !== 0;
  msg.useEscSensor = data.readU8() !== 0;
  //   if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_42)) {
  //     FC.MOTOR_CONFIG.motor_count = data.readU8();
  //     FC.MOTOR_CONFIG.motor_poles = data.readU8();
  //     FC.MOTOR_CONFIG.use_dshot_telemetry = data.readU8() != 0;
  //     FC.MOTOR_CONFIG.use_esc_sensor = data.readU8() != 0;
  // }
  return msg;
};

/**
 * Represents the API version information in Multiwii Serial Protocol.
 */
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

/**
 * Represents the board information in Multiwii Serial Protocol.
 */
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
}

export const parseBoardInfo = (data: BuffDataView): MSPBoardInfo => {
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

  // TODO: Parse board info additional data depending on API version
  // if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_42)) {
  //     FC.CONFIG.configurationState = data.readU8();
  // }

  // if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_43)) {
  //     FC.CONFIG.sampleRateHz = data.readU16();
  //     FC.CONFIG.configurationProblems = data.readU32();
  // } else {
  //     FC.CONFIG.configurationProblems = 0;
  // }

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

/**
 * Represents the beeper configuration in Multiwii Serial Protocol.
 */
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

export const parseMsg = (code: number, payload: Buffer) => {
  const data = buffToDataView(payload);

  switch (code) {
    case MSPCodes.MSP_STATUS:
      return { code: MSPCodes.MSP_STATUS, name: 'MSP_STATUS', ...parseStatus(data) };
    case MSPCodes.MSP_STATUS_EX:
      return { code: MSPCodes.MSP_STATUS_EX, name: 'MSP_STATUS_EX', ...parseStatusEx(data) };
    case MSPCodes.MSP_RAW_IMU:
      return { code: MSPCodes.MSP_RAW_IMU, name: 'MSP_RAW_IMU', ...parseRawIMU(data) };
    case MSPCodes.MSP_SERVO:
      return { code: MSPCodes.MSP_SERVO, name: 'MSP_SERVO', servo: parseServo(data) };
    case MSPCodes.MSP_SERVO_CONFIGURATIONS:
      return {
        code: MSPCodes.MSP_SERVO_CONFIGURATIONS,
        name: 'MSP_SERVO_CONFIGURATIONS',
        servoConfigurations: parseServoConfigurations(data),
      };
    case MSPCodes.MSP_MOTOR:
      return { code: MSPCodes.MSP_MOTOR, name: 'MSP_MOTOR', motor: parseMotor(data) };
    case MSPCodes.MSP_MOTOR_TELEMETRY:
      return { code: MSPCodes.MSP_MOTOR_TELEMETRY, name: 'MSP_MOTOR_TELEMETRY', motorTelemetry: parseMotorTelemetry(data) };
    case MSPCodes.MSP_RC:
      return { code: MSPCodes.MSP_RC, name: 'MSP_RC', channels: parseRC(data) };
    case MSPCodes.MSP_RAW_GPS:
      return { code: MSPCodes.MSP_RAW_GPS, name: 'MSP_RAW_GPS', ...parseRawGPS(data) };
    case MSPCodes.MSP_COMP_GPS:
      return { code: MSPCodes.MSP_COMP_GPS, name: 'MSP_COMP_GPS', ...parseCompGPS(data) };
    case MSPCodes.MSP_ATTITUDE:
      return { code: MSPCodes.MSP_ATTITUDE, name: 'MSP_ATTITUDE', kinematics: parseAttitude(data) };
    case MSPCodes.MSP_ALTITUDE:
      return { code: MSPCodes.MSP_ALTITUDE, name: 'MSP_ALTITUDE', altitude: parseAltitude(data) };
    case MSPCodes.MSP_SONAR:
      return { code: MSPCodes.MSP_SONAR, name: 'MSP_SONAR', sonar: parseSonar(data) };
    case MSPCodes.MSP_ANALOG:
      return { code: MSPCodes.MSP_ANALOG, name: 'MSP_ANALOG', ...parseAnalog(data) };
    case MSPCodes.MSP_VOLTAGE_METERS:
      return { code: MSPCodes.MSP_VOLTAGE_METERS, name: 'MSP_VOLTAGE_METERS', voltageMeters: parseVoltageMeters(data) };
    case MSPCodes.MSP_CURRENT_METERS:
      return { code: MSPCodes.MSP_CURRENT_METERS, name: 'MSP_CURRENT_METERS', currentMeters: parseCurrentMeters(data) };
    case MSPCodes.MSP_BATTERY_STATE:
      return { code: MSPCodes.MSP_BATTERY_STATE, name: 'MSP_BATTERY_STATE', ...parseBatteryState(data) };
    case MSPCodes.MSP_VOLTAGE_METER_CONFIG:
      return {
        code: MSPCodes.MSP_VOLTAGE_METER_CONFIG,
        name: 'MSP_VOLTAGE_METER_CONFIG',
        voltageMeterConfigs: parseVoltageMeterConfig(data),
      };
    case MSPCodes.MSP_CURRENT_METER_CONFIG:
      return {
        code: MSPCodes.MSP_CURRENT_METER_CONFIG,
        name: 'MSP_CURRENT_METER_CONFIG',
        currentMeterConfigs: parseCurrentMeterConfig(data),
      };
    case MSPCodes.MSP_BATTERY_CONFIG:
      return { code: MSPCodes.MSP_BATTERY_CONFIG, name: 'MSP_BATTERY_CONFIG', ...parseBatteryConfig(data) };
    case MSPCodes.MSP_SET_BATTERY_CONFIG:
      return { code: MSPCodes.MSP_SET_BATTERY_CONFIG, name: 'MSP_SET_BATTERY_CONFIG' };
    case MSPCodes.MSP_MOTOR_CONFIG:
      return { code: MSPCodes.MSP_MOTOR_CONFIG, name: 'MSP_MOTOR_CONFIG', ...parseMotorConfig(data) };
    case MSPCodes.MSP_DISPLAYPORT:
      return { code: MSPCodes.MSP_DISPLAYPORT, name: 'MSP_DISPLAYPORT' };
    case MSPCodes.MSP_SET_RAW_RC:
      return { code: MSPCodes.MSP_SET_RAW_RC, name: 'MSP_SET_RAW_RC' };
    case MSPCodes.MSP_SET_PID:
      return { code: MSPCodes.MSP_SET_PID, name: 'MSP_SET_PID' };
    case MSPCodes.MSP_SET_RC_TUNING:
      return { code: MSPCodes.MSP_SET_RC_TUNING, name: 'MSP_SET_RC_TUNING' };
    case MSPCodes.MSP_ACC_CALIBRATION:
      return { code: MSPCodes.MSP_ACC_CALIBRATION, name: 'MSP_ACC_CALIBRATION' };
    case MSPCodes.MSP_MAG_CALIBRATION:
      return { code: MSPCodes.MSP_MAG_CALIBRATION, name: 'MSP_MAG_CALIBRATION' };
    case MSPCodes.MSP_SET_MOTOR_CONFIG:
      return { code: MSPCodes.MSP_SET_MOTOR_CONFIG, name: 'MSP_SET_MOTOR_CONFIG' };
    case MSPCodes.MSP_SET_GPS_CONFIG:
      return { code: MSPCodes.MSP_SET_GPS_CONFIG, name: 'MSP_SET_GPS_CONFIG' };
    case MSPCodes.MSP_SET_GPS_RESCUE:
      return { code: MSPCodes.MSP_SET_GPS_RESCUE, name: 'MSP_SET_GPS_RESCUE' };
    case MSPCodes.MSP_SET_RSSI_CONFIG:
      return { code: MSPCodes.MSP_SET_RSSI_CONFIG, name: 'MSP_SET_RSSI_CONFIG' };
    case MSPCodes.MSP_SET_FEATURE_CONFIG:
      return { code: MSPCodes.MSP_SET_FEATURE_CONFIG, name: 'MSP_SET_FEATURE_CONFIG' };
    case MSPCodes.MSP_SET_BEEPER_CONFIG:
      return { code: MSPCodes.MSP_SET_BEEPER_CONFIG, name: 'MSP_SET_BEEPER_CONFIG' };
    case MSPCodes.MSP_RESET_CONF:
      return { code: MSPCodes.MSP_RESET_CONF, name: 'MSP_RESET_CONF' };
    case MSPCodes.MSP_SELECT_SETTING:
      return { code: MSPCodes.MSP_SELECT_SETTING, name: 'MSP_SELECT_SETTING' };
    case MSPCodes.MSP_SET_SERVO_CONFIGURATION:
      return { code: MSPCodes.MSP_SET_SERVO_CONFIGURATION, name: 'MSP_SET_SERVO_CONFIGURATION' };
    case MSPCodes.MSP_EEPROM_WRITE:
      return { code: MSPCodes.MSP_EEPROM_WRITE, name: 'MSP_EEPROM_WRITE' };
    case MSPCodes.MSP_SET_CURRENT_METER_CONFIG:
      return { code: MSPCodes.MSP_SET_CURRENT_METER_CONFIG, name: 'MSP_SET_CURRENT_METER_CONFIG' };
    case MSPCodes.MSP_SET_VOLTAGE_METER_CONFIG:
      return { code: MSPCodes.MSP_SET_VOLTAGE_METER_CONFIG, name: 'MSP_SET_VOLTAGE_METER_CONFIG' };
    case MSPCodes.MSP_SET_MOTOR:
      return { code: MSPCodes.MSP_SET_MOTOR, name: 'MSP_SET_MOTOR' };
    case MSPCodes.MSP_SET_VTXTABLE_POWERLEVEL:
      return { code: MSPCodes.MSP_SET_VTXTABLE_POWERLEVEL, name: 'MSP_SET_VTXTABLE_POWERLEVEL' };
    case MSPCodes.MSP_SET_MODE_RANGE:
      return { code: MSPCodes.MSP_SET_MODE_RANGE, name: 'MSP_SET_MODE_RANGE' };
    case MSPCodes.MSP_SET_ADJUSTMENT_RANGE:
      return { code: MSPCodes.MSP_SET_ADJUSTMENT_RANGE, name: 'MSP_SET_ADJUSTMENT_RANGE' };
    case MSPCodes.MSP_SET_BOARD_ALIGNMENT_CONFIG:
      return { code: MSPCodes.MSP_SET_BOARD_ALIGNMENT_CONFIG, name: 'MSP_SET_BOARD_ALIGNMENT_CONFIG' };
    case MSPCodes.MSP_PID_CONTROLLER:
      return { code: MSPCodes.MSP_PID_CONTROLLER, name: 'MSP_PID_CONTROLLER' };
    case MSPCodes.MSP_SET_PID_CONTROLLER:
      return { code: MSPCodes.MSP_SET_PID_CONTROLLER, name: 'MSP_SET_PID_CONTROLLER' };
    case MSPCodes.MSP_SET_LOOP_TIME:
      return { code: MSPCodes.MSP_SET_LOOP_TIME, name: 'MSP_SET_LOOP_TIME' };
    case MSPCodes.MSP_SET_ARMING_CONFIG:
      return { code: MSPCodes.MSP_SET_ARMING_CONFIG, name: 'MSP_SET_ARMING_CONFIG' };
    case MSPCodes.MSP_SET_RESET_CURR_PID:
      return { code: MSPCodes.MSP_SET_RESET_CURR_PID, name: 'MSP_SET_RESET_CURR_PID' };
    case MSPCodes.MSP_SET_MOTOR_3D_CONFIG:
      return { code: MSPCodes.MSP_SET_MOTOR_3D_CONFIG, name: 'MSP_SET_MOTOR_3D_CONFIG' };
    case MSPCodes.MSP_SET_MIXER_CONFIG:
      return { code: MSPCodes.MSP_SET_MIXER_CONFIG, name: 'MSP_SET_MIXER_CONFIG' };
    case MSPCodes.MSP_SET_RC_DEADBAND:
      return { code: MSPCodes.MSP_SET_RC_DEADBAND, name: 'MSP_SET_RC_DEADBAND' };
    case MSPCodes.MSP_SET_SENSOR_ALIGNMENT:
      return { code: MSPCodes.MSP_SET_SENSOR_ALIGNMENT, name: 'MSP_SET_SENSOR_ALIGNMENT' };
    case MSPCodes.MSP_SET_RX_CONFIG:
      return { code: MSPCodes.MSP_SET_RX_CONFIG, name: 'MSP_SET_RX_CONFIG' };
    case MSPCodes.MSP_SET_RXFAIL_CONFIG:
      return { code: MSPCodes.MSP_SET_RXFAIL_CONFIG, name: 'MSP_SET_RXFAIL_CONFIG' };
    case MSPCodes.MSP_SET_FAILSAFE_CONFIG:
      return { code: MSPCodes.MSP_SET_FAILSAFE_CONFIG, name: 'MSP_SET_FAILSAFE_CONFIG' };
    case MSPCodes.MSP_SET_NAME:
      return { code: MSPCodes.MSP_SET_NAME, name: 'MSP_SET_NAME' };
    case MSPCodes.MSP_API_VERSION:
      return { code: MSPCodes.MSP_API_VERSION, name: 'MSP_API_VERSION', ...parseApiVersion(data) };
    case MSPCodes.MSP_FC_VARIANT:
      return { code: MSPCodes.MSP_FC_VARIANT, name: 'MSP_FC_VARIANT', fcVariantIdentifier: parseFcVariant(data) };
    case MSPCodes.MSP_FC_VERSION:
      return { code: MSPCodes.MSP_FC_VERSION, name: 'MSP_FC_VERSION', flightControllerVersion: parseFcVersion(data) };
    case MSPCodes.MSP_BUILD_INFO:
      return { code: MSPCodes.MSP_BUILD_INFO, name: 'MSP_BUILD_INFO', buildInfo: parseBuildInfo(data) };
    case MSPCodes.MSP_BOARD_INFO:
      return { code: MSPCodes.MSP_BOARD_INFO, name: 'MSP_BOARD_INFO', ...parseBoardInfo(data) };
    case MSPCodes.MSP_NAME:
      return { code: MSPCodes.MSP_NAME, name: 'MSP_NAME', value: parseName(data) };
    case MSPCodes.MSP_UID:
      return { code: MSPCodes.MSP_UID, name: 'MSP_UID', deviceIdentifier: parseUID(data) };
    case MSPCodes.MSP2_GET_TEXT:
      return { code: MSPCodes.MSP2_GET_TEXT, name: 'MSP2_GET_TEXT', ...parseGetText(data) };
    case MSPCodes.MSP2_SET_TEXT:
      return { code: MSPCodes.MSP2_SET_TEXT, name: 'MSP2_SET_TEXT' };
    case MSPCodes.MSP_BEEPER_CONFIG:
      return { code: MSPCodes.MSP_BEEPER_CONFIG, name: 'MSP_BEEPER_CONFIG', ...parseBeeperConfig(data) };
  }
  throw new Error(`Unknown MSP code: ${code}`);
};

export type MSPMsg = ReturnType<typeof parseMsg>;
