const auth = require('drachtio-mw-digest-auth') ;
const config = require('config');
const parseUri = require('drachtio-srf').parseUri;
const assert = require('assert');
const clearRequire = require('clear-require');
const fs = require('fs');
const path = require('path');
const domains = new Map() ;
const dids = new Map();

// initialize data: 
//    domains => users => {username / password / dids}
//    dids => {domain / username }
function initData() {
  domains.clear();
  dids.clear();

  config.get('domains').forEach((d) => {
    const users = new Map();
    d.users.forEach((u) => {
      users.set(u.username, u);
      (u.dids || []).forEach((did) => dids.set(did, {domain: d, username: u.username}));
    });
    domains.set(d.name, users);
  });
}

function digestChallenge({logger}) {
  return auth({
    realm: (req) => {
      const uri = parseUri(req.uri);
      return domains.has(uri.host) ? uri.host : null;
    },
    passwordLookup: (username, realm, callback) => {
      assert(domains.has(realm));
      const d = domains.get(realm);
      if (d.has(username)) return callback(null, d.get(username).password);
      return callback(new Error(`unknown user ${username}`));
    }
  });
}

fs.watch(path.resolve(__dirname, '..', 'config'), (event, filename) => {
  if (event === 'change' && filename.endsWith('.json')) {
    clearRequire('config');
    initData();
  }
});
initData();

module.exports = {
  digestChallenge
};
