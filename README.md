# dogstatsd-node

A node.js client for [Etsy](http://etsy.com)'s [StatsD](https://github.com/etsy/statsd) server extended with Datadog's histogram and tags.

Most of the code (including parts of this readme) is copied directly from the excellent https://github.com/sivy/node-statsd (v0.0.7), and the datadog parts wrote in by looking at https://github.com/joybro/node-dogstatsd, but with an added twist in the API.

IMPORTANT: This is not a drop-in replacement for node-statsd or node-dogstatsd, the API has changed.

This client will let you fire stats at your StatsD server from a node.js application.

dogstatsd-node Runs and is tested on Node 0.6+ on all *nix platforms and 0.8+ on all platforms including Windows.

[![Build Status](https://secure.travis-ci.org/vanchi-zendesk/dogstatsd-node.png?branch=master)](http://travis-ci.org/vanchi-zendesk/dogstatsd-node)

## Usage

All initialization parameters are optional.

Parameters (specified as an options hash):
* `host`:      The host to send stats to `default: localhost`
* `port`:      The port to send stats to `default: 8125`
* `prefix`:    What to prefix each stat name with `default: ''`
* `suffix`:    What to suffix each stat name with `default: ''`
* `globalize`: Expose this StatsD instance globally? `default: false`
* `dnsCache`:  Cache the initial dns lookup to *host* `default: false`
* `mock`:      Create a mock StatsD instance, sending no stats to the server? `default: false`

All StatsD/DataDog methods have the same API:
* `name`:       Stat name `required`
* `value`:      Stat value `required except in increment/decrement where it defaults to 1/-1 respectively`

which returns a Stat Object which can sent by calling .send() on them.
Additional options to the stat maybe chained by calling stat.sampleRate(value).tags(['x:1']) before sending.

If an array is specified as the `name` parameter each item in that array will be sent along with the specified value.

```javascript
  var StatsD = require('node-statsd').StatsD,
      client = new StatsD();

  // Timing: sends a timing command with the specified milliseconds
  client.timing('response_time', 42).send();

  // Increment: Increments a stat by a value (default is 1)
  client.increment('my_counter').send();

  // Decrement: Decrements a stat by a value (default is -1)
  client.decrement('my_counter').send();

  // Gauge: Gauge a stat by a specified amount
  client.gauge('my_gauge', 123.45).send();

  // Histogram: Datadog's histogram
  client.histogram('histogram', 10).send();

  // Set: Counts unique occurrences of a stat (alias of unique)
  client.set('my_unique', 'foobar').send();
  client.unique('my_unique', 'foobarbaz').send();

  // Incrementing multiple items
  client.increment(['these', 'are', 'different', 'stats']).send();

  // Sampling, this will sample 25% of the time the StatsD Daemon will compensate for sampling
  client.increment('my_counter', 1).sampleRate(0.25).send();

  // Datadog's Tags
  client.increment('my_counter', 1).tags(['host:xyz']).send();

  // Using the callback
  client.set(['foo', 'bar'], 42).send(function(error, bytes){
    //this only gets called once after all messages have been sent
    if(error){
      console.error('Oh noes! There was an error:', error);
    } else {
      console.log('Successfully sent', bytes, 'bytes');
    }
  });
```

## Errors

In the event that there is a socket error, `node-statsd` will allow this error to bubble up.  If you would like to catch the errors, just attach a listener to the socket property on the instance.

```javascript
client.socket.on('error', function(error) {
  return console.error("Error in socket: ", error);
});
```

If you want to catch errors in sending a message then use the callback provided.

## License

node-statsd is licensed under the MIT license.

