const parseUri = require('drachtio-srf').parseUri;
const {uacIsBehindNat} = require('./utils');
const NAT_EXPIRES = 30;

module.exports = handler;

function handler({logger}) {
  return (req, res) => {
    logger.info(`received ${req.method} from ${req.protocol}/${req.source_address}:${req.source_port}`);
    logger.info(req.registration, 'registration details');

    if ('register' === req.registration.type) return register(req, res);
    else return unregister(req, res);
  };
}

async function register(req, res) {
  const registrar = req.srf.registrar;
  const registration = req.registration;
  let expires = registration.expires;
  let contact = registration.aor;
  let contactHdr = req.get('Contact');

  if (uacIsBehindNat(req)) {
    const uri = parseUri(contact);
    expires = NAT_EXPIRES;
    contact = `sip:${uri.user}@${req.source_address}:${req.source_port}`;
    contactHdr = contactHdr.replace(/expires=\d+/, `expires=${expires}`);
  }
  await registrar.add(registration.aor, contact, expires);

  res.send(200, {
    headers: {
      'Contact': contactHdr
    }
  });
}

async function unregister(req, res) {
  const registrar = req.srf.registrar;
  await registrar.remove(req.registration.aor);
  res.send(200);
}
