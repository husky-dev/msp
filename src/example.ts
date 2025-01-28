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
    // console.log('getStatus', await msp.getStatus());
    // console.log('getStatusEx', await msp.getStatusEx());
    // console.log('getRawIMU', await msp.getRawIMU());
    // console.log('getServo', await msp.getServo());
    // console.log('getMotor', await msp.getMotor());
    // console.log('getRc', await msp.getRc());
    // console.log('getRawGPS', await msp.getRawGPS());
    // console.log('getCompGPS', await msp.getCompGPS());
    // console.log('getApiVersion', await msp.getApiVersion());
    // console.log('getFcVariant', await msp.getFcVariant());
    // console.log('getFcVersion', await msp.getFcVersion())2;
    // console.log('getBuildInfo', await msp.getBuildInfo());
    // console.log('getBoardInfo', await msp.getBoardInfo());
    console.log('getName', await msp.getName());
    // console.log('beeper config', await msp.getBeeperConfig());
  };

  await msp.connect();
};

main();
