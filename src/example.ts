import { MultiwiiSerialProtocol, MSPCodes, MSPMsg } from './index';

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
    // await msp.sendMessage(MSPCodes.MSP_RC);
    // await msp.sendMessage(MSPCodes.MSP_RAW_IMU);

    // await msp.sendMessage(MSPCodes.MSP2_MOTOR_OUTPUT_REORDERING);
    // await msp.sendMessage(MSPCodes.MSP2_GET_VTX_DEVICE_STATUS);
    // await msp.sendMessage(MSPCodes.MSP_ALTITUDE);
    await msp.sendMessage(MSPCodes.MSP_SONAR);
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
