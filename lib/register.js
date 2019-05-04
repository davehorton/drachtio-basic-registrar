const parseUri = require('drachtio-srf').parseUri;
const {isUacBehindNat, isWSS} = require('./utils');
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
  const registrar = req.srf.locals.registrar;
  const registration = req.registration;
  let expires = registration.expires;
  let contact = req.getParsedHeader('Contact')[0].uri;
  let contactHdr = req.get('Contact');
  const protocol = isWSS(req) ? 'wss' : req.protocol;

  // reduce the registration interval if the device is behind a nat
  if (isUacBehindNat(req)) {
    const uri = parseUri(contact);
    expires = NAT_EXPIRES;
    contact = `sip:${uri.user}@${req.source_address}:${req.source_port}`;
    contactHdr = contactHdr.replace(/expires=\d+/, `expires=${expires}`);
  }
  await registrar.add(registration.aor, contact, protocol, expires);

  res.send(200, {
    headers: {
      'Contact': contactHdr,
      'Expires': expires
    }
  });
}

async function unregister(req, res) {
  const registrar = req.srf.locals.registrar;
  await registrar.remove(req.registration.aor);
  res.send(200, {
    headers: {
      'Contact': req.get('Contact'),
      'Expires': 0
    }
  });
}
