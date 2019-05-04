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

test('register tests', (t) => {
  clearModule('../app');
  const {srf} = require('../app');

  connect(srf)
    .then(() => sippUac('uac-register-no-nat.xml'))
    .then(() => t.pass('leaves Expires value in place if client is not behind nat'))
    .then(() => sippUac('uac-register-nat.xml'))
    .then(() => t.pass('reduces Expires value if client is behind nat'))
    .then(() => sippUac('uac-register-unknown-domain.xml'))
    .then(() => t.pass('returns 403 if sip domain is not configured'))

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
