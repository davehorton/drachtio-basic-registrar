# drachtio-basic-registrar [![Build Status](https://secure.travis-ci.org/davehorton/drachtio-basic-registrar.png)](http://travis-ci.org/davehorton/drachtio-basic-registrar)

A SIP registrar built using [drachtio](https://drachtio.org) and [rtpengine](https://github.com/sipwise/rtpengine).

Features:

- supports sip clients connecting using udp, tcp, or websockets
- supports traversing nat firewalls
- supports webrtc clients and handles SRTP/RTP encrypt/decrypt
- connectable to your SIP trunking provider

## Installing

- install [drachtio](https://drachtio.org), [rtpengine](https://github.com/sipwise/rtpengine) and [redis](https://redis.io) somewhere in your network (drachtio and rtpengine must have public IP addresses),
- create a config file (see [config/default.json.example](config/default.json.example) for example settings),
- add your sip user credentials to the config file,
- assign DIDs to sip users in the config file, if you want to receive calls from the PSTN and route them to sip users,
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

## Status
Currently, this app just handles registrations and invites.  Planned next steps would be to handle presence-related messages (SUBSCRIBE, PUBLISH) and IM (Message) as well.

Hey, contributors are welcome!  Join in! :)