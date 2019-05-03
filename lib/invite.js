const parseUri = require('drachtio-srf').parseUri;
const config = require('config');
const Client = require('rtpengine-client').Client ;
const {isWSS, isPstnDestination} = require('./utils');
const rtpengine = new Client();
const offer = rtpengine.offer.bind(rtpengine, config.get('rtpengine'));
const answer = rtpengine.answer.bind(rtpengine, config.get('rtpengine'));
const del = rtpengine.delete.bind(rtpengine, config.get('rtpengine'));

module.exports = handler;

function handler({logger}) {
  return async(req, res) => {
    const srf = req.srf;
    const registrar = req.srf.locals.registrar;
    const uri = parseUri(req.uri);

    logger.info(uri, `received ${req.method} from ${req.protocol}/${req.source_address}:${req.source_port}`);

    // figure out direction and transcoding needs of the call
    const response = await registrar.query(req.uri);
    const srcIsUsingSrtp = isWSS(req);
    const dstIsUsingSrtp = response && response.protocol && response.protocol.startsWith('ws');
    const dstIsPstn = isPstnDestination(req);

    // determine where to send the call
    let dest;
    if (response) {
      dest = response.contact;
      logger.info(`call to a registered client at uri ${dest}`);
    }
    else if (dstIsPstn) {
      dest = `sip:${uri.user}@${config.get('sbc')}`;
      logger.info(`call to a pstn number ${dest}`);
    }
    else if (0 /*isDid*/) {

    }
    else {
      logger.info(`incoming call to an unknown user ${req.uri}`);
      return res.send(404);
    }

    // make the outbound call
    const rtpEngineOpts = makeRtpEngineOpts(req, srcIsUsingSrtp, dstIsUsingSrtp);
    const deleteProxyFn = del.bind(rtpengine, rtpEngineOpts.common);
    try {
      // allocate an endpoint on rtpengine
      const response = await offer(rtpEngineOpts.offer);
      if ('ok' !== response.result) throw new Error(`failed allocating rtpe endpoint: ${JSON.stringify(response)}`);

      const {uas, uac} = await srf.createB2BUA(req, res, dest, {
        localSdpA: produceSdpUas.bind(null, logger, answer, rtpEngineOpts.answer),
        localSdpB: response.sdp,
        proxyRequestHeaders: ['from', 'to', 'supported', 'allow', 'content-type', 'user-agent'],
        proxyResponseHeaders: ['accept', 'allow', 'allow-events']
      });

      logger.info('call successfully connected');
      uas.other = uac;
      uac.other = uas;
      setHandlers(logger, uas, uac, deleteProxyFn);
    } catch (err) {
      logger.error(err, 'Error connecting call');
      deleteProxyFn();
    }
  };
}

async function produceSdpUas(logger, answer, opts, remoteSdp, res) {
  Object.assign(opts, {'sdp': remoteSdp, 'to-tag': res.getParsedHeader('To').params.tag});

  try {
    const response = await answer(opts);
    logger.info(`rtpengine#answer returned ${JSON.stringify(response)}`);
    return response.sdp;  
  } catch (err) {
    logger.error(err, 'Error calling rtpengine#answer');
  }
}

const rtpCharacteristics = {
  'transport protocol': 'RTP/AVP',
  'DTLS': 'off',
  'SDES': 'off',
  'ICE': 'remove',
  'rtcp-mux': ['demux']
};
const srtpCharacteristics = {
  'transport-protocol': 'UDP/TLS/RTP/SAVPF',
  'ICE': 'force',
  'SDES': 'off',
  'flags': ['generate mid', 'SDES-no'],
  'rtcp-mux': ['require']
} ;

function makeRtpEngineOpts(req, srcIsUsingSrtp, dstIsUsingSrtp) {
  const from = req.getParsedHeader('from');
  const common = {'call-id': req.get('Call-ID'), 'from-tag': from.params.tag};

  return {
    common,
    offer: Object.assign({'sdp': req.body, 'replace': ['origin', 'session-connection']}, common,
      dstIsUsingSrtp ? srtpCharacteristics : rtpCharacteristics),
    answer: Object.assign({}, common, srcIsUsingSrtp ? srcIsUsingSrtp : rtpCharacteristics)
  };
}

function setHandlers(logger, uas, uac, deleteProxyFn) {
  [uas, uac].forEach((dlg) => {

    // one side or the other hangs up
    dlg.on('destroy', () => {
      logger.info('call ended');
      dlg.other.destroy();
      deleteProxyFn();
    });

    // proxy INFO to the other side
    dlg.on('info', (req, res) => {
      logger.info(`received info with content-type: ${req.get('Content-Type')}`);
      res.send(200) ;

      if (req.get('Content-Type') === 'application/media_control+xml') {
        dlg.other.request({
          method: 'INFO',
          headers: {
            'Content-Type': req.get('Content-Type'),
          },
          body: req.body
        });
      }
    });
  });
}
