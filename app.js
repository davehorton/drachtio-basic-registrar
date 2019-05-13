const config = require('config');
const Srf = require('drachtio-srf');
const srf = new Srf();
const logger = require('pino')(config.get('logging'));
const regParser = require('drachtio-mw-registration-parser') ;
const {digestChallenge} = require('./lib/middleware');
const Registrar = require('./lib/registrar');
const Mrf = require('drachtio-fsmrf');
let siprec = false;
if (config.has('siprec.enabled') && config.get('siprec.enabled') === true) {
  siprec = true;
}

srf.locals.registrar = new Registrar(logger);

// disable logging in test mode

if (process.env.NODE_ENV === 'test') {
  const noop = () => {};
  logger.info = logger.debug = noop;
  logger.child = function() {
    return {info: noop, error: noop, debug: noop};
  };
}

srf.connect(config.get('drachtio'));
srf.on('connect', async(err, hp) => {
  if (err) throw err;
  logger.info(`connected to drachtio listening on ${hp}`);

  if (siprec) {
    const mrf = new Mrf(srf);
    const {LoadBalancer} = require('drachtio-fn-fsmrf-sugar');
    srf.locals.lb = new LoadBalancer();
    srf.locals.lb.start({servers: config.get('siprec.freeswitch'), logger, mrf});
  }
});
if (process.env.NODE_ENV !== 'test') {
  srf.on('error', (err) => logger.error(err));
}

// middleware
srf.use('register', [digestChallenge(logger), regParser]);
srf.use('invite', digestChallenge(logger));

srf.invite((siprec ? require('./lib/invite-siprec') : require('./lib/invite'))({logger}));
srf.register(require('./lib/register')({logger}));
srf.options(require('./lib/options')({logger}));
srf.subscribe(require('./lib/subscribe')({logger}));
srf.publish(require('./lib/publish')({logger}));
srf.message(require('./lib/message')({logger}));

module.exports = {srf};
