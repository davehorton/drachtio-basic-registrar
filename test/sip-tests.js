const test = require('blue-tape');
const { output, sippUac } = require('./sipp')('test_drachtio-basic-registrar');
const debug = require('debug')('drachtio:drachtio-basic-registrar');
const clearModule = require('clear-require');

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

test('invite handler', (t) => {
  clearModule('../app');
  const {srf, disconnectMs} = require('../app');

  connect(srf)
    .then(() => {
      return sippUac('uac-pcap.xml');
    })
    .then(() => {
      t.pass('successfully connected call');
      if (srf.locals.lb) srf.locals.lb.disconnect();
      srf.disconnect();
      t.end();
      return;
    })
    .catch((err) => {
      if (srf.locals.lb) srf.locals.lb.disconnect();
      if (srf) srf.disconnect();
      console.log(`error received: ${err}`);
      t.error(err);
    });
});

test('register handler', (t) => {
  clearModule('../app');
  const {srf} = require('../app');

  connect(srf)
    .then(() => {
      return sippUac('uac-register-expect-480.xml');
    })
    .then(() => {
      t.pass('register handler passed');
      if (srf.locals.lb) srf.locals.lb.disconnect();
      srf.disconnect();
      t.end();
      return;
    })
    .catch((err) => {
      if (srf.locals.lb) srf.locals.lb.disconnect();
      if (srf) srf.disconnect();
      console.log(`error received: ${err}`);
      t.error(err);
    });
});
test('subscribe handler', (t) => {
  clearModule('../app');
  const {srf} = require('../app');

  connect(srf)
    .then(() => {
      return sippUac('uac-subscribe-expect-480.xml');
    })
    .then(() => {
      t.pass('subscribe handler passed');
      if (srf.locals.lb) srf.locals.lb.disconnect();
      srf.disconnect();
      t.end();
      return;
    })
    .catch((err) => {
      if (srf.locals.lb) srf.locals.lb.disconnect();
      if (srf) srf.disconnect();
      console.log(`error received: ${err}`);
      t.error(err);
    });
});
test('options handler', (t) => {
  clearModule('../app');
  const {srf} = require('../app');

  connect(srf)
    .then(() => {
      return sippUac('uac-options-expect-480.xml');
    })
    .then(() => {
      t.pass('options handler passed');
      if (srf.locals.lb) srf.locals.lb.disconnect();
      srf.disconnect();
      t.end();
      return;
    })
    .catch((err) => {
      if (srf.locals.lb) srf.locals.lb.disconnect();
      if (srf) srf.disconnect();
      console.log(`error received: ${err}`);
      t.error(err);
    });
});
test('publish handler', (t) => {
  clearModule('../app');
  const {srf} = require('../app');

  connect(srf)
    .then(() => {
      return sippUac('uac-publish-expect-480.xml');
    })
    .then(() => {
      t.pass('publish handler passed');
      if (srf.locals.lb) srf.locals.lb.disconnect();
      srf.disconnect();
      t.end();
      return;
    })
    .catch((err) => {
      if (srf.locals.lb) srf.locals.lb.disconnect();
      if (srf) srf.disconnect();
      console.log(`error received: ${err}`);
      t.error(err);
    });
});
test('message handler', (t) => {
  clearModule('../app');
  const {srf} = require('../app');

  connect(srf)
    .then(() => {
      return sippUac('uac-message-expect-480.xml');
    })
    .then(() => {
      t.pass('message handler passed');
      if (srf.locals.lb) srf.locals.lb.disconnect();
      srf.disconnect();
      t.end();
      return;
    })
    .catch((err) => {
      if (srf.locals.lb) srf.locals.lb.disconnect();
      if (srf) srf.disconnect();
      console.log(`error received: ${err}`);
      t.error(err);
    });
});
