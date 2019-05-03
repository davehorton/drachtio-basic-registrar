const parseUri = require('drachtio-srf').parseUri;

function isUacBehindNat(req) {

  // no need for nat handling wss or tcp being used
  if (req.protocol !== 'udp') return false;

  const via = req.getParsedHeader('Via');
  const contact = req.getParsedHeader('Contact');

  console.log(`${req.method} from ${req.source_address}:${req.source_port} via ${JSON.stringify(via)}`);
  console.log(`contact ${JSON.stringify(contact)}`);

  const uri = parseUri(contact[0].uri);
  if (uri.host !== via[0].received) return true;
  return false;
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
