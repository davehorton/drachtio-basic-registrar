const parseUri = require('drachtio-srf').parseUri;
const config = require('config');
const Client = require('rtpengine-client').Client ;
const {isWSS, isPstnDestination} = require('./utils');
const {getSipUserForDid} = require('./userdb');
const {addFork, removeFork} = require('./siprec-client');
const rtpengine = new Client();
const offer = rtpengine.offer.bind(rtpengine, config.get('rtpengine'));
const answer = rtpengine.answer.bind(rtpengine, config.get('rtpengine'));
const del = rtpengine.delete.bind(rtpengine, config.get('rtpengine'));
const SipError = require('drachtio-srf').SipError;
const assert = require('assert');

module.exports = handler;

function handler({logger}) {
  return async(req, res) => {
    const srf = req.srf;
    const registrar = req.srf.locals.registrar;
    const uri = parseUri(req.uri);
    let from = req.get('From');

    if (process.env.NODE_ENV !== 'test') logger = logger.child({'Call-ID': req.get('Call-ID')});

    logger.info(uri, `received ${req.method} from ${req.protocol}/${req.source_address}:${req.source_port}`);

    // figure out direction and transcoding needs of the call
    const response = await registrar.query(req.uri);
    logger.debug(uri, `query ${req.uri} returned ${JSON.stringify(response)}`);
    const srcIsUsingSrtp = isWSS(req);
    let dstIsUsingSrtp = response && response.protocol && response.protocol.startsWith('ws');
    const dstIsPstn = isPstnDestination(req);
    const sipUser = dstIsPstn ? getSipUserForDid(uri.user) : null;

    // determine where to send the call
    let dest;
    const auth = {};
    if (response) {
      dest = response.contact;
      logger.info(`call to a registered sip client at uri ${dest}`);
    }
    else if (sipUser) {
      const response = await registrar.query(sipUser);
      if (!response) return res.send(480, 'User Temporarily Unavailable');
      dest = response.contact;
      dstIsUsingSrtp = response.protocol && response.protocol.startsWith('ws');
      logger.info(`PSTN call to ${uri.user} routing to a registered sip client at uri ${dest}`);
    }
    else if (dstIsPstn) {
      const sipTrunk = config.get('sip-trunks.outbound');
      const hp = `${sipTrunk.host}:${sipTrunk.port || 5060}`;
      dest = `sip:${uri.user}@${hp}`;
      if (sipTrunk['default-ani']) {
        from = `<sip:${sipTrunk['default-ani']}@localhost>`;
      }
      logger.info(`call to a pstn number ${dest}`);
      if (sipTrunk.auth && sipTrunk.auth.username) Object.assign(auth, sipTrunk.auth);
    }
    else {
      logger.info(`incoming call to an unknown user ${req.uri}`);
      return res.send(404);
    }

    const mservers = srf.locals.lb.getLeastLoaded();
    assert(mservers.length > 0);

    logger.debug(uri, `this call will be using media server at ${mservers[0].address}`);

    const optsA = makeRtpEngineOpts(req, srcIsUsingSrtp, false);
    const bridgeA = {
      ms: mservers[0],
      srcIsUsingSrtp: srcIsUsingSrtp,
      dstIsUsingSrtp: false,
      rtpEngineOpts: optsA,
      deleteProxyFn: del.bind(rtpengine, optsA.common),
      sdp: [req.body, null, null, null]
    } ;
    const bridgeB = {
      ms: mservers[0],
      srcIsUsingSrtp: false,
      dstIsUsingSrtp: dstIsUsingSrtp,
      sdp:[null, null, null, null]
    } ;

    // here we go
    try {
      // setup (almost all) of our endpoints
      await bridgeA_offer(logger, bridgeA);
      await bridgeA_answer(logger, bridgeA);
      await bridgeB_offer(logger, bridgeB);
      await bridge_A_and_B(logger, bridgeA, bridgeB);

      // now ready to outdial
      const {uas, uac} = await srf.createB2BUA(req, res, dest, {
        localSdpB: bridgeB.sdp[2],
        localSdpA: produceSdpUas.bind(null, logger, srf, req, bridgeA, bridgeB, answer, bridgeB.rtpEngineOpts.answer),
        proxyRequestHeaders: ['to', 'supported', 'allow', 'content-type', 'user-agent'],
        proxyResponseHeaders: ['accept', 'allow', 'allow-events'],
        headers: { from },
        auth
      });

      logger.info('call successfully connected');
      uas.other = uac;
      uac.other = uas;
      if (config.has('siprec.srs.host')) {
        uas.forkUUID = uac.forkUUID = req.get('Call-ID');
      }
      setHandlers(logger, uas, uac, bridgeA, bridgeB);
    } catch (err) {
      if (err instanceof SipError) {
        logger.info(`Failed connecting outbound call sip status: ${err.status}`);
      }
      else logger.error(err, 'Error connecting call');
      bridge_cleanup(bridgeA);
      bridge_cleanup(bridgeB);
    }
  };
}

async function bridgeA_offer(logger, bridge) {
  const response = await offer(bridge.rtpEngineOpts.offer);
  if ('ok' !== response.result) throw new Error(`failed allocating rtpe endpoint: ${JSON.stringify(response)}`);
  logger.debug(`response from rtpengine bridgeA_offer: ${JSON.stringify(response)}`);
  return bridge.sdp[2] = response.sdp;
}
async function bridgeA_answer(logger, bridge) {
  bridge.ep = await bridge.ms.createEndpoint({remoteSdp: bridge.sdp[2]});
  bridge.sdp[3] = bridge.ep.local.sdp;
  const from = bridge.ep.dialog.req.getParsedHeader('from');
  const opts = Object.assign({}, bridge.rtpEngineOpts.answer, {
    'sdp': bridge.sdp[3],
    'to-tag': from.params.tag
  });
  const response = await answer(opts);
  if ('ok' !== response.result) throw new Error(`failed allocating rtpe endpoint: ${JSON.stringify(response)}`);
  logger.debug(`response from rtpengine bridgeA_answer: ${JSON.stringify(response)}`);
  return bridge.sdp[1] = response.sdp;
}
async function bridgeB_offer(logger, bridge) {
  bridge.ep = await bridge.ms.createEndpoint();
  const from = bridge.ep.dialog.req.getParsedHeader('from');
  const dlg = bridge.ep.dialog;
  bridge.sdp[0] = bridge.ep.local.sdp;
  const common = {'call-id': dlg.sip.callId, 'from-tag': from.params.tag};
  const rtpCharacteristics = config.get('transcoding.rtpCharacteristics');
  const srtpCharacteristics = config.get('transcoding.srtpCharacteristics');
  bridge.rtpEngineOpts = {
    common,
    offer: Object.assign({'sdp': bridge.sdp[0], 'replace': ['origin', 'session-connection']}, common,
      bridge.dstIsUsingSrtp ? srtpCharacteristics : rtpCharacteristics),
    answer: Object.assign({}, common, bridge.srcIsUsingSrtp ? srtpCharacteristics : rtpCharacteristics)
  };
  bridge.deleteProxyFn = del.bind(rtpengine, common);

  const response = await offer(bridge.rtpEngineOpts.offer);
  if ('ok' !== response.result) throw new Error(`failed allocating rtpe endpoint: ${JSON.stringify(response)}`);
  logger.debug(`response from rtpengine bridgeB_offer: ${JSON.stringify(response)}`);
  return bridge.sdp[2] = response.sdp;
}
async function bridge_A_and_B(logger, bridgeA, bridgeB) {
  await bridgeA.ep.bridge(bridgeB.ep);
}
function bridge_cleanup(bridge) {
  if (bridge.deleteProxyFn) bridge.deleteProxyFn();
  if (bridge.ep) bridge.ep.destroy();
}
async function produceSdpUas(logger, srf, req, bridgeA, bridgeB, answer, opts, remoteSdp, res) {
  bridgeB.sdp[3] = remoteSdp;
  Object.assign(opts, {'sdp': remoteSdp, 'to-tag': res.getParsedHeader('To').params.tag});
  const response = await answer(opts);
  logger.debug(`response from rtpengine bridgeB_answer: ${JSON.stringify(response)}`);
  bridgeB.sdp[1] = response.sdp;
  bridgeB.ep.modify(bridgeB.sdp[1]);

  // fork audio to siprec server
  if (config.has('siprec.srs.host')) {
    const forkUri =
    `sip:${config.get('siprec.srs.host')}:${config.has('siprec.srs.port') ? config.get('siprec.srs.port') : 5060}`;
    addFork(req.get('Call-ID'), {
      logger,
      srf,
      ms: bridgeA.ms,
      req,
      epA: bridgeA.ep,
      epB: bridgeB.ep,
      forkUri
    });
  }

  return bridgeA.sdp[1];
}

function makeRtpEngineOpts(req, srcIsUsingSrtp, dstIsUsingSrtp) {
  const from = req.getParsedHeader('from');
  const common = {'call-id': req.get('Call-ID'), 'from-tag': from.params.tag};
  const rtpCharacteristics = config.get('transcoding.rtpCharacteristics');
  const srtpCharacteristics = config.get('transcoding.srtpCharacteristics');
  return {
    common,
    offer: Object.assign({'sdp': req.body, 'replace': ['origin', 'session-connection']}, common,
      dstIsUsingSrtp ? srtpCharacteristics : rtpCharacteristics),
    answer: Object.assign({}, common, srcIsUsingSrtp ? srtpCharacteristics : rtpCharacteristics)
  };
}

function setHandlers(logger, uas, uac, bridgeA, bridgeB) {
  [uas, uac].forEach((dlg) => {

    // one side or the other hangs up
    dlg.on('destroy', () => {
      logger.info('call ended');
      dlg.other.destroy();
      bridge_cleanup(bridgeA);
      bridge_cleanup(bridgeB);
      if (dlg.forkUUID) removeFork(dlg.forkUUID);
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
