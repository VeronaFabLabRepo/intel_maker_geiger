/*  
 *  GeigerBackPack
 *  ========================
 *
 *  Portable radiation detection system with the Intel platform Edison and geographic tracking.
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
 *  Version:           0.0.1
 *  Implementation:    Verona FabLab Team. 2015.
 *
 */

var mraa = require('mraa');
var request = require("request");
var serialport = require('serialport');
var nmea = require('nmea');
var qs = require('qs');

var uri = "http://104.40.139.35:1880/geiger";
var CONV_FACTOR = 0.00812; // Conversion factor - CPM to uSV/h (sensor: J305ß)
var geiger_input = 2; // pin interrupt
var count = 0;
var countPerMinute = 0;
var radiationValue = 0.0;
var lat = 0;
var lon = 0;

var u = new mraa.Uart(0);
var x = new mraa.Gpio(geiger_input);

x.dir(mraa.DIR_IN);
x.isr(mraa.EDGE_BOTH, interruptEvent);

var port = new serialport.SerialPort(u.getDevicePath(), {
                baudrate: 9600,
                parser: serialport.parsers.readline('\r\n')});

function interruptEvent() {
  count++;
  //console.log("->" + count);
}

function periodicActivity()
{
    console.log("Count completed...");
    
    //detach Interrupt for accesing securely to count variable
    x.isrExit();

	countPerMinute = count / 2.0; // Half the value because use EDGE_BOTH
	radiationValue = Number((countPerMinute * CONV_FACTOR).toFixed(5));
	count = 0;

    //reattach Interrupt
    x.dir(mraa.DIR_IN);
	x.isr(mraa.EDGE_BOTH, interruptEvent );
    
    console.log("CPM="+countPerMinute+" uSv/h= " + radiationValue);
    
    if (radiationValue > 0) {
        
        // Send data to cloud
        var qsdata = qs.stringify({ id: 1, v: radiationValue, cpm: countPerMinute, lat: lat, lon: lon });
        var r = uri + "/?" + qsdata;
        console.log(r);
        request(r, function(error, response, body) {
            console.log(body);
        });
        
    } else {
        console.log("Zero value");
    }
    
	setTimeout(periodicActivity,60000);
    
}

//GPS reading from serial
port.on('data', function(line) {

    var sent = nmea.parse(line);
	if(sent.sentence == 'GGA'){
		lat = sent.lat;
		lon = sent.lon;
	}
    
});

console.log("Start...");
periodicActivity(); //call the periodicActivity function



