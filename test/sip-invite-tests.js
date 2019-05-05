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

test('invite tests', (t) => {
  clearModule('../app');
  const {srf} = require('../app');

  let p;
  connect(srf)
    .then(() => sippUac('uac-register-then-call-404.xml'))
    .then(() => t.pass('returns 404 when called party is not registered'))
    .then(() => {
      p = sippUac('uac-register-then-call.xml', {sleep: '1000ms'});
      return;
    })
    .then(() => sippUac('uas-register.xml', {ip: '172.38.0.20'}))
    .then(() => t.pass('called party registered ok'))
    .then(() => sippUac('uas.xml', {ip: '172.38.0.20'}))
    .then(() => p)
    .then(() => t.pass('completes call between two registered sip endpoints'))
    .then(() => sippUac('uac-call-sip-trunk.xml'))
    .then(() => t.pass('completes call to sip trunking provider'))
    .then(() => {
      p = sippUac('uac-incoming-pstn-call.xml', {sleep: '1000ms'});
      return;
    })
    .then(() => sippUac('uas-register.xml', {ip: '172.38.0.21'}))
    .then(() => t.pass('called party registered ok'))
    .then(() => sippUac('uas.xml', {ip: '172.38.0.21'}))
    .then(() => p)
    .then(() => t.pass('completes incoming call from sip trunking provider'))
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
