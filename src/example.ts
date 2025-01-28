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
    // console.log('api version', await msp.getApiVersion());
    // console.log('fc variant', await msp.getFcVariant());
    // console.log('fc version', await msp.getFcVersion());
    // console.log('board info', await msp.getBoardInfo());
    // console.log('build info', await msp.getBuildInfo());
    // console.log('getUid', await msp.getUid());
    // await msp.setName('SDUA_245925');

    // console.log('getMotor3DConfig', await msp.getMotor3DConfig());
    // console.log('getRcDeadbandConfig', await msp.getRcDeadbandConfig());
    // console.log('getGpsConfig', await msp.getGpsConfig());
    // console.log('getGpsSvInfo', await msp.getGpsSvInfo());
    // console.log('getVtxConfig', await msp.getVtxConfig());
    // console.log('getVtxTableBand', await msp.getVtxTableBand()); // Not supported
    // console.log('getVtxTablePowerLevel', await msp.getVtxTablePowerLevel()); // Not supported
    // console.log('getLedColors', await msp.getLedColors());
    // console.log('getLedStripModeColor', await msp.getLedStripModeColor());
    // console.log('getRxFailConfig', await msp.getRxFailConfig());
    // console.log('getRxMap', await msp.getRxMap());
    // console.log('getSensorConfig', await msp.getSensorConfig());
    // console.log('getSensorAlignment', await msp.getSensorAlignment());
    // console.log('getPid', await msp.getPid());
    console.log('getBlackboxConfig', await msp.getBlackboxConfig());

    // console.log('getGpsRescue', await msp.getGpsRescue()); // Debug
  };

  await msp.connect();
};

main();
