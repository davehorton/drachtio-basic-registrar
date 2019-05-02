const config = require('config');
const bluebird = require('bluebird');
const redis = require('redis');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);
const redisOpts = Object.assign('test' === process.env.NODE_ENV ?
  {retry_strategy: () => {}, disable_resubscribing: true} : {});

function makeUserKey(aor) {
  return `user:${aor}`;
}

class Registrar {
  constructor(logger) {
    this.logger = logger;
    this.client = redis.createClient(config.get('redis.port'), config.get('redis.address'), redisOpts);
    this.client
      .on('connect', () => {
        logger.info(`successfully connected to redis at ${config.get('redis.address')}:${config.get('redis.port')}`);
      })
      .on('error', (err) => {
        logger.error(err, 'redis connection error') ;
      });
  }

  add(aor, contact, expires) {
    this.logger.info(`Registrar: adding ${aor} from ${aor} for ${expires}`);
    return this.client
      .multi()
      .set(makeUserKey(aor), contact)
      .expire(expires)
      .execAsync();
  }

  async query(aor) {
    const result = await this.client.getAsync(makeUserKey(aor));
    this.logger.info(`Registrar: query for ${aor} returned ${result}`);
    return result;
  }

  remove(aor) {
    this.logger.info(`Registrar: removing ${aor}`);
    return this.delAsync(makeUserKey(aor));
  }
}

module.exports = Registrar;
