# drachtio-basic-registrar [![Build Status](https://secure.travis-ci.org/davehorton/drachtio-basic-registrar.png)](http://travis-ci.org/davehorton/drachtio-basic-registrar)

A SIP registrar built using [drachtio](https://drachtio.org) and [rtpengine](https://github.com/sipwise/rtpengine).

Features:

- supports sip clients over udp, tcp, wss
- supports sip clients behind a nat firewall
- supports webrtc clients and handles SRTP/RTP encrypt/decrypt as necessary
- connectable to your SIP trunking provider

## Installing

- install [drachtio](https://drachtio.org), [rtpengine](https://github.com/sipwise/rtpengine) and [redis](https://redis.io) somewhere in your network (drachtio and rtpengine must have public IP addresses),
- create a config file (see [config/default.json](config/default.json) for example settings),
- add your sip user credentials to the config file,
- add your SIP trunking provider details (If you have one) to the config file, then
```bash
$ npm install
$ npm start
```
Then point your sip phones and webrtc clients to the drachtio server and enjoy!

## Testing
```
npm test
```
