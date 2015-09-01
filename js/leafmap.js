

var testData = {
    max: 50,
    data: []
};

var baseLayer = L.tileLayer(
  'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
    maxZoom: 18
  }
);

var cfg = {
  "radius": 20,// radius should be small ONLY if scaleRadius is true (or small radius is intended)
  "maxOpacity": .5, 
  "scaleRadius": false, // scales the radius based on map zoom
  // if set to false the heatmap uses the global maximum for colorization
  // if activated: uses the data maximum within the current map boundaries 
  //   (there will always be a red spot with useLocalExtremas true)
  "useLocalExtrema": false,
  latField: 'lat', // which field name in your data represents the latitude - default "lat"
  lngField: 'lon', // which field name in your data represents the longitude - default "lng"
  valueField: 'count' // which field name in your data represents the data value - default "value"
};


var heatmapLayer = new HeatmapOverlay(cfg);

var map = new L.Map('map', {
  center: new L.LatLng(45.52,11.01),
  zoom: 15,
  layers: [baseLayer, heatmapLayer]
});

heatmapLayer.setData(testData);

function getTimestamp(str) {
    if (str.length > 0) {
        var d = str.match(/\d+/g); // extract date parts
        return +new Date(d[0], d[1] - 1, d[2], d[3], d[4], d[5]); // build Date object
    }
}

function load_data() {
    var start = getTimestamp($("#fromTime").val())/1000;
    var end = getTimestamp($("#toTime").val())/1000;

    $.get('geigermap.php?start=' + start + '&end=' + end, function (data) {
	    testData.data = [];
		testData.data = eval(data);
		heatmapLayer.setData(testData);
        
    });
}