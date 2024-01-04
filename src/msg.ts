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

/**
 * This structure represents the current motor values.
 * The number of motors is determined by the MSP_MOTOR_CONFIG message.
 * The values are in microseconds, and the range is determined by the MSP_SET_MOTOR_CONFIG message.
 */
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

// TODO: MSP2_MOTOR_OUTPUT_REORDERING
// TODO: MSP2_GET_VTX_DEVICE_STATUS

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

const parseSetBatteryConfig = (data: BuffDataView): MSPSetBatteryConfigMsg => ({
  code: MSPCodes.MSP_SET_BATTERY_CONFIG,
  name: 'MSP_SET_BATTERY_CONFIG',
});

// TODO: MSP_RC_TUNING
// TODO: MSP_PID
// TODO: MSP_ARMING_CONFIG
// TODO: MSP_LOOP_TIME
// TODO: MSP_MISC

interface MSPMotorConfigMsg {
  code: MSPCodes.MSP_MOTOR_CONFIG;
  name: 'MSP_MOTOR_CONFIG';
  minthrottle: number;
  maxthrottle: number;
  mincommand: number;
  motorCount?: number;
  motorPoles?: number;
  useDshotTelemetry?: boolean;
  useEscSensor?: boolean;
}

const parseMotorConfig = (data: BuffDataView): MSPMotorConfigMsg => {
  const msg: MSPMotorConfigMsg = {
    code: MSPCodes.MSP_MOTOR_CONFIG,
    name: 'MSP_MOTOR_CONFIG',
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

export interface MSPDisplayPortMsg {
  code: MSPCodes.MSP_DISPLAYPORT;
  name: 'MSP_DISPLAYPORT';
}

const parseDisplayPort = (data: BuffDataView): MSPDisplayPortMsg => ({
  code: MSPCodes.MSP_DISPLAYPORT,
  name: 'MSP_DISPLAYPORT',
});

export interface MSPSetRawRCMsg {
  code: MSPCodes.MSP_SET_RAW_RC;
  name: 'MSP_SET_RAW_RC';
}

const parseSetRawRC = (data: BuffDataView): MSPSetRawRCMsg => ({
  code: MSPCodes.MSP_SET_RAW_RC,
  name: 'MSP_SET_RAW_RC',
});

export interface MSPSetPIDMsg {
  code: MSPCodes.MSP_SET_PID;
  name: 'MSP_SET_PID';
}

const parseSetPID = (data: BuffDataView): MSPSetPIDMsg => ({
  code: MSPCodes.MSP_SET_PID,
  name: 'MSP_SET_PID',
});

export interface MSPSetRCTuningMsg {
  code: MSPCodes.MSP_SET_RC_TUNING;
  name: 'MSP_SET_RC_TUNING';
}

const parseSetRCTuning = (data: BuffDataView): MSPSetRCTuningMsg => ({
  code: MSPCodes.MSP_SET_RC_TUNING,
  name: 'MSP_SET_RC_TUNING',
});

export interface MSPAccCalibrationMsg {
  code: MSPCodes.MSP_ACC_CALIBRATION;
  name: 'MSP_ACC_CALIBRATION';
}

const parseAccCalibration = (data: BuffDataView): MSPAccCalibrationMsg => ({
  code: MSPCodes.MSP_ACC_CALIBRATION,
  name: 'MSP_ACC_CALIBRATION',
});

export interface MSPMagCalibrationMsg {
  code: MSPCodes.MSP_MAG_CALIBRATION;
  name: 'MSP_MAG_CALIBRATION';
}

const parseMagCalibration = (data: BuffDataView): MSPMagCalibrationMsg => ({
  code: MSPCodes.MSP_MAG_CALIBRATION,
  name: 'MSP_MAG_CALIBRATION',
});

export interface MSPSetMotorConfigMsg {
  code: MSPCodes.MSP_SET_MOTOR_CONFIG;
  name: 'MSP_SET_MOTOR_CONFIG';
}

const parseSetMotorConfig = (data: BuffDataView): MSPSetMotorConfigMsg => ({
  code: MSPCodes.MSP_SET_MOTOR_CONFIG,
  name: 'MSP_SET_MOTOR_CONFIG',
});

export interface MSPSetGPSConfigMsg {
  code: MSPCodes.MSP_SET_GPS_CONFIG;
  name: 'MSP_SET_GPS_CONFIG';
}

const parseSetGPSConfig = (data: BuffDataView): MSPSetGPSConfigMsg => ({
  code: MSPCodes.MSP_SET_GPS_CONFIG,
  name: 'MSP_SET_GPS_CONFIG',
});

export interface MSPSetGPSRescueMsg {
  code: MSPCodes.MSP_SET_GPS_RESCUE;
  name: 'MSP_SET_GPS_RESCUE';
}

const parseSetGPSRescue = (data: BuffDataView): MSPSetGPSRescueMsg => ({
  code: MSPCodes.MSP_SET_GPS_RESCUE,
  name: 'MSP_SET_GPS_RESCUE',
});

export interface MSPSetRSSIConfigMsg {
  code: MSPCodes.MSP_SET_RSSI_CONFIG;
  name: 'MSP_SET_RSSI_CONFIG';
}

const parseSetRSSIConfig = (data: BuffDataView): MSPSetRSSIConfigMsg => ({
  code: MSPCodes.MSP_SET_RSSI_CONFIG,
  name: 'MSP_SET_RSSI_CONFIG',
});

export interface MSPSetFeatureConfigMsg {
  code: MSPCodes.MSP_SET_FEATURE_CONFIG;
  name: 'MSP_SET_FEATURE_CONFIG';
}

const parseSetFeatureConfig = (data: BuffDataView): MSPSetFeatureConfigMsg => ({
  code: MSPCodes.MSP_SET_FEATURE_CONFIG,
  name: 'MSP_SET_FEATURE_CONFIG',
});

export interface MSPSetBeeperConfigMsg {
  code: MSPCodes.MSP_SET_BEEPER_CONFIG;
  name: 'MSP_SET_BEEPER_CONFIG';
}

const parseSetBeeperConfig = (data: BuffDataView): MSPSetBeeperConfigMsg => ({
  code: MSPCodes.MSP_SET_BEEPER_CONFIG,
  name: 'MSP_SET_BEEPER_CONFIG',
});

export interface MSPResetConfMsg {
  code: MSPCodes.MSP_RESET_CONF;
  name: 'MSP_RESET_CONF';
}

const parseResetConf = (data: BuffDataView): MSPResetConfMsg => ({
  code: MSPCodes.MSP_RESET_CONF,
  name: 'MSP_RESET_CONF',
});

export interface MSPSelectSettingMsg {
  code: MSPCodes.MSP_SELECT_SETTING;
  name: 'MSP_SELECT_SETTING';
}

const parseSelectSetting = (data: BuffDataView): MSPSelectSettingMsg => ({
  code: MSPCodes.MSP_SELECT_SETTING,
  name: 'MSP_SELECT_SETTING',
});

export interface MSPSetServoConfigurationMsg {
  code: MSPCodes.MSP_SET_SERVO_CONFIGURATION;
  name: 'MSP_SET_SERVO_CONFIGURATION';
}

const parseSetServoConfiguration = (data: BuffDataView): MSPSetServoConfigurationMsg => ({
  code: MSPCodes.MSP_SET_SERVO_CONFIGURATION,
  name: 'MSP_SET_SERVO_CONFIGURATION',
});

export interface MSPEepromWriteMsg {
  code: MSPCodes.MSP_EEPROM_WRITE;
  name: 'MSP_EEPROM_WRITE';
}

const parseEepromWrite = (data: BuffDataView): MSPEepromWriteMsg => ({
  code: MSPCodes.MSP_EEPROM_WRITE,
  name: 'MSP_EEPROM_WRITE',
});

export interface MSPSetCurrentMeterConfigMsg {
  code: MSPCodes.MSP_SET_CURRENT_METER_CONFIG;
  name: 'MSP_SET_CURRENT_METER_CONFIG';
}

const parseSetCurrentMeterConfig = (data: BuffDataView): MSPSetCurrentMeterConfigMsg => ({
  code: MSPCodes.MSP_SET_CURRENT_METER_CONFIG,
  name: 'MSP_SET_CURRENT_METER_CONFIG',
});

export interface MSPSetVoltageMeterConfigMsg {
  code: MSPCodes.MSP_SET_VOLTAGE_METER_CONFIG;
  name: 'MSP_SET_VOLTAGE_METER_CONFIG';
}

const parseSetVoltageMeterConfig = (data: BuffDataView): MSPSetVoltageMeterConfigMsg => ({
  code: MSPCodes.MSP_SET_VOLTAGE_METER_CONFIG,
  name: 'MSP_SET_VOLTAGE_METER_CONFIG',
});

// TODO: MSP_DEBUG

export interface MSPSetMotorMsg {
  code: MSPCodes.MSP_SET_MOTOR;
  name: 'MSP_SET_MOTOR';
}

const parseSetMotor = (data: BuffDataView): MSPSetMotorMsg => ({
  code: MSPCodes.MSP_SET_MOTOR,
  name: 'MSP_SET_MOTOR',
});

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

export interface MSPFcVariantMsg {
  code: MSPCodes.MSP_FC_VARIANT;
  name: 'MSP_FC_VARIANT';
  fcVariantIdentifier: string;
}

const parseFcVariant = (data: BuffDataView): MSPFcVariantMsg => {
  let fcVariantIdentifier = '';
  for (let i = 0; i < 4; i++) {
    fcVariantIdentifier += String.fromCharCode(data.readU8());
  }
  return {
    code: MSPCodes.MSP_FC_VARIANT,
    name: 'MSP_FC_VARIANT',
    fcVariantIdentifier,
  };
};

export interface MSPFcVersionMsg {
  code: MSPCodes.MSP_FC_VERSION;
  name: 'MSP_FC_VERSION';
  flightControllerVersion: string;
}

const parseFcVersion = (data: BuffDataView): MSPFcVersionMsg => ({
  code: MSPCodes.MSP_FC_VERSION,
  name: 'MSP_FC_VERSION',
  flightControllerVersion: `${data.readU8()}.${data.readU8()}.${data.readU8()}`,
});

export interface MSPBuildInfoMsg {
  code: MSPCodes.MSP_BUILD_INFO;
  name: 'MSP_BUILD_INFO';
  buildInfo: string;
}

const parseBuildInfo = (data: BuffDataView): MSPBuildInfoMsg => {
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

  return {
    code: MSPCodes.MSP_BUILD_INFO,
    name: 'MSP_BUILD_INFO',
    buildInfo: String.fromCharCode.apply(null, buff),
  };
};

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

interface MSPNameMsg {
  code: MSPCodes.MSP_NAME;
  name: 'MSP_NAME';
  value: string;
}

const parseName = (data: BuffDataView): MSPNameMsg => {
  let value: string = '';
  let char: number | null;
  for (let i = 0; i < data.length(); i++) {
    char = data.readU8();
    if (char === 0) {
      break;
    }
    value += String.fromCharCode(char);
  }
  return {
    code: MSPCodes.MSP_NAME,
    name: 'MSP_NAME',
    value,
  };
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

interface MSPSetNameMsg {
  code: MSPCodes.MSP_SET_NAME;
  name: 'MSP_SET_NAME';
}

const parseSetName = (data: BuffDataView): MSPSetNameMsg => ({
  code: MSPCodes.MSP_SET_NAME,
  name: 'MSP_SET_NAME',
});

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
      return parseSetBatteryConfig(data);
    case MSPCodes.MSP_MOTOR_CONFIG:
      return parseMotorConfig(data);
    case MSPCodes.MSP_DISPLAYPORT:
      return parseDisplayPort(data);
    case MSPCodes.MSP_SET_RAW_RC:
      return parseSetRawRC(data);
    case MSPCodes.MSP_SET_PID:
      return parseSetPID(data);
    case MSPCodes.MSP_SET_RC_TUNING:
      return parseSetRCTuning(data);
    case MSPCodes.MSP_ACC_CALIBRATION:
      return parseAccCalibration(data);
    case MSPCodes.MSP_MAG_CALIBRATION:
      return parseMagCalibration(data);
    case MSPCodes.MSP_SET_MOTOR_CONFIG:
      return parseSetMotorConfig(data);
    case MSPCodes.MSP_SET_GPS_CONFIG:
      return parseSetGPSConfig(data);
    case MSPCodes.MSP_SET_GPS_RESCUE:
      return parseSetGPSRescue(data);
    case MSPCodes.MSP_SET_RSSI_CONFIG:
      return parseSetRSSIConfig(data);
    case MSPCodes.MSP_SET_FEATURE_CONFIG:
      return parseSetFeatureConfig(data);
    case MSPCodes.MSP_SET_BEEPER_CONFIG:
      return parseSetBeeperConfig(data);
    case MSPCodes.MSP_RESET_CONF:
      return parseResetConf(data);
    case MSPCodes.MSP_SELECT_SETTING:
      return parseSelectSetting(data);
    case MSPCodes.MSP_SET_SERVO_CONFIGURATION:
      return parseSetServoConfiguration(data);
    case MSPCodes.MSP_EEPROM_WRITE:
      return parseEepromWrite(data);
    case MSPCodes.MSP_SET_CURRENT_METER_CONFIG:
      return parseSetCurrentMeterConfig(data);
    case MSPCodes.MSP_SET_VOLTAGE_METER_CONFIG:
      return parseSetVoltageMeterConfig(data);
    case MSPCodes.MSP_SET_MOTOR:
      return parseSetMotor(data);
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
      return parseSetName(data);
    case MSPCodes.MSP_API_VERSION:
      return parseApiVersion(data);
    case MSPCodes.MSP_FC_VARIANT:
      return parseFcVariant(data);
    case MSPCodes.MSP_FC_VERSION:
      return parseFcVersion(data);
    case MSPCodes.MSP_BUILD_INFO:
      return parseBuildInfo(data);
    case MSPCodes.MSP_BOARD_INFO:
      return parseBoardInfo(data);
    case MSPCodes.MSP_NAME:
      return parseName(data);
    default:
      return undefined;
  }
};

export type MSPMsg = ReturnType<typeof parseIncomingBuff>;
