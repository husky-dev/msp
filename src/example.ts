import { MultiwiiSerialProtocol, MSPMsg } from './index';

const main = async () => {
  const ports = await MultiwiiSerialProtocol.list();
  if (!ports.length) return console.log('No ports found');
  const devices = ports.filter((itm) => itm.manufacturer === 'Betaflight');
  if (!devices.length) return console.log('No Betaflight devices found');
  const device = devices[0];
  const msp = new MultiwiiSerialProtocol({
    path: device.path,
    baudRate: 115200,
    // dataBits: 8,
    // stopBits: 1,
    // parity: 'none',
  });

  msp.on('connect', async () => {
    console.log('connected');
    await getInfo();
    await msp.disconnect();
  });

  msp.on('disconnect', () => {
    console.log('disconnected');
  });

  msp.on('message', (msg: MSPMsg) => {
    // console.log(msg);
  });

  const getInfo = async () => {
    console.log('api version', await msp.getApiVersion()); // { mspProtocolVersion: 0, apiVersion: '1.45.0' }
    console.log('fc variant', await msp.getFcVariant()); // BTFL
    console.log('fc version', await msp.getFcVersion()); // 4.4.3
    console.log('board info', await msp.getBoardInfo()); // { boardIdentifier: 'S405', boardVersion: 0, boardType: 2, targetCapabilities: 55, targetName: 'STM32F405', boardName: 'SPEEDYBEEF405V4', manufacturerId: 'SPBE', signature: [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ], mcuTypeId: 1 }
    console.log('build info', await msp.getBuildInfo()); // Nov 18 2023 06:49:34
    // uid
    console.log('getUid', await msp.getUid()); // 3000473533510c31303830

    // await msp.setName('SDUA_245925');
    console.log('getName', await msp.getName()); // SDUA_245925
    console.log('getStatus', await msp.getStatus());
    console.log('getStatusEx', await msp.getStatusEx());

    // Battery config
    // console.log('getBatteryConfig', await msp.getBatteryConfig());
    // Mode ranges
    // await msp.setModeRange(0, 1000, 2000);
    // console.log('getModeRanges', await msp.getModeRanges());
    // MSP_FEATURE_CONFIG
    // await msp.setFeatureConfig(0, 1);
    // console.log('getFeatureConfig', await msp.getFeatureConfig());

    // MSP_BOARD_ALIGNMENT_CONFIG
    // await msp.setBoardAlignmentConfig(0, 0, 0);
    // console.log('getBoardAlignmentConfig', await msp.getBoardAlignmentConfig());
    // MSP_CURRENT_METER_CONFIG
    // await msp.setCurrentMeterConfig(0, 0, 0, 0);
    // console.log('getCurrentMeterConfig', await msp.getCurrentMeterConfig()); //  [ { id: 10, sensorType: 1, scale: 400, offset: 0 }, { id: 80, sensorType: 0, scale: 0, offset: 0 } ]
    // MSP_MIXER_CONFIG
    // await msp.setMixerConfig(0, 0);
    // console.log('getMixerConfig', await msp.getMixerConfig());
    // MSP_RX_CONFIG
    // await msp.setRxConfig(0, 0, 0, 0, 0, 0, 0, 0, 0);
    // console.log('getRxConfig', await msp.getRxConfig());
    // MSP_LED_COLORS
    // await msp.setLedColors(0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    // console.log('getLedColors', await msp.getLedColors());
    // MSP_LED_STRIP_CONFIG
    // await msp.setLedStripConfig(0, 0, 0, 0, 0, 0, 0, 0);
    // console.log('getLedStripConfig', await msp.getLedStripConfig());
    // MSP_RSSI_CONFIG
    // await msp.setRssiConfig(0, 0, 0, 0);
    // console.log('getRssiConfig', await msp.getRssiConfig());
    // MSP_ADJUSTMENT_RANGES
    // await msp.setAdjustmentRanges(0, 0, 0, 0, 0, 0, 0, 0, 0);
    // console.log('getAdjustmentRanges', await msp.getAdjustmentRanges());
    // MSP_CF_SERIAL_CONFIG
    // await msp.setCfSerialConfig(0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    // console.log('getCfSerialConfig', await msp.getCfSerialConfig());
    // MSP_VOLTAGE_METER_CONFIG
    // await msp.setVoltageMeterConfig(0, 0, 0, 0, 0, 0, 0, 0, 0);
    // console.log('getVoltageMeterConfig', await msp.getVoltageMeterConfig()); // [{ id: 10, sensorType: 0, vbatscale: 110, vbatresdivval: 10, vbatresdivmultiplier: 1 }];
    // MSP_PID_CONTROLLER
    // await msp.setPidController(0);
    // console.log('getPidController', await msp.getPidController());
    // MSP_ARMING_CONFIG
    // await msp.setArmingConfig(0, 0, 0, 0, 0, 0, 0, 0);
    // console.log('getArmingConfig', await msp.getArmingConfig());

    // console.log('getRawIMU', await msp.getRawIMU());
    // console.log('getServo', await msp.getServo());
    // console.log('getServoConfigurations', await msp.getServoConfigurations()); // Error: Unknown MSP code: 771
    // console.log('getMotor', await msp.getMotor());
    // console.log('getMotorConfig', await msp.getMotorConfig());
    // console.log('getMotorTelemetry', await msp.getMotorTelemetry());
    // console.log('getRc', await msp.getRc());
    // console.log('getRawGPS', await msp.getRawGPS());
    // console.log('getCompGPS', await msp.getCompGPS());
    // console.log('beeper config', await msp.getBeeperConfig());
    // console.log('getAttitude', await msp.getAttitude());
    // console.log('getAltitude', await msp.getAltitude());
    // console.log('getSonar', await msp.getSonar());
    // console.log('getAnalog', await msp.getAnalog());
    // console.log('getVoltageMeters', await msp.getVoltageMeters());
    // console.log('getCurrentMeters', await msp.getCurrentMeters());
    console.log('getBatteryState', await msp.getBatteryState());
    console.log('getBatteryConfig', await msp.getBatteryConfig());
  };

  await msp.connect();
};

main();
