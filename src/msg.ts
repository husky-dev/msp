import { MSPCodes } from './codes';
import { BuffDataView, buffToDataView, push16, push8 } from './utils';

const SIGNATURE_LENGTH = 32;

/**
 * This structure represents the status of the flight controller, including the current system status,
 * cycle time, and various flags indicating the active features and sensors.
 */
export interface MSPStatus {
  /**  The time, in microseconds, it takes to complete one full cycle of the main loop.  */
  cycleTime: number;
  /**  The number of I2C errors that have occurred since the last MSP_STATUS message was sent.  */
  i2cError: number;
  /** Bitmask indicating active sensors: ACC=1, BARO=2, MAG=4, GPS=8, SONAR=16, etc. */
  activeSensors: number;
  /** Bitmask indicating active flight modes: ANGLE=1, HORIZON=2, etc. */
  mode: number;
  /**  The current profile number.  */
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
  cycleTime: number;
  i2cError: number;
  activeSensors: number;
  mode: number;
  profile: number;
  cpuload: number;
  numProfiles: number;
  rateProfile: number;
  armingDisableCount: number;
  armingDisableFlags: number;
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
 * This structure represents the raw sensor data from the flight controller.
 */
export interface MSPRawIMU {
  accelerometer: number[]; //  0.13720703125, -0.0546875, 0.20458984375
  gyroscope: number[]; // -0.48780487804878053, 0.7317073170731708, 0
  magnetometer: number[]; // 0, 0, 0
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

// TODO: MSP2_MOTOR_OUTPUT_REORDERING
// TODO: MSP2_GET_VTX_DEVICE_STATUS

export interface MSPMotorTelemetry {
  rpm: number;
  invalidPercent: number;
  temperature: number;
  voltage: number;
  current: number;
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

export const parseRC = (data: BuffDataView) => {
  const activeChannels = data.length() / 2;
  const channels = [];
  for (let i = 0; i < activeChannels; i++) {
    channels.push(data.readU16());
  }
  return channels;
};

export interface MSPRawGPS {
  fix: number;
  numSat: number;
  lat: number;
  lon: number;
  alt: number;
  speed: number;
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

export interface MSPCompGps {
  distanceToHome: number;
  directionToHome: number;
  update: number;
}

export const parseCompGPS = (data: BuffDataView): MSPCompGps => ({
  distanceToHome: data.readU16(),
  directionToHome: data.readU16(),
  update: data.readU8(),
});

export const parseAttitude = (data: BuffDataView) => [
  data.read16() / 10, // x
  data.read16() / 10, // y
  data.read16() / 10, // z
];

export const parseAltitude = (data: BuffDataView) => parseFloat((data.read32() / 100.0).toFixed(2)); // correct scale factor;

export const parseSonar = (data: BuffDataView) => data.read32();

export interface MSPAnalog {
  voltage: number;
  mAhdrawn: number;
  rssi: number;
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
  id: number;
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
  id: number;
  mAhDrawn: number;
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
  cellCount: number;
  capacity: number;
  voltage: number;
  mAhDrawn: number;
  amperage: number;
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
  id: number;
  sensorType: number;
  vbatscale: number;
  vbatresdivval: number;
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
  id: number;
  sensorType: number;
  scale: number;
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
  vbatmincellvoltage: number;
  vbatmaxcellvoltage: number;
  vbatwarningcellvoltage: number;
  capacity: number;
  voltageMeterSource: number;
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

// TODO: MSP_RC_TUNING
// TODO: MSP_PID
// TODO: MSP_ARMING_CONFIG
// TODO: MSP_LOOP_TIME
// TODO: MSP_MISC

export interface MSPMotorConfig {
  minthrottle: number;
  maxthrottle: number;
  mincommand: number;
  motorCount?: number;
  motorPoles?: number;
  useDshotTelemetry?: boolean;
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

// TODO: MSP_COMPASS_CONFIG
// TODO: MSP_GPS_CONFIG
// TODO: MSP_GPS_RESCUE
// TODO: MSP_RSSI_CONFIG
// TODO: MSP_MOTOR_3D_CONFIG
// TODO: MSP_BOXNAMES
// TODO: MSP_PIDNAMES
// TODO: MSP_BOXIDS
// TODO: MSP_SERVO_MIX_RULES
// TODO: MSP_SERVO_CONFIGURATIONS
// TODO: MSP_RC_DEADBAND
// TODO: MSP_SENSOR_ALIGNMENT
// TODO: MSP_DEBUG

export const composeSetMotor = (motor: number[]): Buffer => {
  let buffer: number[] = [];
  for (let i = 0; i < motor.length; i++) {
    buffer = push16(buffer, motor[1]);
  }
  return Buffer.from(buffer);
};

// TODO: MSP_UID
// TODO: MSP_ACC_TRIM
// TODO: MSP_SET_ACC_TRIM
// TODO: MSP_GPS_SV_INFO
// TODO: MSP_RX_MAP
// TODO: MSP_SET_RX_MAP
// TODO: MSP_MIXER_CONFIG
// TODO: MSP_FEATURE_CONFIG
// TODO: MSP_BEEPER_CONFIG
// TODO: MSP_BOARD_ALIGNMENT_CONFIG
// TODO: MSP_SET_REBOOT

export interface MSPApiVersion {
  mspProtocolVersion: number;
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
  boardIdentifier: string;
  boardVersion: number;
  boardType: number;
  targetCapabilities: number;
  targetName: string;
  boardName: string;
  manufacturerId: string;
  signature: number[];
  mcuTypeId: number;
}

export const parseBoardInfo = (data: BuffDataView): MSPBoardInfo => {
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

// TODO: MSP2_GET_TEXT
// TODO: PILOT_NAME
// TODO: CRAFT_NAME
// TODO: PID_PROFILE_NAME
// TODO: RATE_PROFILE_NAME
// TODO: BUILD_KEY
// TODO: MSP2_GET_LED_STRIP_CONFIG_VALUES
// TODO: MSP_SET_CHANNEL_FORWARDING
// TODO: MSP_CF_SERIAL_CONFIG
// TODO: MSP2_COMMON_SERIAL_CONFIG
// TODO: MSP_SET_CF_SERIAL_CONFIG
// TODO: MSP2_COMMON_SET_SERIAL_CONFIG
// TODO: MSP_MODE_RANGES
// TODO: MSP_MODE_RANGES_EXTRA
// TODO: MSP_ADJUSTMENT_RANGES
// TODO: MSP_RX_CONFIG
// TODO: MSP_FAILSAFE_CONFIG
// TODO: MSP_RXFAIL_CONFIG
// TODO: MSP_ADVANCED_CONFIG
// TODO: MSP_FILTER_CONFIG
// TODO: MSP_SET_PID_ADVANCED
// TODO: MSP_PID_ADVANCED
// TODO: MSP_SENSOR_CONFIG
// TODO: MSP2_SENSOR_CONFIG_ACTIVE
// TODO: MSP_LED_STRIP_CONFIG
// TODO: MSP_SET_LED_STRIP_CONFIG
// TODO: MSP_LED_COLORS
// TODO: MSP_SET_LED_COLORS
// TODO: MSP_LED_STRIP_MODECOLOR
// TODO: MSP_SET_LED_STRIP_MODECOLOR
// TODO: MSP_DATAFLASH_SUMMARY
// TODO: MSP_DATAFLASH_READ
// TODO: MSP_DATAFLASH_ERASE
// TODO: MSP_SDCARD_SUMMARY
// TODO: MSP_BLACKBOX_CONFIG
// TODO: MSP_SET_BLACKBOX_CONFIG
// TODO: MSP_TRANSPONDER_CONFIG
// TODO: MSP_SET_TRANSPONDER_CONFIG
// TODO: MSP_VTX_CONFIG
// TODO: MSP_SET_VTX_CONFIG
// TODO: MSP_VTXTABLE_BAND
// TODO: MSP_SET_VTXTABLE_BAND
// TODO: MSP_VTXTABLE_POWERLEVEL
// TODO: MSP_SET_SIMPLIFIED_TUNING
// TODO: MSP_SIMPLIFIED_TUNING
// TODO: MSP_CALCULATE_SIMPLIFIED_PID
// TODO: MSP_CALCULATE_SIMPLIFIED_GYRO
// TODO: MSP_CALCULATE_SIMPLIFIED_DTERM
// TODO: MSP_VALIDATE_SIMPLIFIED_TUNING

interface MSPSetVtxTablePowerLevelMsg {
  code: MSPCodes.MSP_SET_VTXTABLE_POWERLEVEL;
  name: 'MSP_SET_VTXTABLE_POWERLEVEL';
}

const parseSetVtxTablePowerLevel = (data: BuffDataView): MSPSetVtxTablePowerLevelMsg => ({
  code: MSPCodes.MSP_SET_VTXTABLE_POWERLEVEL,
  name: 'MSP_SET_VTXTABLE_POWERLEVEL',
});

interface MSPSetModeRangeMsg {
  code: MSPCodes.MSP_SET_MODE_RANGE;
  name: 'MSP_SET_MODE_RANGE';
}

const parseSetModeRange = (data: BuffDataView): MSPSetModeRangeMsg => ({
  code: MSPCodes.MSP_SET_MODE_RANGE,
  name: 'MSP_SET_MODE_RANGE',
});

interface MSPSetAdjustmentRangeMsg {
  code: MSPCodes.MSP_SET_ADJUSTMENT_RANGE;
  name: 'MSP_SET_ADJUSTMENT_RANGE';
}

const parseSetAdjustmentRange = (data: BuffDataView): MSPSetAdjustmentRangeMsg => ({
  code: MSPCodes.MSP_SET_ADJUSTMENT_RANGE,
  name: 'MSP_SET_ADJUSTMENT_RANGE',
});

interface MSPSetBoardAlignmentConfigMsg {
  code: MSPCodes.MSP_SET_BOARD_ALIGNMENT_CONFIG;
  name: 'MSP_SET_BOARD_ALIGNMENT_CONFIG';
}

const parseSetBoardAlignmentConfig = (data: BuffDataView): MSPSetBoardAlignmentConfigMsg => ({
  code: MSPCodes.MSP_SET_BOARD_ALIGNMENT_CONFIG,
  name: 'MSP_SET_BOARD_ALIGNMENT_CONFIG',
});

interface MSPPidControllerMsg {
  code: MSPCodes.MSP_PID_CONTROLLER;
  name: 'MSP_PID_CONTROLLER';
  controller: number;
}

const parsePidController = (data: BuffDataView): MSPPidControllerMsg => ({
  code: MSPCodes.MSP_PID_CONTROLLER,
  name: 'MSP_PID_CONTROLLER',
  controller: data.readU8(),
});

interface MSPSetPidControllerMsg {
  code: MSPCodes.MSP_SET_PID_CONTROLLER;
  name: 'MSP_SET_PID_CONTROLLER';
}

const parseSetPidController = (data: BuffDataView): MSPSetPidControllerMsg => ({
  code: MSPCodes.MSP_SET_PID_CONTROLLER,
  name: 'MSP_SET_PID_CONTROLLER',
});

interface MSPSetLoopTimeMsg {
  code: MSPCodes.MSP_SET_LOOP_TIME;
  name: 'MSP_SET_LOOP_TIME';
}

const parseSetLoopTime = (data: BuffDataView): MSPSetLoopTimeMsg => ({
  code: MSPCodes.MSP_SET_LOOP_TIME,
  name: 'MSP_SET_LOOP_TIME',
});

interface MSPSetArmingConfigMsg {
  code: MSPCodes.MSP_SET_ARMING_CONFIG;
  name: 'MSP_SET_ARMING_CONFIG';
}

const parseSetArmingConfig = (data: BuffDataView): MSPSetArmingConfigMsg => ({
  code: MSPCodes.MSP_SET_ARMING_CONFIG,
  name: 'MSP_SET_ARMING_CONFIG',
});

interface MSPSetResetCurrPidMsg {
  code: MSPCodes.MSP_SET_RESET_CURR_PID;
  name: 'MSP_SET_RESET_CURR_PID';
}

const parseSetResetCurrPid = (data: BuffDataView): MSPSetResetCurrPidMsg => ({
  code: MSPCodes.MSP_SET_RESET_CURR_PID,
  name: 'MSP_SET_RESET_CURR_PID',
});

interface MSPSetMotor3DConfigMsg {
  code: MSPCodes.MSP_SET_MOTOR_3D_CONFIG;
  name: 'MSP_SET_MOTOR_3D_CONFIG';
}

const parseSetMotor3DConfig = (data: BuffDataView): MSPSetMotor3DConfigMsg => ({
  code: MSPCodes.MSP_SET_MOTOR_3D_CONFIG,
  name: 'MSP_SET_MOTOR_3D_CONFIG',
});

interface MSPSetMixerConfigMsg {
  code: MSPCodes.MSP_SET_MIXER_CONFIG;
  name: 'MSP_SET_MIXER_CONFIG';
}

const parseSetMixerConfig = (data: BuffDataView): MSPSetMixerConfigMsg => ({
  code: MSPCodes.MSP_SET_MIXER_CONFIG,
  name: 'MSP_SET_MIXER_CONFIG',
});

interface MSPSetRcDeadbandMsg {
  code: MSPCodes.MSP_SET_RC_DEADBAND;
  name: 'MSP_SET_RC_DEADBAND';
}

const parseSetRcDeadband = (data: BuffDataView): MSPSetRcDeadbandMsg => ({
  code: MSPCodes.MSP_SET_RC_DEADBAND,
  name: 'MSP_SET_RC_DEADBAND',
});

interface MSPSetSensorAlignmentMsg {
  code: MSPCodes.MSP_SET_SENSOR_ALIGNMENT;
  name: 'MSP_SET_SENSOR_ALIGNMENT';
}

const parseSetSensorAlignment = (data: BuffDataView): MSPSetSensorAlignmentMsg => ({
  code: MSPCodes.MSP_SET_SENSOR_ALIGNMENT,
  name: 'MSP_SET_SENSOR_ALIGNMENT',
});

interface MSPSetRxConfigMsg {
  code: MSPCodes.MSP_SET_RX_CONFIG;
  name: 'MSP_SET_RX_CONFIG';
}

const parseSetRxConfig = (data: BuffDataView): MSPSetRxConfigMsg => ({
  code: MSPCodes.MSP_SET_RX_CONFIG,
  name: 'MSP_SET_RX_CONFIG',
});

interface MSPSetRxFailConfigMsg {
  code: MSPCodes.MSP_SET_RXFAIL_CONFIG;
  name: 'MSP_SET_RXFAIL_CONFIG';
}

const parseSetRxFailConfig = (data: BuffDataView): MSPSetRxFailConfigMsg => ({
  code: MSPCodes.MSP_SET_RXFAIL_CONFIG,
  name: 'MSP_SET_RXFAIL_CONFIG',
});

interface MSPSetFailsafeConfigMsg {
  code: MSPCodes.MSP_SET_FAILSAFE_CONFIG;
  name: 'MSP_SET_FAILSAFE_CONFIG';
}

const parseSetFailsafeConfig = (data: BuffDataView): MSPSetFailsafeConfigMsg => ({
  code: MSPCodes.MSP_SET_FAILSAFE_CONFIG,
  name: 'MSP_SET_FAILSAFE_CONFIG',
});

// TODO: MSP_OSD_CANVAS
// TODO: MSP_SET_OSD_CANVAS
// TODO: MSP_OSD_CONFIG
// TODO: MSP_SET_OSD_CONFIG
// TODO: MSP_OSD_CHAR_READ
// TODO: MSP_OSD_CHAR_WRITE

export const composeSetName = (name: string): Buffer => {
  let buffer: number[] = [];
  const MSP_BUFFER_SIZE = 64;
  for (let i = 0; i < name.length && i < MSP_BUFFER_SIZE; i++) {
    buffer = push8(buffer, name.charCodeAt(i));
  }
  return Buffer.from(buffer);
};

// TODO: MSP2_SET_TEXT
// TODO: MSP2_SET_LED_STRIP_CONFIG_VALUES
// TODO: MSP_SET_FILTER_CONFIG
// TODO: MSP_SET_ADVANCED_CONFIG
// TODO: MSP_SET_SENSOR_CONFIG
// TODO: MSP_COPY_PROFILE
// TODO: MSP_ARMING_DISABLE
// TODO: MSP_SET_RTC
// TODO: MSP2_SET_MOTOR_OUTPUT_REORDERING
// TODO: MSP2_SEND_DSHOT_COMMAND
// TODO: MSP_MULTIPLE_MSP

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
      return parseSetVtxTablePowerLevel(data);
    case MSPCodes.MSP_SET_MODE_RANGE:
      return parseSetModeRange(data);
    case MSPCodes.MSP_SET_ADJUSTMENT_RANGE:
      return parseSetAdjustmentRange(data);
    case MSPCodes.MSP_SET_BOARD_ALIGNMENT_CONFIG:
      return parseSetBoardAlignmentConfig(data);
    case MSPCodes.MSP_PID_CONTROLLER:
      return parsePidController(data);
    case MSPCodes.MSP_SET_PID_CONTROLLER:
      return parseSetPidController(data);
    case MSPCodes.MSP_SET_LOOP_TIME:
      return parseSetLoopTime(data);
    case MSPCodes.MSP_SET_ARMING_CONFIG:
      return parseSetArmingConfig(data);
    case MSPCodes.MSP_SET_RESET_CURR_PID:
      return parseSetResetCurrPid(data);
    case MSPCodes.MSP_SET_MOTOR_3D_CONFIG:
      return parseSetMotor3DConfig(data);
    case MSPCodes.MSP_SET_MIXER_CONFIG:
      return parseSetMixerConfig(data);
    case MSPCodes.MSP_SET_RC_DEADBAND:
      return parseSetRcDeadband(data);
    case MSPCodes.MSP_SET_SENSOR_ALIGNMENT:
      return parseSetSensorAlignment(data);
    case MSPCodes.MSP_SET_RX_CONFIG:
      return parseSetRxConfig(data);
    case MSPCodes.MSP_SET_RXFAIL_CONFIG:
      return parseSetRxFailConfig(data);
    case MSPCodes.MSP_SET_FAILSAFE_CONFIG:
      return parseSetFailsafeConfig(data);
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
  }
  throw new Error(`Unknown MSP code: ${code}`);
};

export type MSPMsg = ReturnType<typeof parseMsg>;
