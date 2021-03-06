'use strict';

var mraa = require('mraa');

var EventEmitter = require('events').EventEmitter,
  Q = require('q'),
  util = require('util'),
  tick = global.setImmediate || process.nextTick;

var __ROW_OFFSETS = [0x00, 0x40, 0x14, 0x54];

var __COMMANDS = {
  CLEAR_DISPLAY: 0x01,
  HOME: 0x02,
  SET_CURSOR: 0x80,
  DISPLAY_ON: 0x04,
  DISPLAY_OFF: ~0x04,
  CURSOR_ON: 0x02,
  CURSOR_OFF: ~0x02,
  BLINK_ON: 0x01,
  BLINK_OFF: ~0x01,
  SCROLL_LEFT: 0x18,
  SCROLL_RIGHT: 0x1c,
  LEFT_TO_RIGHT: 0x02,
  RIGHT_TO_LEFT: ~0x02,
  AUTOSCROLL_ON: 0x01,
  AUTOSCROLL_OFF: ~0x01
};

function Lcd(config) {
  var i;

  if (!(this instanceof Lcd)) {
    return new Lcd(config);
  }

  EventEmitter.call(this);

  this.cols = config.cols || 16; // TODO - Never used, remove?
  this.rows = config.rows || 1;
  this.largeFont = !!config.largeFont;

  //this.rs = new Gpio(config.rs, 'low'); // reg. select, output, initially low
  this.rs = new mraa.Gpio(config.rs);
  this.rs.dir(mraa.DIR_OUT);
  this.rs.write(0);

  //this.e = new Gpio(config.e, 'low'); // enable, output, initially low
  this.e = new mraa.Gpio(config.e);
  this.e.dir(mraa.DIR_OUT);
  this.e.write(0);
    
  this.data = []; // data bus, db4 thru db7, outputs, initially low
  for (i = 0; i < config.data.length; i += 1) {
      var d = new mraa.Gpio(config.data[i]);
      d.dir(mraa.DIR_OUT);
      d.write(0);
      this.data.push(d);
  }

  this.displayControl = 0x0c; // display on, cursor off, cursor blink off
  this.displayMode = 0x06; // left to right, no shift

  this.init();
}

util.inherits(Lcd, EventEmitter);
module.exports = Lcd;

// private
Lcd.prototype.init = function () {
  Q.delay(60)                                               
  .then(function () { 
      this.rs.write(0);
      this.e.write(0);
      this._write4Bits(0x03); 
  }.bind(this)) // 1st wake up
  .delay(10)                                                
  .then(function () { this._write4Bits(0x03); }.bind(this)) 
  .delay(5)                                                 
  .then(function () { this._write4Bits(0x03); }.bind(this)) 
  .delay(5)                                                 
  .then(function () {
      
    var displayFunction = 0x20;
    
    this._write4Bits(0x02); // 4 bit interface

    if (this.rows > 1) {
      displayFunction |= 0x08;
    }
    if (this.rows === 1 && this.largeFont) {
      displayFunction |= 0x04;
    }
    this._command(displayFunction);

    this._command(0x10);
    this._command(this.displayControl);
    this._command(this.displayMode);

    this._command(0x01); // clear display (don't call clear to avoid event)
  }.bind(this))
  .delay(3)             // wait > 1.52ms for display to clear
  .then(function () { this.emit('ready'); }.bind(this));
};

Lcd.prototype.print = function (val, cb) {
  var index,
    displayFills;

  val += '';

  // If n*80+m characters should be printed, where n>1, m<80, don't display the
  // first (n-1)*80 characters as they will be overwritten. For example, if
  // asked to print 802 characters, don't display the first 720.
  displayFills = Math.floor(val.length / 80);
  index = displayFills > 1 ? (displayFills - 1) * 80 : 0;

  this._printChar(val, index, cb);
};

// private
Lcd.prototype._printChar = function (str, index, cb) {
  tick(function () {
    if (index >= str.length) {
      if (cb) {
        return cb(null, str);
      }

      return this.emit('printed', str);
    }

    try {
      this._write(str.charCodeAt(index));
      this._printChar(str, index + 1, cb);
    } catch (e) {
      if (cb) {
        return cb(e);
      }

      return this.emit('error', e);
    }
  }.bind(this));
};

Lcd.prototype.clear = function (cb) {
  // Wait > 1.52ms. There were issues waiting for 2ms so wait 3ms.
  this._commandAndDelay(__COMMANDS.CLEAR_DISPLAY, 3, 'clear', cb);
};

Lcd.prototype.home = function (cb) {
  // Wait > 1.52ms. There were issues waiting for 2ms so wait 3ms.
  this._commandAndDelay(__COMMANDS.HOME, 3, 'home', cb);
};

Lcd.prototype.setCursor = function (col, row) {
  
  var r = row > this.rows ? this.rows - 1 : row; //TODO: throw error instead? Seems like this could cause a silent bug.
  //we don't check for column because scrolling is a possibility. Should we check if it's in range if scrolling is off?
  this._command(__COMMANDS.SET_CURSOR | (col + __ROW_OFFSETS[r]));
};

Lcd.prototype.display = function () {
  this.displayControl |= __COMMANDS.DISPLAY_ON;
  this._command(this.displayControl);
};

Lcd.prototype.noDisplay = function () {
  this.displayControl &= __COMMANDS.DISPLAY_OFF;
  this._command(this.displayControl);
};

Lcd.prototype.cursor = function () {
  this.displayControl |= __COMMANDS.CURSOR_ON;
  this._command(this.displayControl);
};

Lcd.prototype.noCursor = function () {
  this.displayControl &= __COMMANDS.CURSOR_OFF;
  this._command(this.displayControl);
};

Lcd.prototype.blink = function () {
  this.displayControl |= __COMMANDS.BLINK_ON;
  this._command(this.displayControl);
};

Lcd.prototype.noBlink = function () {
  this.displayControl &= __COMMANDS.BLINK_OFF;
  this._command(this.displayControl);
};

Lcd.prototype.scrollDisplayLeft = function () {
  this._command(__COMMANDS.SCROLL_LEFT);
};

Lcd.prototype.scrollDisplayRight = function () {
  this._command(__COMMANDS.SCROLL_RIGHT);
};

Lcd.prototype.leftToRight = function () {
  this.displayMode |= __COMMANDS.LEFT_TO_RIGHT;
  this._command(this.displayMode);
};

Lcd.prototype.rightToLeft = function () {
  this.displayMode &= __COMMANDS.RIGHT_TO_LEFT;
  this._command(this.displayMode);
};

Lcd.prototype.autoscroll = function () {
  this.displayMode |= __COMMANDS.AUTOSCROLL_ON;
  this._command(this.displayMode);
};

Lcd.prototype.noAutoscroll = function () {
  this.displayMode &= __COMMANDS.AUTOSCROLL_OFF;
  this._command(this.displayMode);
};

Lcd.prototype.close = function () {
  var i;
    
  this.rs.dir(mraa.DIR_OUT);
  this.rs.write(0);
  this.rs.isrExit();

  this.e.dir(mraa.DIR_OUT);
  this.e.write(0)
  this.e.isrExit();

  for (i = 0; i < this.data.length; i += 1) {
      this.data[i].dir(mraa.DIR_OUT);
      this.data[i].write(0)
      this.data[i].isrExit();
  }
};

// private
Lcd.prototype._commandAndDelay = function (command, timeout, event, cb) {
  tick(function () {
    try {
      this._command(command);

      setTimeout(function () {
        if (cb) {
          return cb(null);
        }

        return this.emit(event);
      }.bind(this), timeout);
    } catch (e) {
      if (cb) {
        return cb(e);
      }

      return this.emit('error', e);
    }
  }.bind(this));
};

// private
Lcd.prototype._command = function (cmd) {
  this._send(cmd, 0);
};

// private
Lcd.prototype._write = function (val) {
  this._send(val, 1);
};

// private
Lcd.prototype._send = function (val, mode) {
  this.rs.write(mode);
  this._write4Bits(val >> 4);
  this._write4Bits(val);
};

// private
Lcd.prototype._write4Bits = function (val) {
  if(!(typeof val === 'number')){
    throw new Error("Value passed to ._write4Bits must be a number");
  }

  var i;

  for (i = 0; i < this.data.length; i += 1, val = val >> 1) {
    this.data[i].write(val & 1);
  }

  // enable pulse >= 300ns
  // writeSync takes ~10 microseconds to execute on the BBB, so there's
  // nothing special needed to wait 300 nanoseconds.
  this.e.write(1);  
  this.e.write(0);
};

module.exports = Lcd;