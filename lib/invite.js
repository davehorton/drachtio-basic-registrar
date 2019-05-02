const parseUri = require('drachtio-srf').parseUri;

module.exports = handler;

function handler({logger}) {
  return async(req, res) => {
    const srf = req.srf;
    const uri = parseUri(req.uri);
    logger.info(uri, `received ${req.method} from ${req.protocol}/${req.source_address}:${req.source_port}`);
    try {
      const mediaservers = srf.locals.lb.getLeastLoaded();
      const ms = mediaservers[0];
      logger.info(`selected freeswitch media server at ${ms.address}`);
      const {endpoint, dialog} = await ms.connectCaller(req, res);
      dialog.on('destroy', () => {
        endpoint.destroy();
      });
    } catch (err) {
      logger.error(err, 'Error connecting call');
    }
  };
}
