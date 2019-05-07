const transform = require('sdp-transform');
const SipError = require('drachtio-srf').SipError;
const debug = require('debug')('drachtio:basic-registrar');
const FORK_IN_PROGRESS = 1;
const FORK_DELETE_FAILED = 2;
const forks = new Map();

/**
 * Make the SDP sendonly and remove all codecs except PCMU and RFC 2833
 */
function mungeSdp(sdp) {
  const obj = transform.parse(sdp);
  //debug(`sdp: ${JSON.stringify(obj)}`);
  obj.media[0].direction = 'sendonly';
  obj.media[0].rtp = obj.media[0].rtp.filter((rtp) => {
    return rtp.codec === 'PCMU' || (rtp.codec === 'telephone-event' && rtp.rate === 8000);
  });
  obj.media[0].fmtp = obj.media[0].fmtp.filter((fmtp) => fmtp.payload === 0 || fmtp.payload === 101);
  obj.media[0].payloads = '0 101';
  return transform.write(obj);
}
/**
 * Fork a call:
 *  create epC to mirror epA
 *  create epD to mirror epB
 *  eavesdrop C on A
 *  eavesdrop D on B
 *  outdial with local SDP epC
 *  outdial with local SDP epD
 */
async function addFork(uuid, opts) {
  if (forks.has(uuid)) {
    debug('fork already in place..');
    return;
  }

  forks.set(uuid, FORK_IN_PROGRESS);

  const {logger, srf, ms, req, epA, epB, forkUri} = opts;
  let epC, epD;
  let uacC, uacD;
  try {

    // (1) create two new endpoints, make them sendonly
    [epC, epD] = await Promise.all([ms.createEndpoint(), ms.createEndpoint()]);

    debug(`sending fork INVITEs to ${forkUri}`);

    // (2) send out INVITEs from these endpoints to the far end analytics server
    const promiseC = srf.createUAC(forkUri, {
      localSdp: mungeSdp(epC.local.sdp),
      headers: {
        'From': `sip:${req.callingNumber || 'anonymous'}@localhost`,
        'To': `sip:${req.calledNumber || 'anonymous'}@localhost`,
        'X-Session-ID': xhdrC
      }
    });
    const promiseD = srf.createUAC(forkUri, {
      localSdp: mungeSdp(epD.local.sdp),
      headers: {
        'From': `sip:${req.callingNumber || 'anonymous'}@localhost`,
        'To': `sip:${req.calledNumber || 'anonymous'}@localhost`,
        'X-Session-ID': xhdrD
      }
    });
    [uacC, uacD] = await Promise.all([promiseC, promiseD]);
    await Promise.all([epC.modify(uacC.remote.sdp), epD.modify(uacD.remote.sdp)]);
    debug('forked audio streams successfully connected');

    // (3) configure each of the new endpoints to eavesdrop on either caller or callee
    epC.set('eavesdrop_bridge_aleg', true);
    epD.set('eavesdrop_bridge_aleg', true);
    epC.execute('eavesdrop', [epA.uuid]);
    epD.execute('eavesdrop', [epB.uuid]);
    logger.info('forked audio streams successfully connected');

    // (4) relay dtmf coming in on the eavesdropped channels
    [{src: epA, dst: epC}, {src:epB, dst: epD}].forEach((p) => {
      p.src.on('dtmf', (d) => {
        logger.info(`received dmtf: ${JSON.stringify(d)}, generating ${d.dtmf}@${d.duration}`);
        p.dst.api('uuid_send_dtmf', `${p.dst.uuid} ${d.dtmf}`)
          //.then((result) => logger.info(`result: ${JSON.stringify(result)}`))
          .catch((err) => logger.error(err, 'error generating dtmf'));
      });
    });

    // check for some race conditions: while we were hooking up the fork,
    //   (a) the caller may have hung up before connecting, or
    //   (b) the call might have been answered and quickly hung up already.
    const deleteNow = req.cancelled || forks.get(uuid) === FORK_DELETE_FAILED;
    forks.set(uuid, {epC, epD, uacC, uacD});

    // check if caller hung up while we were doing this
    if (deleteNow) {
      logger.info('removing fork since caller hung up or call ended before fork');
      removeFork(uuid);
    }
  } catch (err) {
    [epC, epD, uacC, uacD].forEach((r) => r && r.destroy());

    if (err instanceof SipError) {
      logger.error(`Error connecting forked INVITE: ${err.status}`);
    }
    else logger.error(err, 'Error establishing fork: TODO: cleanup');
  }
}

function removeFork(uuid) {
  debug(`removing fork for uuid ${uuid}`);
  if (forks.has(uuid) && typeof forks.get(uuid) === 'object') {
    debug('deleting fork and associated media resources');
    Object.values(forks.get(uuid)).forEach((o) => o.destroy());
  }
  else {
    debug('not deleting fork because it does not exist or is in progress');
    forks.set(uuid, FORK_DELETE_FAILED);
  }
}

module.exports = {
  addFork,
  removeFork
};
