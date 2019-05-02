const parseUri = require('drachtio-srf').parseUri;

function uacIsBehindNat(req) {
  const via = req.getParsedHeader('Via');

  console.log(`${req.method} from ${req.source_address}:${req.source_port} via ${JSON.stringify(via)}`);


  return false;
}

module.exports = {
  uacIsBehindNat
};
