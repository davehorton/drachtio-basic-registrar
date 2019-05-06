const parseUri = require('drachtio-srf').parseUri;

function isUacBehindNat(req) {

  // no need for nat handling wss or tcp being used
  if (req.protocol !== 'udp') return false;

  // let's keep it simple -- if udp, let's crank down the register interval
  return true;
  /*
  const contact = req.getParsedHeader('Contact');

  const uri = parseUri(contact[0].uri);
  if (uri.host !== req.source_address) return true;
  return false;
  */
}

function isWSS(req) {
  return req.getParsedHeader('Via')[0].protocol.toLowerCase().startsWith('ws');
}

function getViaProtocol(req) {
  return req.getParsedHeader('Via')[0].protocol.toLowerCase();
}

function isPstnDestination(req) {
  const uri = parseUri(req.uri);
  return uri.user.startsWith('+') || uri.user.length >= 10;
}

module.exports = {
  isUacBehindNat,
  isWSS,
  getViaProtocol,
  isPstnDestination
};
