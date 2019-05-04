const auth = require('drachtio-mw-digest-auth') ;
const parseUri = require('drachtio-srf').parseUri;
const {isValidDomain, getUserPassword} = require('./userdb');

function digestChallenge({logger}) {
  return auth({
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
}

module.exports = {
  digestChallenge
};
