import { MultiwiiSerialProtocol, MSPCodes, MSPMsg } from './index';

// const port = new SerialPort({
//   path: '/dev/tty.usbmodem0x80000001',
//   baudRate: 115200,
//   dataBits: 8,
//   stopBits: 1,
//   parity: 'none',
//   autoOpen: false,
// });

const main = async () => {
  const msp = new MultiwiiSerialProtocol({
    path: '/dev/tty.usbmodem0x80000001',
    baudRate: 115200,
  });

  msp.on('connect', async () => {
    console.log('connected');
    // await msp.sendMessage(MSPCodes.MSP_API_VERSION);
    // await msp.sendMessage(MSPCodes.MSP_BOARD_INFO);
    // await msp.sendMessage(MSPCodes.MSP_STATUS);
    // await msp.sendMessage(MSPCodes.MSP_STATUS_EX);
    // await msp.sendMessage(MSPCodes.MSP_RC);
    // await msp.sendMessage(MSPCodes.MSP_RAW_IMU);
    // await msp.sendMessage(MSPCodes.MSP_RAW_GPS);
    // await msp.sendMessage(MSPCodes.MSP_COMP_GPS);
    // await msp.sendMessage(MSPCodes.MSP_ATTITUDE);
    // await msp.sendMessage(MSPCodes.MSP_SONAR);
    // await msp.sendMessage(MSPCodes.MSP_SERVO);
    // await msp.sendMessage(MSPCodes.MSP_MOTOR);
    // await msp.sendMessage(MSPCodes.MSP_MOTOR_TELEMETRY);
    // await msp.sendMessage(MSPCodes.MSP_ANALOG);
    // await msp.sendMessage(MSPCodes.MSP_VOLTAGE_METERS);
    // await msp.sendMessage(MSPCodes.MSP_CURRENT_METERS);
    // await msp.sendMessage(MSPCodes.MSP_BATTERY_STATE);
    // await msp.sendMessage(MSPCodes.MSP_VOLTAGE_METER_CONFIG);
    // await msp.sendMessage(MSPCodes.MSP_CURRENT_METER_CONFIG);
    // await msp.sendMessage(MSPCodes.MSP_BATTERY_CONFIG);

    // await msp.sendMessage(MSPCodes.MSP_NAME);
    // await msp.sendMessage(MSPCodes.MSP_FC_VARIANT);
    // await msp.sendMessage(MSPCodes.MSP_FC_VERSION);
    // await msp.sendMessage(MSPCodes.MSP_BUILD_INFO);
  });

  msp.on('disconnect', () => {
    console.log('disconnected');
  });

  msp.on('message', (msg: MSPMsg) => {
    console.log(msg);
  });

  await msp.connect();
};

main();
