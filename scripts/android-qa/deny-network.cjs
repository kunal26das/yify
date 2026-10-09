const net = require('node:net');
const dgram = require('node:dgram');
const dns = require('node:dns');
const {syncBuiltinESMExports} = require('node:module');

const denied = () => { throw new Error('Android mocked QA refuses live network access'); };
net.Socket.prototype.connect = denied;
dgram.Socket.prototype.send = denied;
dgram.Socket.prototype.connect = denied;
dns.lookup = denied;
dns.resolve = denied;
dns.promises.lookup = denied;
dns.promises.resolve = denied;
globalThis.fetch = denied;
syncBuiltinESMExports();
