const transform = require('sdp-transform');
const SipError = require('drachtio-srf').SipError;
const {payloadCombiner} = require('./utils');
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
  let uacSipRec;
  const boundary = 'myUniqueBoundary';
  try {

    // (1) create two new endpoints, epC and epD
    [epC, epD] = await Promise.all([ms.createEndpoint(), ms.createEndpoint()]);

    // (2) configure epC to eavesdrop on epA, ditto epD => epB
    epC.set('eavesdrop_bridge_aleg', true);
    epD.set('eavesdrop_bridge_aleg', true);
    epC.execute('eavesdrop', [epA.uuid]);
    epD.execute('eavesdrop', [epB.uuid]);

    // (3) send SIPREC INVITE
    debug(`sending SIPREC INVITE to ${forkUri}`);
    const siprecBody = payloadCombiner(logger, req, epC.local.sdp, epD.local.sdp, boundary);
    uacSipRec = await srf.createUAC(forkUri, {
      localSdp: siprecBody,
      headers: {
        'Content-Type': `multipart/mixed;boundary=${boundary}`
      }
    });

    // (4) parse out two remote media endpoints and modify epC/epD to stream there
    const arr = /^([^]+)(m=[^]+?)(m=[^]+?)$/.exec(uacSipRec.remote.sdp) ;
    const sdp1 = `${arr[1]}${arr[2]}` ;
    const sdp2 = `${arr[1]}${arr[3]}` ;

    await Promise.all([epC.modify(sdp1), epD.modify(sdp2)]);
    logger.info('SIPREC audio streams successfully connected');

    // check for some race conditions: while we were hooking up the fork,
    //   (a) the caller may have hung up before connecting, or
    //   (b) the call might have been answered and quickly hung up already.
    const deleteNow = req.cancelled || forks.get(uuid) === FORK_DELETE_FAILED;
    forks.set(uuid, {epC, epD, uacSipRec});

    // check if caller hung up while we were doing this
    if (deleteNow) {
      logger.info('removing fork since caller hung up or call ended before fork');
      removeFork(uuid);
    }
  } catch (err) {
    [epC, epD, uacSipRec].forEach((r) => r && r.destroy());

    if (err instanceof SipError) {
      logger.error(`Error connecting SIPREC INVITE: ${err.status}`);
    }
    else logger.error(err, 'Error establishing fork');
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
