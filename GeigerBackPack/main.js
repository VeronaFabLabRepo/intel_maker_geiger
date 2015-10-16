/*  
 *  GeigerBackPack
 *  ========================
 *
 *  Portable radiation detection system with geographic tracking using the Intel Platform Edison.
 *  
 *  This program is free software: you can redistribute it and/or modify 
 *  it under the terms of the GNU General Public License as published by 
 *  the Free Software Foundation, either version 3 of the License, or 
 *  (at your option) any later version. 
 *  
 *  This program is distributed in the hope that it will be useful, 
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of 
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the 
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License 
 *  along with this program.  If not, see http://www.gnu.org/licenses/. 
 *  
 *  Version:           0.0.2
 *  Implementation:    Verona FabLab Team. 2015.
 *
 */

var mraa = require('mraa');
var request = require("request");
var serialport = require('serialport');
var nmea = require('nmea');
var qs = require('qs');
var lcdie = require('./lcdie.js');
var localip = require('local-ip');
var dateFormat = require('dateformat');
var dblite = require('dblite');
var http = require('http');

var uri = "http://plumake.cloudapp.net:1880/geiger"; // Data to Cloud
var CONV_FACTOR = 0.00812; // Conversion factor - CPM to uSV/h (sensor: J305ß)
var geiger_input = 2; // pin interrupt
var count = 0;
var countPerMinute = 0; // CPM
var radiationValue = 0.0;
var lat = 0;
var lon = 0;
var alt = 0;
var fix = false; // GPS status
var ip; // local ip
var db = dblite('/var/geiger.db'); // database sqlite3
var localport = 88;

// Create schema for sqlite local storage
db.query("CREATE TABLE IF NOT EXISTS 'geiger' ('id' INTEGER PRIMARY KEY, 'geigerValue' double NOT NULL,'lat' double,'lon' double,'dateins' datetime,'cpm' int(11) NOT NULL,'alt' double)", function(err, rows) {});

// Get local ip from wlan0
var interface = 'wlan0';
localip(interface, function(err, res) {
  if (err) {
        console.log("Network down?");
  } else {
        // Create a server web listening
        console.log('My local ip address on ' + interface + ' is ' + res);
        ip = res;
        http.createServer(function (req, res) { 
            
        // Send current measure.
        if (req.url == "/") {
          res.writeHead(200, {'Content-Type': 'text/html'});
          res.write('<html><script>setTimeout(function(){window.location.reload(1);}, 5000);</script><body><h1><b>GeigerBackBag</b></h1><h2>CPM: ' + countPerMinute + '</h2>'+'<h2>uSv/h: ' + radiationValue + '</h2>'+'<h2>lat: ' + lat + '</h2>'+'<h2>lon: ' + lon + '</h2>'+'<h2>alt: ' + alt + '</h2>' + '</body></html>', function(err) { res.end(); });
        }
            
        // Send All data storage in JSON
        if (req.url == "/data") {
          res.writeHead(200, {'Content-Type': 'application/json'});
          db.query('SELECT * FROM geiger ORDER by dateins DESC', { id: Number, geigerValue: Number, lat: Number, lon: Number, dateins: String, cpm: Number, alt: Number}, function(err, rows) {
             res.write(JSON.stringify(rows), function(err) { 
              res.end(); 
            });
          });
        }
            
        }).listen(localport);
        console.log('Server running on port '+localport+'.');
  }
});




//Messages presentation during startup
setTimeout(function() {WriteLCD(" GeigerBackPack ","  Intel Edison ")},500);
setTimeout(function() {WriteLCD("www.verona      ","      fablab.it")},3000);
setTimeout(function() {WriteLCD(ip,"port 88")},6000);

// Enable the serial port for GPS
var u = new mraa.Uart(0);
var port = new serialport.SerialPort(u.getDevicePath(), {
                baudrate: 9600,
                parser: serialport.parsers.readline('\r\n')});

//GPS reading from the serial
port.on('data', function(data) {

            // Not every line of data results in a successful parse
            var loc;
            try {
                if (nmea.parse(data)) {
                    loc = nmea.parse(data);
                } else {
                    return;
                }
            } catch (ex) {
                 console.log(ex);   
                 return;
            }

            // Match NMEA GGA string
            if (loc.sentence === 'GGA') {
                if (loc.type === 'fix') {

                    // Convert ddmm.mmmm to degrees decimal
                    var deg = loc.lat.toString().slice(0,2);
                    var min = loc.lat.toString().slice(2)/60;
                    var d = parseFloat(deg) + parseFloat(min);

                    // Convert dddmm.mmmm to degrees decimal
                    var deg = loc.lon.toString().slice(0,3);
                    var min = loc.lon.toString().slice(3)/60;
                    var e = parseFloat(deg) + parseFloat(min);

                    lat = d.toFixed(6);
                    lon = e.toFixed(6);
                    
                    alt = parseFloat(loc.alt);
                    
                    if (isNaN(lat) || isNaN(lon))
                        fix = false;
                    else
                        fix = true;
                    
                } else {
                    fix = false;
                }
            }
            //console.log(fix);
   
});


// Enable Led of geiger sensor board
var ledGreen1 = new mraa.Gpio(10);
ledGreen1.dir(mraa.DIR_OUT);
ledGreen1.write(0);
var ledGreen2 = new mraa.Gpio(11);
ledGreen2.dir(mraa.DIR_OUT);
ledGreen2.write(0);
var ledGreen3 = new mraa.Gpio(12);
ledGreen3.dir(mraa.DIR_OUT);
ledGreen3.write(0);
var ledRed4 = new mraa.Gpio(13);
ledRed4.dir(mraa.DIR_OUT);
ledRed4.write(0);
var ledRed5 = new mraa.Gpio(9);
ledRed5.dir(mraa.DIR_OUT);
ledRed5.write(0);

// Interrupt Event from sensor board.
// This is triggered when a gamma ray hits the sensor
function interruptEvent() {
  count++;
}


var lock = false;
// Write message into LCD
function WriteLCD(row1, row2) {

    if (!lock) {
        lock = true;
        var lcd = new lcdie({rs: 3, e: 4, data: [5, 6, 7, 8], cols: 16, rows: 2});
        console.log("lcd message: " + row1 + " " + row2);
        lcd.on('ready', function () {
              lcd.setCursor(0, 0);
              lcd.print(row1);
              lcd.once('printed', function () {
                lcd.setCursor(0, 1);
                lcd.print(row2);
                lcd.once('printed', function () {
                    lcd.close();
                    lock = false;
                });
              });
        });
    }

}



// Main Loop
function periodicActivity()
{
    // Repeat the measurement in 10 seconds
    setTimeout(periodicActivity,10000);

    console.log("Count completed...");

    //detach Interrupt for accesing securely to count variable
    x.isrExit();

    countPerMinute = count / 2.0 * 6.0; // Half the value because use EDGE_BOTH, libmraa support only EDGE_BOTH ? 
    radiationValue = Number((countPerMinute * CONV_FACTOR).toFixed(5));
    count = 0;

    //reattach Interrupt
    x.dir(mraa.DIR_IN);
    x.isr(mraa.EDGE_BOTH, interruptEvent );

    // Insert a record values into database
    db.query("INSERT INTO 'geiger' VALUES (NULL,?,?,?,?,?,?)", [radiationValue,lat,lon,dateFormat((new Date()).request_date, "dd/mm/yyyy HH:MM:ss"),countPerMinute,alt]);

    console.log(dateFormat((new Date()).request_date, "dd/mm/yyyy HH:MM:ss") + " CPM="+countPerMinute+" uSv/h= " + radiationValue);

    // Write values into LCD
    setTimeout(function() {WriteLCD("CPM: "+countPerMinute, "uSv/h: " + radiationValue)},1000);

    // If Calculate the average (per hour) radiation that we obtain from dividing the maximum level between the number of hours 
    // in a year (50000μSv)/(24*365) = 5.70μSv/h of maximum radioactivity per hour. 
    // Turn on the LED bar
    if (radiationValue > 0)  ledGreen1.write(1); else ledGreen1.write(0);
    if (radiationValue > 1)  ledGreen2.write(1); else ledGreen2.write(0);
    if (radiationValue > 2)  ledGreen3.write(1); else ledGreen3.write(0);
    if (radiationValue > 3)  ledRed4.write(1); else ledRed4.write(0);
    if (radiationValue > 5.7) ledRed5.write(1); else ledRed5.write(0);

    if (fix) {
        // Sending data to the remote server if I have the position from the GPS
        var qsdata = qs.stringify({ id: 1, v: radiationValue, cpm: countPerMinute, lat: lat, lon: lon, alt: alt });
        var r = uri + "/?" + qsdata;
        console.log(r);
        request(r, function(error, response, body) {
              if (!error && response.statusCode == 200) {
                console.log(body) 
              } else {
                console.log("Network Error"); 
                setTimeout(function() {WriteLCD("Error! ","  Network Server")},6000);
                ledRed4.write(1);
                ledRed5.write(1);
                ledGreen1.write(0);
                ledGreen2.write(0);
                ledGreen3.write(0);
              }
        });
    } else {
        console.log("GPS invalid"); 
        setTimeout(function() {WriteLCD("Error! ","  GPS position ")},7000);
        ledRed4.write(1);
        ledRed5.write(1);
        ledGreen1.write(0);
        ledGreen2.write(0);
        ledGreen3.write(0);
    }

    console.log("End");
    
}


// Enable Interrupt of geiger sensor board
var x = new mraa.Gpio(geiger_input);
x.dir(mraa.DIR_IN);
x.isr(mraa.EDGE_BOTH, interruptEvent);

console.log("Start...");

// Wait 10 seconds and then calculating the measure in Main Loop
setTimeout(periodicActivity,10000);


