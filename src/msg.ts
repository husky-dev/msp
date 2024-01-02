import { MSPCodes } from './codes';
import { BuffDataView, buffToDataView } from './utils';

const SIGNATURE_LENGTH = 32;

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

const parseStatus = (data: BuffDataView): MSPStatusMsg => ({
  code: MSPCodes.MSP_STATUS,
  name: 'MSP_STATUS',
  cycleTime: data.readU16(),
  i2cError: data.readU16(),
  activeSensors: data.readU16(),
  mode: data.readU32(),
  profile: data.readU8(),
});

interface MSPStatusExMsg {
  code: MSPCodes.MSP_STATUS_EX;
  name: 'MSP_STATUS_EX';
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

const parseStatusEx = (data: BuffDataView): MSPStatusExMsg => {
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
    code: MSPCodes.MSP_STATUS_EX,
    name: 'MSP_STATUS_EX',
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
interface MSPRawImuMsg {
  code: MSPCodes.MSP_RAW_IMU;
  name: 'MSP_RAW_IMU';
  accelerometer: number[]; //  0.13720703125, -0.0546875, 0.20458984375
  gyroscope: number[]; // -0.48780487804878053, 0.7317073170731708, 0
  magnetometer: number[]; // 0, 0, 0
}

const parseRawImu = (data: BuffDataView): MSPRawImuMsg => {
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
};

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

const parseServo = (data: BuffDataView): MSPServoMsg => {
  const servo: number[] = [];
  for (let i = 0; i < data.length() / 2; i++) {
    servo.push(data.readU16());
  }
  return {
    code: MSPCodes.MSP_SERVO,
    name: 'MSP_SERVO',
    servo,
  };
};

interface MSPMotorMsg {
  code: MSPCodes.MSP_MOTOR;
  name: 'MSP_MOTOR';
  motor: number[]; // 1000, 1000, 1000, 1000, 0, 0, 0, 0
}

const parseMotor = (data: BuffDataView): MSPMotorMsg => {
  const motor: number[] = [];
  for (let i = 0; i < data.length() / 2; i++) {
    motor.push(data.readU16());
  }
  return {
    code: MSPCodes.MSP_MOTOR,
    name: 'MSP_MOTOR',
    motor,
  };
};

// TODO: Implement parser
interface MSP2MotorOutputReordering {
  code: MSPCodes.MSP2_MOTOR_OUTPUT_REORDERING;
  name: 'MSP2_MOTOR_OUTPUT_REORDERING';
}

// TODO: Implement parser
interface MSP2GetVtxDeviceStatus {
  code: MSPCodes.MSP2_GET_VTX_DEVICE_STATUS;
  name: 'MSP2_GET_VTX_DEVICE_STATUS';
}

interface MSPMotorTelemetryMsg {
  code: MSPCodes.MSP_MOTOR_TELEMETRY;
  name: 'MSP_MOTOR_TELEMETRY';
  motorTelemetryData: MSPMotorTelemetryData[];
}

interface MSPMotorTelemetryData {
  rpm: number;
  invalidPercent: number;
  temperature: number;
  voltage: number;
  current: number;
  consumption: number;
}

const parseMotorTelemetry = (data: BuffDataView): MSPMotorTelemetryMsg => {
  const motorTelemetryData: MSPMotorTelemetryData[] = [];
  const telemMotorCount = data.readU8();
  for (let i = 0; i < telemMotorCount; i++) {
    motorTelemetryData.push({
      rpm: data.readU32(),
      invalidPercent: data.readU16(),
      temperature: data.readU8(),
      voltage: data.readU16(),
      current: data.readU16(),
      consumption: data.readU16(),
    });
  }
  return {
    code: MSPCodes.MSP_MOTOR_TELEMETRY,
    name: 'MSP_MOTOR_TELEMETRY',
    motorTelemetryData,
  };
};

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

const parseRC = (data: BuffDataView): MSPRCMsg => {
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
};

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

const parseRawGPS = (data: BuffDataView): MSPRawGPSMsg => ({
  code: MSPCodes.MSP_RAW_GPS,
  name: 'MSP_RAW_GPS',
  fix: data.readU8(),
  numSat: data.readU8(),
  lat: data.read32(),
  lon: data.read32(),
  alt: data.readU16(),
  speed: data.readU16(),
  groundCourse: data.readU16(),
});

interface MSPCompGpsMsg {
  code: MSPCodes.MSP_COMP_GPS;
  name: 'MSP_COMP_GPS';
  distanceToHome: number;
  directionToHome: number;
  update: number;
}

const parseCompGPS = (data: BuffDataView): MSPCompGpsMsg => ({
  code: MSPCodes.MSP_COMP_GPS,
  name: 'MSP_COMP_GPS',
  distanceToHome: data.readU16(),
  directionToHome: data.readU16(),
  update: data.readU8(),
});

interface MSPAttitudeMsg {
  code: MSPCodes.MSP_ATTITUDE;
  name: 'MSP_ATTITUDE';
  kinematics: number[];
}

const parseAttitude = (data: BuffDataView): MSPAttitudeMsg => ({
  code: MSPCodes.MSP_ATTITUDE,
  name: 'MSP_ATTITUDE',
  kinematics: [
    data.read16() / 10, // x
    data.read16() / 10, // y
    data.read16() / 10, // z
  ],
});

interface MSPAltitudeMsg {
  code: MSPCodes.MSP_ALTITUDE;
  name: 'MSP_ALTITUDE';
  altitude: number;
}

const parseAltitude = (data: BuffDataView): MSPAltitudeMsg => ({
  code: MSPCodes.MSP_ALTITUDE,
  name: 'MSP_ALTITUDE',
  altitude: parseFloat((data.read32() / 100.0).toFixed(2)), // correct scale factor
});

interface MSPSonarMsg {
  code: MSPCodes.MSP_SONAR;
  name: 'MSP_SONAR';
  sonar: number;
}

const parseSonar = (data: BuffDataView): MSPSonarMsg => ({
  code: MSPCodes.MSP_SONAR,
  name: 'MSP_SONAR',
  sonar: data.read32(),
});

interface MSPAnalogMsg {
  code: MSPCodes.MSP_ANALOG;
  name: 'MSP_ANALOG';
  voltage: number;
  mAhdrawn: number;
  rssi: number;
  amperage: number;
}

const parseAnalog = (data: BuffDataView): MSPAnalogMsg => ({
  code: MSPCodes.MSP_ANALOG,
  name: 'MSP_ANALOG',
  voltage: data.readU8() / 10.0,
  mAhdrawn: data.readU16(),
  rssi: data.readU16(), // 0-1023
  amperage: data.read16() / 100, // A
  // FC.ANALOG.voltage = data.readU16() / 100; ???
});

interface MSPVoltageMetersMsg {
  code: MSPCodes.MSP_VOLTAGE_METERS;
  name: 'MSP_VOLTAGE_METERS';
  voltageMeters: MSPVoltageMeter[];
}

interface MSPVoltageMeter {
  id: number;
  voltage: number;
}

const parseVoltageMeters = (data: BuffDataView): MSPVoltageMetersMsg => {
  const voltageMeters: MSPVoltageMeter[] = [];
  const voltageMeterLength = 2;
  for (let i = 0; i < data.length() / voltageMeterLength; i++) {
    const voltageMeter: MSPVoltageMeter = {
      id: data.readU8(),
      voltage: data.readU8() / 10.0,
    };
    voltageMeters.push(voltageMeter);
  }
  return {
    code: MSPCodes.MSP_VOLTAGE_METERS,
    name: 'MSP_VOLTAGE_METERS',
    voltageMeters,
  };
};

interface MSPCurrentMetersMsg {
  code: MSPCodes.MSP_CURRENT_METERS;
  name: 'MSP_CURRENT_METERS';
  currentMeters: MSPCurrentMeter[];
}

interface MSPCurrentMeter {
  id: number;
  mAhDrawn: number;
  amperage: number;
}

const parseCurrentMeters = (data: BuffDataView): MSPCurrentMetersMsg => {
  const currentMeters: MSPCurrentMeter[] = [];
  const currentMeterLength = 5;
  for (let i = 0; i < data.length() / currentMeterLength; i++) {
    currentMeters.push({
      id: data.readU8(),
      mAhDrawn: data.readU16(),
      amperage: data.readU16() / 1000,
    });
  }
  return {
    code: MSPCodes.MSP_CURRENT_METERS,
    name: 'MSP_CURRENT_METERS',
    currentMeters,
  };
};

interface MSPBatteryStateMsg {
  code: MSPCodes.MSP_BATTERY_STATE;
  name: 'MSP_BATTERY_STATE';
  cellCount: number;
  capacity: number;
  voltage: number;
  mAhDrawn: number;
  amperage: number;
  batteryState: number;
}

const parseBatteryState = (data: BuffDataView): MSPBatteryStateMsg => ({
  code: MSPCodes.MSP_BATTERY_STATE,
  name: 'MSP_BATTERY_STATE',
  cellCount: data.readU8(),
  capacity: data.readU16(),
  voltage: data.readU8() / 10.0,
  mAhDrawn: data.readU16(),
  amperage: data.readU16() / 100,
  batteryState: data.readU8(),
  // FC.BATTERY_STATE.voltage = data.readU16() / 100; ???
});

interface MSPVoltageMeterConfigMsg {
  code: MSPCodes.MSP_VOLTAGE_METER_CONFIG;
  name: 'MSP_VOLTAGE_METER_CONFIG';
  voltageMeterConfigs: MSPVoltageMeterConfig[];
}

interface MSPVoltageMeterConfig {
  id: number;
  sensorType: number;
  vbatscale: number;
  vbatresdivval: number;
  vbatresdivmultiplier: number;
}

const parseVoltageMeterConfig = (data: BuffDataView): MSPVoltageMeterConfigMsg => {
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

  return {
    code: MSPCodes.MSP_VOLTAGE_METER_CONFIG,
    name: 'MSP_VOLTAGE_METER_CONFIG',
    voltageMeterConfigs,
  };
};

interface MSPCurrentMeterConfigMsg {
  code: MSPCodes.MSP_CURRENT_METER_CONFIG;
  name: 'MSP_CURRENT_METER_CONFIG';
  currentMeterConfigs: MSPCurrentMeterConfig[];
}

interface MSPCurrentMeterConfig {
  id: number;
  sensorType: number;
  scale: number;
  offset: number;
}

const parseCurrentMeterConfig = (data: BuffDataView): MSPCurrentMeterConfigMsg => {
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

  return {
    code: MSPCodes.MSP_CURRENT_METER_CONFIG,
    name: 'MSP_CURRENT_METER_CONFIG',
    currentMeterConfigs,
  };
};

interface MSPBatteryConfigMsg {
  code: MSPCodes.MSP_BATTERY_CONFIG;
  name: 'MSP_BATTERY_CONFIG';
  vbatmincellvoltage: number;
  vbatmaxcellvoltage: number;
  vbatwarningcellvoltage: number;
  capacity: number;
  voltageMeterSource: number;
  currentMeterSource: number;
}

const parseBatteryConfig = (data: BuffDataView): MSPBatteryConfigMsg => ({
  code: MSPCodes.MSP_BATTERY_CONFIG,
  name: 'MSP_BATTERY_CONFIG',
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

export interface MSPSetBatteryConfigMsg {
  code: MSPCodes.MSP_SET_BATTERY_CONFIG;
  name: 'MSP_SET_BATTERY_CONFIG';
}

export interface MSPApiVersionMsg {
  code: MSPCodes.MSP_API_VERSION;
  name: 'MSP_API_VERSION';
  mspProtocolVersion: number;
  apiVersion: string;
}

const parseApiVersion = (data: BuffDataView): MSPApiVersionMsg => ({
  code: MSPCodes.MSP_API_VERSION,
  name: 'MSP_API_VERSION',
  mspProtocolVersion: data.readU8(),
  apiVersion: `${data.readU8()}.${data.readU8()}.0`,
});

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

const parseBoardInfo = (data: BuffDataView): MSPBoardInfoMsg => {
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
};

export const parseIncomingBuff = (buff: Buffer) => {
  const len = buff[3];
  const code = buff[4];
  const payload = buff.slice(5, 5 + len);
  const data = buffToDataView(payload);

  switch (code) {
    case MSPCodes.MSP_STATUS:
      return parseStatus(data);
    case MSPCodes.MSP_STATUS_EX:
      return parseStatusEx(data);
    case MSPCodes.MSP_RAW_IMU:
      return parseRawImu(data);
    case MSPCodes.MSP_SERVO:
      return parseServo(data);
    case MSPCodes.MSP_MOTOR:
      return parseMotor(data);
    case MSPCodes.MSP2_MOTOR_OUTPUT_REORDERING:
      return undefined;
    case MSPCodes.MSP2_GET_VTX_DEVICE_STATUS:
      return undefined;
    case MSPCodes.MSP_MOTOR_TELEMETRY:
      return parseMotorTelemetry(data);
    case MSPCodes.MSP_RC:
      return parseRC(data);
    case MSPCodes.MSP_RAW_GPS:
      return parseRawGPS(data);
    case MSPCodes.MSP_COMP_GPS:
      return parseCompGPS(data);
    case MSPCodes.MSP_ATTITUDE:
      return parseAttitude(data);
    case MSPCodes.MSP_ALTITUDE:
      return parseAltitude(data);
    case MSPCodes.MSP_SONAR:
      return parseSonar(data);
    case MSPCodes.MSP_ANALOG:
      return parseAnalog(data);
    case MSPCodes.MSP_VOLTAGE_METERS:
      return parseVoltageMeters(data);
    case MSPCodes.MSP_CURRENT_METERS:
      return parseCurrentMeters(data);
    case MSPCodes.MSP_BATTERY_STATE:
      return parseBatteryState(data);
    case MSPCodes.MSP_VOLTAGE_METER_CONFIG:
      return parseVoltageMeterConfig(data);
    case MSPCodes.MSP_CURRENT_METER_CONFIG:
      return parseCurrentMeterConfig(data);
    case MSPCodes.MSP_BATTERY_CONFIG:
      return parseBatteryConfig(data);
    case MSPCodes.MSP_SET_BATTERY_CONFIG:
      return {
        code: MSPCodes.MSP_SET_BATTERY_CONFIG,
        name: 'MSP_SET_BATTERY_CONFIG',
      };
    case MSPCodes.MSP_API_VERSION:
      return parseApiVersion(data);
    case MSPCodes.MSP_BOARD_INFO:
      return parseBoardInfo(data);
    default:
      return undefined;
  }
};

export type MSPMsg = ReturnType<typeof parseIncomingBuff>;
