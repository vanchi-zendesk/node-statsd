var Client = require('node-statsd').StatsD;

/**
 * Internal: object representing a given stat
 */
var Stat = function(name, value, type, client) {
  this.name = name;
  this.value = value;
  this.client = client;
  this.type = type;
};

/**
 * Set a specified sampleRate on a stat
 * @param rate {Number} The sampling rate
 * @return Returns the Stat object (for chaining)
 */
Stat.prototype.sampleRate = function(rate){
  this.sampleRate = rate;
  return this;
};

/**
 * Set a specified tagstring on a stat (datadog)
 * @param tags {Array} Array of tag strings
 * @return Returns the Stat object (for chaining)
 */
Stat.prototype.tags = function(tags){
  this.tags = tags;
  return this;
};

/**
 * Send a stat
 * @param callback {function} Callback for successful send
 */
Stat.prototype.send = function(callback){
  this.client.sendAll(this.name, this.value, this.type, this.sampleRate, this.tags, callback);
};

/**
 * Represents the timing stat
 * Replaces node-statsd method
 * @param stat {String|Array} The stat(s) to send
 * @param time {Number} The time in milliseconds to send
 */
Client.prototype.timing = function (stat, time) {
  return new Stat(stat, time, 'ms', this);
};

/**
 * Increments a stat by a specified amount
 * Replaces node-statsd method
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 */
Client.prototype.increment = function (stat, value) {
  return new Stat(stat, value || 1, 'c', this);
};

/**
 * Decrements a stat by a specified amount
 * Replaces node-statsd method
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 */
Client.prototype.decrement = function (stat, value) {
  return new Stat(stat, -value || -1, 'c', this);
};

/**
 * Gauges a stat by a specified amount
 * Replaces node-statsd method
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 */
Client.prototype.gauge = function (stat, value) {
  return new Stat(stat, value, 'g', this);
};

/**
 * Counts unique values by a specified amount
 * Replaces node-statsd method
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
 * Replaces node-statsd method
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number} The Number of times to sample (0 to 1)
 * @param tags {Array} Datadog tags of the form [ "port:10000", "host:abc" ]
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
 * Replaces node-statsd method
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param type {String} The type of message to send to statsd
 * @param sampleRate {Number} The Number of times to sample (0 to 1)
 * @param tags {Array} Datadog tags of the form [ "port:10000", "host:abc" ]
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
