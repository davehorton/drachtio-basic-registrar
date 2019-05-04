const config = require('config');
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
      (u.dids || []).forEach((did) => dids.set(did, `sip:${u.username}@${d.name}`));
    });
    domains.set(d.name, users);
  });
}
fs.watch(path.resolve(__dirname, '..', 'config'), (event, filename) => {
  if (event === 'change' && filename.endsWith('.json')) {
    clearRequire('config');
    initData();
  }
});
initData();

function isValidDomain(domain) {
  return domains.has(domain);
}

function getUserPassword(domain, username) {
  const d = domains.get(domain);
  if (d) {
    const u = d.get(username);
    if (u) return u.password;
  }
}

function getSipUserForDid(did) {
  return dids.get(did);
}

module.exports = {
  isValidDomain,
  getUserPassword,
  getSipUserForDid
};
