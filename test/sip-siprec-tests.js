const test = require('blue-tape');
const { output, sippUac } = require('./scripts/sipp')('test_drachtio-basic-registrar');
const debug = require('debug')('drachtio:drachtio-basic-registrar');
const clearModule = require('clear-module');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

function connect(connectable) {
  return new Promise((resolve, reject) => {
    connectable.on('connect', () => {
      return resolve();
    });
  });
}

test('invite w/ siprec tests', (t) => {
  clearModule('../app');
  clearModule('config');
  process.env.NODE_CONFIG_ENV = 'test-siprec';

  const {srf} = require('../app');

  let p;
  connect(srf)
    .then(() => {
      p = sippUac('uac-register-then-call.xml', {sleep: '1000ms'});
      return;
    })
    .then(() => sippUac('uas-register.xml', {ip: '172.38.0.20'}))
    .then(() => t.pass('called party registered ok'))
    .then(() => sippUac('uas.xml', {ip: '172.38.0.20'}))
    .then(() => p)
    .then(() => t.pass('completes call between two registered sip endpoints'))
    .then(() => srf.locals.lb.disconnect())
    .then(() => {
      srf.disconnect();
      t.end();
      return;
    })
    .catch((err) => {
      if (srf) srf.disconnect();
      console.log(`error received: ${err}`);
      t.error(err);
    });
});
