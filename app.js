const Srf = require('drachtio-srf');
const srf = new Srf();const config = require('config');
const logger = require('pino')(config.get('logging'));
const regParser = require('drachtio-mw-registration-parser') ;
const {digestChallenge} = require('./lib/middleware');
const Registrar = require('./lib/registrar');
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
srf.on('connect', (err, hp) => {
  if (err) throw err;
  logger.info(`connected to drachtio listening on ${hp}`);
});
if (process.env.NODE_ENV !== 'test') {
  srf.on('error', (err) => logger.error(err));
}

// middleware
srf.use('register', [digestChallenge(logger), regParser]);
srf.use('invite', digestChallenge(logger));

srf.invite(require('./lib/invite')({logger}));
srf.register(require('./lib/register')({logger}));
srf.options(require('./lib/options')({logger}));
srf.subscribe(require('./lib/subscribe')({logger}));
srf.publish(require('./lib/publish')({logger}));
srf.message(require('./lib/message')({logger}));

module.exports = {srf};
