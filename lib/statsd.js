var dgram = require('dgram'),
    dns   = require('dns');

/**
 * The UDP Client for StatsD
 * @param options
 *   @option host      {String}  The host to connect to default: localhost
 *   @option port      {String|Integer} The port to connect to default: 8125
 *   @option prefix    {String}  An optional prefix to assign to each stat name sent
 *   @option suffix    {String}  An optional suffix to assign to each stat name sent
 *   @option globalize {boolean} An optional boolean to add "statsd" as an object in the global namespace
 *   @option cacheDns  {boolean} An optional option to only lookup the hostname -> ip address once
 *   @option mock      {boolean} An optional boolean indicating this Client is a mock object, no stats are sent.
 * @constructor
 */
var Client = function (host, port, prefix, suffix, globalize, cacheDns, mock) {
  var options = host || {},
         self = this;

  if(arguments.length > 1 || typeof(host) === 'string'){
    options = {
      host      : host,
      port      : port,
      prefix    : prefix,
      suffix    : suffix,
      globalize : globalize,
      cacheDns  : cacheDns,
      mock      : mock === true
    };
  }

  this.host   = options.host || 'localhost';
  this.port   = options.port || 8125;
  this.prefix = options.prefix || '';
  this.suffix = options.suffix || '';
  this.socket = dgram.createSocket('udp4');
  this.mock   = options.mock;

  if(options.cacheDns === true){
    dns.lookup(options.host, function(err, address, family){
      if(err == null){
        self.host = address;
      }
    });
  }

  if(options.globalize){
    global.statsd = this;
  }
};

var Stat = function(name, value, type, client) {
  this.name = name;
  this.value = value;
  this.client = client;
  this.type = type;
};

Stat.prototype.sampleRate = function(rate){
  this.sampleRate = rate;
};

Stat.prototype.tags = function(tags){
  this.tags = tags;
};

Stat.prototype.send = function(callback){
  this.client.sendAll(this.name, this.value, this.type, this.sampleRate, this.tags, callback);
};

/**
 * Represents the timing stat
 * @param stat {String|Array} The stat(s) to send
 * @param time {Number} The time in milliseconds to send
 */
Client.prototype.timing = function (stat, time) {
  return new Stat(stat, time, 'ms', client);
};

/**
 * Increments a stat by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 */
Client.prototype.increment = function (stat, value) {
  return new Stat(stat, value || 1, 'c', this);
};

/**
 * Decrements a stat by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 */
Client.prototype.decrement = function (stat, value) {
  return new Stat(stat, -value || -1, 'c', this);
};

/**
 * Gauges a stat by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 */
Client.prototype.gauge = function (stat, value) {
  return new Stat(stat, value, 'g', this);
};

/**
 * Counts unique values by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 */
Client.prototype.unique =
Client.prototype.set = function (stat, value) {
  return new Stat(stat, value, 's', this);
};

/**
 * Datadog's histogram
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 */
Client.prototype.histogram = function (stat, value) {
  return new Stat(stat, value, 'h', this);
};


/**
 * Checks if stats is an array and sends all stats calling back once all have sent
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number} The Number of times to sample (0 to 1)
 * @param callback {Function} Callback when message is done being delivered. Optional.
 */
Client.prototype.sendAll = function(stat, value, type, sampleRate, tags, callback){
  var completed = 0,
      calledback = false,
      sentBytes = 0,
      self = this;

  /**
   * Gets called once for each callback, when all callbacks return we will
   * call back from the function
   * @private
   */
  function onSend(error, bytes){
    completed += 1;
    if(calledback || typeof callback !== 'function'){
      return;
    }

    if(error){
      calledback = true;
      return callback(error);
    }

    sentBytes += bytes;
    if(completed === stat.length){
      callback(null, sentBytes);
    }
  }

  if(Array.isArray(stat)){
    stat.forEach(function(item){
      self.send(item, value, type, sampleRate, tags, onSend);
    });
  } else {
    this.send(stat, value, type, sampleRate, tags, callback);
  }
};

/**
 * Sends a stat across the wire
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param type {String} The type of message to send to statsd
 * @param sampleRate {Number} The Number of times to sample (0 to 1)
 * @param tags {Array} Array of tag strings
 * @param callback {Function} Callback when message is done being delivered. Optional.
 */
Client.prototype.send = function (stat, value, type, sampleRate, tags, callback) {
  var message = this.prefix + stat + this.suffix + ':' + value + '|' + type,
      buf;

  if(sampleRate && sampleRate < 1){
    if(Math.random() < sampleRate){
      message += '|@' + sampleRate;
    } else {
      //don't want to send if we don't meet the sample ratio
      return;
    }
  }

  if(tags && Array.isArray(tags)){
    var tagStr = tags.join(',');
    message += '|#' + tagStr;
  }

  // Only send this stat if we're not a mock Client.
  if(!this.mock) {
    buf = new Buffer(message);
    this.socket.send(buf, 0, buf.length, this.port, this.host, callback);
  } else {
    if(typeof callback === 'function'){
      callback(null, 0);
    }
  }
};

exports.StatsD = Client;
