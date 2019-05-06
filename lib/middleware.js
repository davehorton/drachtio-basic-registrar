const auth = require('drachtio-mw-digest-auth') ;
const config = require('config');
const parseUri = require('drachtio-srf').parseUri;
const {isValidDomain, getUserPassword} = require('./userdb');
//const debug = require('debug')('drachtio:basic-registrar');

const authMW = auth({
  realm: (req) => {
    const uri = parseUri(req.uri);
    return isValidDomain(uri.host) ? uri.host : null;
  },
  passwordLookup: (username, realm, callback) => {
    const password = getUserPassword(realm, username);
    if (password) return callback(null, password);
    return callback(new Error(`unknown user ${username}`));
  }
});

function digestChallenge({logger}) {

  return (req, res, next) => {
    let skipAuth = false;

    // challenge all except INVITEs from our whitelisted inbound carriers
    if (req.method === 'INVITE' && config.has('sip-trunks.inbound')) {
      const inboundCarrierIps = config.get('sip-trunks.inbound');
      if (inboundCarrierIps.includes(req.source_address)) {
        skipAuth = true;
      }
    }

    if (skipAuth) return next();

    authMW(req, res, next);
  };
}

module.exports = {
  digestChallenge
};
