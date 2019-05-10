const uuidv4 = require('uuid/v4');
const moment = require('moment');
const parseUri = require('drachtio-srf').parseUri;
const CRLF = '\r\n';
const CRLF2 = '\r\n\r\n';

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

function payloadCombiner(logger, req, sdp1, sdp2, boundary) {
  const arr1 = /^([^]+)(c=[^]+)t=[^]+(m=[^]+?)(a=[^]+)$/.exec(sdp1) ;
  const arr2 = /^([^]+)(c=[^]+)t=[^]+(m=[^]+?)(a=[^]+)$/.exec(sdp2) ;

  const sdp = `${arr1[1]}${arr1[2]}t=0 0\r\n${arr1[3]}${arr1[4]}${arr2[3]}${arr2[4]}`;
    //.replace(/a=sendrecv\r\n/g, 'a=sendonly\r\n');

  const sessionId = uuidv4();
  const now = moment().format();
  const to = req.getParsedHeader('To');
  const toUri = parseUri(to.uri);
  const from = req.getParsedHeader('From');
  const fromUri = parseUri(from.uri);
  logger.debug(`from: ${JSON.stringify(fromUri)}`);
  logger.debug(`to: ${JSON.stringify(toUri)}`);
  const aorCaller = `sip:${fromUri.user ? fromUri.user + '@' : ''}${fromUri.host}`;
  const aorCallee = `sip:${toUri.user ? toUri.user + '@' : ''}${toUri.host}`;
  const ctSdp = 'Content-Type: application/sdp';
  const ctXml = 'Content-Type: application/rs-metadata+xml';
  const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<recording xmlns="urn:ietf:params:xml:ns:recording:1">
  <datamode>complete</datamode>
  <session session_id="${sessionId}">
    <sipSessionID>${req.get('Call-ID')}</sipSessionID>
    <start-time>${now}</start-time>
  </session>
  <participant participant_id="kQNhKFdEEeeJ99D/VsPGWA==">
    <nameID aor="${aorCaller}">
      <name>${from.name || ''}</name>
    </nameID>
  </participant>
  <participantsessionassoc participant_id="kQNhKFdEEeeJ99D/VsPGWA==" session_id="${sessionId}">
    <associate-time>${now}</associate-time>
  </participantsessionassoc>
  <stream stream_id="kQOH5VdEEeeJ/ND/VsPGWA==" session_id="kQNhKFdEEeeJ9tD/VsPGWA==">
    <label>1</label>
  </stream>
  <participant participant_id="kQNhKFdEEeeJ+ND/VsPGWA==">
    <nameID aor="${aorCallee}">
      <name>${to.name || ''}</name>
    </nameID>
  </participant>
  <participantsessionassoc participant_id="kQNhKFdEEeeJ+ND/VsPGWA==" session_id="${sessionId}">
    <associate-time>${now}</associate-time>
  </participantsessionassoc>
  <stream stream_id="kQOH5VdEEeeJ/dD/VsPGWA==" session_id="${sessionId}">
    <label>2</label>
  </stream>
  <participantstreamassoc participant_id="kQNhKFdEEeeJ99D/VsPGWA==">
    <send>kQOH5VdEEeeJ/ND/VsPGWA==</send>
    <recv>kQOH5VdEEeeJ/dD/VsPGWA==</recv>
  </participantstreamassoc>
  <participantstreamassoc participant_id="kQNhKFdEEeeJ+ND/VsPGWA==">
    <send>kQOH5VdEEeeJ/dD/VsPGWA==</send>
    <recv>kQOH5VdEEeeJ/ND/VsPGWA==</recv>
  </participantstreamassoc>
</recording>`.replace(/\n/g, CRLF);

  const payload = `--${boundary}${CRLF}${ctSdp}${CRLF2}${sdp}${CRLF}--${boundary}${CRLF}${ctXml}${CRLF2}${xmlData}${CRLF2}--${boundary}${CRLF}`;

  return payload;
}

module.exports = {
  isUacBehindNat,
  isWSS,
  getViaProtocol,
  isPstnDestination,
  payloadCombiner
};
