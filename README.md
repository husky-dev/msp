# Multiwii Serial Protocol

Library for communicating with a Multiwii flight controller using the Multiwii Serial Protocol (MSP).

## Installation

To install the library, run the following command:

```bash
yarn add @husky-dev/msp
# or
npm install @husky-dev/msp
```

## Usage

To use the library, you can follow the example below:

```ts
import { MultiwiiSerialProtocol, MSPMsg } from '@husky-dev/msp';

const main = async () => {
  const msp = new MultiwiiSerialProtocol({
    path: '/dev/tty.usbmodem0x80000001',
    baudRate: 115200,
  });

  msp.on('connect', async () => {
    console.log('connected');
    console.log('beeper config', await msp.getBeeperConfig());
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
```

## Testing

To test the library, run the following command:

```bash
yarn test
```

## Contact

[jaro@husky-dev.me](mailto:jaro@husky-dev.me)
