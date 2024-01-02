import { buffToDataView } from './utils';

export enum MSPCodes {
  MSP_API_VERSION = 1,
  MSP_FC_VARIANT = 2,
  MSP_FC_VERSION = 3,
  MSP_BOARD_INFO = 4,
  MSP_BUILD_INFO = 5,

  MSP_NAME = 10, // DEPRECATED IN MSP 1.45
  MSP_SET_NAME = 11, // DEPRECATED IN MSP 1.45

  MSP_BATTERY_CONFIG = 32,
  MSP_SET_BATTERY_CONFIG = 33,
  MSP_MODE_RANGES = 34,
  MSP_SET_MODE_RANGE = 35,
  MSP_FEATURE_CONFIG = 36,
  MSP_SET_FEATURE_CONFIG = 37,
  MSP_BOARD_ALIGNMENT_CONFIG = 38,
  MSP_SET_BOARD_ALIGNMENT_CONFIG = 39,
  MSP_CURRENT_METER_CONFIG = 40,
  MSP_SET_CURRENT_METER_CONFIG = 41,
  MSP_MIXER_CONFIG = 42,
  MSP_SET_MIXER_CONFIG = 43,
  MSP_RX_CONFIG = 44,
  MSP_SET_RX_CONFIG = 45,
  MSP_LED_COLORS = 46,
  MSP_SET_LED_COLORS = 47,
  MSP_LED_STRIP_CONFIG = 48,
  MSP_SET_LED_STRIP_CONFIG = 49,
  MSP_RSSI_CONFIG = 50,
  MSP_SET_RSSI_CONFIG = 51,
  MSP_ADJUSTMENT_RANGES = 52,
  MSP_SET_ADJUSTMENT_RANGE = 53,
  MSP_CF_SERIAL_CONFIG = 54,
  MSP_SET_CF_SERIAL_CONFIG = 55,
  MSP_VOLTAGE_METER_CONFIG = 56,
  MSP_SET_VOLTAGE_METER_CONFIG = 57,
  MSP_SONAR = 58, // notice, in firmware named as MSP_SONAR_ALTITUDE
  MSP_PID_CONTROLLER = 59,
  MSP_SET_PID_CONTROLLER = 60,
  MSP_ARMING_CONFIG = 61,
  MSP_SET_ARMING_CONFIG = 62,
  MSP_RX_MAP = 64,
  MSP_SET_RX_MAP = 65,
  MSP_BF_CONFIG = 66, // DEPRECATED
  MSP_SET_BF_CONFIG = 67, // DEPRECATED
  MSP_SET_REBOOT = 68,
  MSP_BF_BUILD_INFO = 69, // Not used
  MSP_DATAFLASH_SUMMARY = 70,
  MSP_DATAFLASH_READ = 71,
  MSP_DATAFLASH_ERASE = 72,
  MSP_LOOP_TIME = 73,
  MSP_SET_LOOP_TIME = 74,
  MSP_FAILSAFE_CONFIG = 75,
  MSP_SET_FAILSAFE_CONFIG = 76,
  MSP_RXFAIL_CONFIG = 77,
  MSP_SET_RXFAIL_CONFIG = 78,
  MSP_SDCARD_SUMMARY = 79,
  MSP_BLACKBOX_CONFIG = 80,
  MSP_SET_BLACKBOX_CONFIG = 81,
  MSP_TRANSPONDER_CONFIG = 82,
  MSP_SET_TRANSPONDER_CONFIG = 83,
  MSP_OSD_CONFIG = 84,
  MSP_SET_OSD_CONFIG = 85,
  MSP_OSD_CHAR_READ = 86,
  MSP_OSD_CHAR_WRITE = 87,
  MSP_VTX_CONFIG = 88,
  MSP_SET_VTX_CONFIG = 89,
  MSP_ADVANCED_CONFIG = 90,
  MSP_SET_ADVANCED_CONFIG = 91,
  MSP_FILTER_CONFIG = 92,
  MSP_SET_FILTER_CONFIG = 93,
  MSP_PID_ADVANCED = 94,
  MSP_SET_PID_ADVANCED = 95,
  MSP_SENSOR_CONFIG = 96,
  MSP_SET_SENSOR_CONFIG = 97,
  //MSP_SPECIAL_PARAMETERS=        98, // DEPRECATED
  MSP_ARMING_DISABLE = 99,
  //MSP_SET_SPECIAL_PARAMETERS=    99, // DEPRECATED
  //MSP_IDENT=                     100, // DEPRECTED
  MSP_STATUS = 101,
  MSP_RAW_IMU = 102,
  MSP_SERVO = 103,
  MSP_MOTOR = 104,
  MSP_RC = 105,
  MSP_RAW_GPS = 106,
  MSP_COMP_GPS = 107,
  MSP_ATTITUDE = 108,
  MSP_ALTITUDE = 109,
  MSP_ANALOG = 110,
  MSP_RC_TUNING = 111,
  MSP_PID = 112,
  //MSP_BOX=                       113, // DEPRECATED
  MSP_MISC = 114, // DEPRECATED
  MSP_BOXNAMES = 116,
  MSP_PIDNAMES = 117,
  MSP_WP = 118, // Not used
  MSP_BOXIDS = 119,
  MSP_SERVO_CONFIGURATIONS = 120,
  MSP_MOTOR_3D_CONFIG = 124,
  MSP_RC_DEADBAND = 125,
  MSP_SENSOR_ALIGNMENT = 126,
  MSP_LED_STRIP_MODECOLOR = 127,

  MSP_VOLTAGE_METERS = 128,
  MSP_CURRENT_METERS = 129,
  MSP_BATTERY_STATE = 130,
  MSP_MOTOR_CONFIG = 131,
  MSP_GPS_CONFIG = 132,
  MSP_COMPASS_CONFIG = 133,
  MSP_GPS_RESCUE = 135,

  MSP_VTXTABLE_BAND = 137,
  MSP_VTXTABLE_POWERLEVEL = 138,

  MSP_MOTOR_TELEMETRY = 139,

  MSP_SIMPLIFIED_TUNING = 140,
  MSP_SET_SIMPLIFIED_TUNING = 141,

  MSP_CALCULATE_SIMPLIFIED_PID = 142, // calculate slider values in temp profile
  MSP_CALCULATE_SIMPLIFIED_GYRO = 143,
  MSP_CALCULATE_SIMPLIFIED_DTERM = 144,

  MSP_VALIDATE_SIMPLIFIED_TUNING = 145, // validate slider values in temp profile

  MSP_STATUS_EX = 150,

  MSP_UID = 160,
  MSP_GPS_SV_INFO = 164,

  MSP_DISPLAYPORT = 182,

  MSP_COPY_PROFILE = 183,

  MSP_BEEPER_CONFIG = 184,
  MSP_SET_BEEPER_CONFIG = 185,

  MSP_SET_OSD_CANVAS = 188,
  MSP_OSD_CANVAS = 189,

  MSP_SET_RAW_RC = 200,
  MSP_SET_RAW_GPS = 201, // Not used
  MSP_SET_PID = 202,
  //MSP_SET_BOX=                   203, // DEPRECATED
  MSP_SET_RC_TUNING = 204,
  MSP_ACC_CALIBRATION = 205,
  MSP_MAG_CALIBRATION = 206,
  MSP_SET_MISC = 207, // DEPRECATED
  MSP_RESET_CONF = 208,
  MSP_SET_WP = 209, // Not used
  MSP_SELECT_SETTING = 210,
  MSP_SET_HEADING = 211, // Not used
  MSP_SET_SERVO_CONFIGURATION = 212,
  MSP_SET_MOTOR = 214,
  MSP_SET_MOTOR_3D_CONFIG = 217,
  MSP_SET_RC_DEADBAND = 218,
  MSP_SET_RESET_CURR_PID = 219,
  MSP_SET_SENSOR_ALIGNMENT = 220,
  MSP_SET_LED_STRIP_MODECOLOR = 221,
  MSP_SET_MOTOR_CONFIG = 222,
  MSP_SET_GPS_CONFIG = 223,
  MSP_SET_COMPASS_CONFIG = 224,
  MSP_SET_GPS_RESCUE = 225,

  MSP_SET_VTXTABLE_BAND = 227,
  MSP_SET_VTXTABLE_POWERLEVEL = 228,

  MSP_MULTIPLE_MSP = 230,

  MSP_MODE_RANGES_EXTRA = 238,
  MSP_SET_ACC_TRIM = 239,
  MSP_ACC_TRIM = 240,
  MSP_SERVO_MIX_RULES = 241,
  MSP_SET_SERVO_MIX_RULE = 242, // Not used
  MSP_SET_4WAY_IF = 245, // Not used
  MSP_SET_RTC = 246,
  MSP_RTC = 247, // Not used
  MSP_SET_BOARD_INFO = 248, // Not used
  MSP_SET_SIGNATURE = 249, // Not used

  MSP_EEPROM_WRITE = 250,
  MSP_DEBUGMSG = 253, // Not used
  MSP_DEBUG = 254,

  // MSPv2 Common
  MSP2_COMMON_SERIAL_CONFIG = 0x1009,
  MSP2_COMMON_SET_SERIAL_CONFIG = 0x100a,

  // MSPv2 Betaflight specific
  MSP2_BETAFLIGHT_BIND = 0x3000,
  MSP2_MOTOR_OUTPUT_REORDERING = 0x3001,
  MSP2_SET_MOTOR_OUTPUT_REORDERING = 0x3002,
  MSP2_SEND_DSHOT_COMMAND = 0x3003,
  MSP2_GET_VTX_DEVICE_STATUS = 0x3004,
  MSP2_GET_OSD_WARNINGS = 0x3005,
  MSP2_GET_TEXT = 0x3006,
  MSP2_SET_TEXT = 0x3007,
  MSP2_GET_LED_STRIP_CONFIG_VALUES = 0x3008,
  MSP2_SET_LED_STRIP_CONFIG_VALUES = 0x3009,
  MSP2_SENSOR_CONFIG_ACTIVE = 0x300a,

  // MSP2_GET_TEXT and MSP2_SET_TEXT variable types
  PILOT_NAME = 1,
  CRAFT_NAME = 2,
  PID_PROFILE_NAME = 3,
  RATE_PROFILE_NAME = 4,
  BUILD_KEY = 5,
}

interface MSPApiVersionMsg {
  code: MSPCodes.MSP_API_VERSION;
  name: 'MSP_API_VERSION';
  mspProtocolVersion: number;
  apiVersion: string;
}

interface MSPBoardInfoMsg {
  code: MSPCodes.MSP_BOARD_INFO;
  name: 'MSP_BOARD_INFO';
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

/**
 * This structure represents the status of the flight controller, including the current system status,
 * cycle time, and various flags indicating the active features and sensors.
 */
interface MSPStatusMsg {
  code: MSPCodes.MSP_STATUS;
  name: 'MSP_STATUS';
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

/**
 * This structure represents the current RC channel values.
 * The number of channels is determined by the MSP_RC_TUNING message.
 * The values are in microseconds, and the range is determined by the MSP_SET_RC_TUNING message.
 * The first channel is roll, the second is pitch, the third is throttle, the fourth is yaw, and the fifth is aux1.
 * Additional channels are aux2, aux3, aux4, etc.
 */
interface MSPRCMsg {
  code: MSPCodes.MSP_RC;
  name: 'MSP_RC';
  /**  The current RC channel values.  */
  channels: number[];
}

interface MSPRawGPSMsg {
  code: MSPCodes.MSP_RAW_GPS;
  name: 'MSP_RAW_GPS';
  fix: number;
  numSat: number;
  lat: number;
  lon: number;
  alt: number;
  speed: number;
  groundCourse: number;
}

interface MSPCompGpsMsg {
  code: MSPCodes.MSP_COMP_GPS;
  name: 'MSP_COMP_GPS';
  distanceToHome: number;
  directionToHome: number;
  update: number;
}

interface MSPAttitudeMsg {
  code: MSPCodes.MSP_ATTITUDE;
  name: 'MSP_ATTITUDE';
  kinematics: number[];
}

interface MSPAltitudeMsg {
  code: MSPCodes.MSP_ALTITUDE;
  name: 'MSP_ALTITUDE';
  altitude: number;
}

interface MSPSonarMsg {
  code: MSPCodes.MSP_SONAR;
  name: 'MSP_SONAR';
  sonar: number;
}

/**
 * This structure represents the raw sensor data from the flight controller.
 */
interface MSPRawImuMsg {
  code: MSPCodes.MSP_RAW_IMU;
  name: 'MSP_RAW_IMU';
  accelerometer: number[]; //  0.13720703125, -0.0546875, 0.20458984375
  gyroscope: number[]; // -0.48780487804878053, 0.7317073170731708, 0
  magnetometer: number[]; // 0, 0, 0
}

/**
 * This structure represents the current servo values.
 * The number of servos is determined by the MSP_SERVO_CONF message.
 * The values are in microseconds, and the range is determined by the MSP_SET_SERVO_CONF message.
 * The first servo is servo 0, the second is servo 1, etc.
 */
interface MSPServoMsg {
  code: MSPCodes.MSP_SERVO;
  name: 'MSP_SERVO';
  servo: number[]; // 1500, 1500, 1500, 1500, 1500, 1500
}

interface MSPMotorMsg {
  code: MSPCodes.MSP_MOTOR;
  name: 'MSP_MOTOR';
  motor: number[]; // 1000, 1000, 1000, 1000, 0, 0, 0, 0
}

interface MSP2MotorOutputReordering {
  code: MSPCodes.MSP2_MOTOR_OUTPUT_REORDERING;
  name: 'MSP2_MOTOR_OUTPUT_REORDERING';
  motorOutputReordering: number[];
}

interface MSP2GetVtxDeviceStatus {
  code: MSPCodes.MSP2_GET_VTX_DEVICE_STATUS;
  name: 'MSP2_GET_VTX_DEVICE_STATUS';
  vtxDeviceStatusData: number[];
}

export type MSPMsg =
  | MSPApiVersionMsg
  | MSPBoardInfoMsg
  | MSPStatusMsg
  | MSPRCMsg
  | MSPRawImuMsg
  | MSPServoMsg
  | MSPMotorMsg
  | MSP2MotorOutputReordering
  | MSP2GetVtxDeviceStatus
  | MSPRawGPSMsg
  | MSPCompGpsMsg
  | MSPAttitudeMsg
  | MSPAltitudeMsg
  | MSPSonarMsg;

const SIGNATURE_LENGTH = 32;

export const parseMSPIncomeData = (buff: Buffer): MSPMsg | undefined => {
  const len = buff[3];
  const code = buff[4];
  const payload = buff.slice(5, 5 + len);
  const data = buffToDataView(payload);

  // MSP_API_VERSION
  if (code === MSPCodes.MSP_API_VERSION) {
    return {
      code: MSPCodes.MSP_API_VERSION,
      name: 'MSP_API_VERSION',
      mspProtocolVersion: data.readU8(),
      apiVersion: `${data.readU8()}.${data.readU8()}.0`,
    };
  }

  // MSP_BOARD_INFO
  if (code === MSPCodes.MSP_BOARD_INFO) {
    // TODO: Parse board info data
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

    return {
      code: MSPCodes.MSP_BOARD_INFO,
      name: 'MSP_BOARD_INFO',
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
  }

  // MSP_STATUS
  if (code === MSPCodes.MSP_STATUS) {
    return {
      code: MSPCodes.MSP_STATUS,
      name: 'MSP_STATUS',
      cycleTime: data.readU16(),
      i2cError: data.readU16(),
      activeSensors: data.readU16(),
      mode: data.readU32(),
      profile: data.readU8(),
    };
  }

  // MSP_RC
  if (code === MSPCodes.MSP_RC) {
    const activeChannels = data.length() / 2;
    const channels = [];
    for (let i = 0; i < activeChannels; i++) {
      channels.push(data.readU16());
    }
    return {
      code: MSPCodes.MSP_RC,
      name: 'MSP_RC',
      channels,
    };
  }

  // MSP_RAW_GPS
  if (code === MSPCodes.MSP_RAW_GPS) {
    return {
      code: MSPCodes.MSP_RAW_GPS,
      name: 'MSP_RAW_GPS',
      fix: data.readU8(),
      numSat: data.readU8(),
      lat: data.read32(),
      lon: data.read32(),
      alt: data.readU16(),
      speed: data.readU16(),
      groundCourse: data.readU16(),
    };
  }

  // MSP_COMP_GPS
  if (code === MSPCodes.MSP_COMP_GPS) {
    return {
      code: MSPCodes.MSP_COMP_GPS,
      name: 'MSP_COMP_GPS',
      distanceToHome: data.readU16(),
      directionToHome: data.readU16(),
      update: data.readU8(),
    };
  }

  // MSP_ATTITUDE
  if (code === MSPCodes.MSP_ATTITUDE) {
    return {
      code: MSPCodes.MSP_ATTITUDE,
      name: 'MSP_ATTITUDE',
      kinematics: [
        data.read16() / 10, // x
        data.read16() / 10, // y
        data.read16() / 10, // z
      ],
    };
  }

  // MSP_ALTITUDE
  if (code === MSPCodes.MSP_ALTITUDE) {
    return {
      code: MSPCodes.MSP_ALTITUDE,
      name: 'MSP_ALTITUDE',
      altitude: parseFloat((data.read32() / 100.0).toFixed(2)), // correct scale factor
    };
  }

  // MSP_SONAR
  if (code === MSPCodes.MSP_SONAR) {
    return {
      code: MSPCodes.MSP_SONAR,
      name: 'MSP_SONAR',
      sonar: data.read32(),
    };
  }

  // MSP_RAW_IMU
  if (code === MSPCodes.MSP_RAW_IMU) {
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
      code: MSPCodes.MSP_RAW_IMU,
      name: 'MSP_RAW_IMU',
      accelerometer,
      gyroscope,
      magnetometer,
    };
  }

  // MSP_SERVO
  if (code === MSPCodes.MSP_SERVO) {
    const servo: number[] = [];
    for (let i = 0; i < data.length() / 2; i++) {
      servo.push(data.readU16());
    }
    return {
      code: MSPCodes.MSP_SERVO,
      name: 'MSP_SERVO',
      servo,
    };
  }

  // MSP_MOTOR
  if (code === MSPCodes.MSP_MOTOR) {
    const motor: number[] = [];
    for (let i = 0; i < data.length() / 2; i++) {
      motor.push(data.readU16());
    }
    return {
      code: MSPCodes.MSP_MOTOR,
      name: 'MSP_MOTOR',
      motor,
    };
  }

  // MSP2_MOTOR_OUTPUT_REORDERING
  // if (code === MSPCodes.MSP2_MOTOR_OUTPUT_REORDERING) {
  //   const motorOutputReordering: number[] = [];
  //   for (let i = 0; i < data.length; i++) {
  //     motorOutputReordering.push(data.readUInt8(i));
  //   }
  //   return {
  //     code: MSPCodes.MSP2_MOTOR_OUTPUT_REORDERING,
  //     name: 'MSP2_MOTOR_OUTPUT_REORDERING',
  //     motorOutputReordering,
  //   };
  // }

  // MSP2_GET_VTX_DEVICE_STATUS
  // if (code === MSPCodes.MSP2_GET_VTX_DEVICE_STATUS) {
  //   const vtxDeviceStatusData: number[] = [];
  //   for (let i = 0; i < data.length; i++) {
  //     vtxDeviceStatusData.push(data.readUInt8(i));
  //   }
  //   return {
  //     code: MSPCodes.MSP2_GET_VTX_DEVICE_STATUS,
  //     name: 'MSP2_GET_VTX_DEVICE_STATUS',
  //     vtxDeviceStatusData,
  //   };
  // }

  return undefined;
};
