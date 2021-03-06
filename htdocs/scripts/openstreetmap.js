var map = null;

// hack to get multiple concurrent requests
var subdomains = ["a", "b", "c", "d", "e"];
var numreq = 0;

// initialise the 'map' object
function init() {

    // start position for the map (hardcoded here for simplicity)
    var lat = 52.07;
    var lon = 5.2;
    var zoom = 8;

    OpenLayers.Control.Click = OpenLayers.Class(OpenLayers.Control, {
        defaultHandlerOptions: {
            'single': true,
            'double': false,
            'pixelTolerance': 4,
            'stopSingle': true,
            'stopDouble': false
        },

        initialize: function (options) {
            this.handlerOptions = OpenLayers.Util.extend({}, this.defaultHandlerOptions);
            OpenLayers.Control.prototype.initialize.apply(
            this, arguments);
            this.handler = new OpenLayers.Handler.Click(
            this, {
                'click': this.trigger
            }, this.handlerOptions);
        },

        trigger: function (e) {
            var lonlat = map.getLonLatFromViewPortPx(e.xy);
            lonlatGCS = lonlat.transform(new OpenLayers.Projection("EPSG:900913"), new OpenLayers.Projection("EPSG:4326"));
            $.get('http://mijndev.openstreetmap.nl:7000?radius='+Math.floor(1000*(1-Math.log(map.zoom)) + 1800)+'&lat=' + lonlat.lat + '&lon=' + lonlat.lon, function (data) {
                if (data != null && data.length > 0) {
                    // alert(data[0]['naam']);
                    $("#tijden").empty();
                    $("#tijden").show();
                    callbackGeocoder(data);
                    if (data.length > 1) {
                        tpcs = '';
                        for (x = 0; x < data.length; x++) {
                            tpcs += data[x]['tpc']+',';
                        }
                        $("#tijden").append('<br /><a class="combibookmark" href="overzicht.html?tpc='+tpcs+'">Combinatie bookmark</a>');
                    }
                }
            }, "json");
        }
    });

    // complex object of type OpenLayers.Map
    var map_controls = [new OpenLayers.Control.Navigation(), new OpenLayers.Control.PanPanel(), new OpenLayers.Control.ZoomPanel(), new OpenLayers.Control.LayerSwitcher()];

    map = new OpenLayers.Map('map', {
        controls: map_controls,
        maxExtent: new OpenLayers.Bounds(-20037508, -20037508, 20037508, 20037508),
        numZoomLevels: 18,
        maxResolution: 156543,
        units: 'm',
        displayProjection: new OpenLayers.Projection("EPSG:4326"),
        projection: new OpenLayers.Projection("EPSG:900913")
    });

    var layerTileNL = new OpenLayers.Layer.OSM("OpenStreetMap", "http://tile.openstreetmap.nl/tiles/${z}/${x}/${y}.png", {
        numZoomLevels: 19
    });

    var ov_zones_overlay = new OpenLayers.Layer.OSM("Zonekaart", "http://tiles.mijndev.openstreetmap.nl:8080/ov-zones/${z}/${x}/${y}.png", {
        attribution: '<br />Zones via <a href="http://www.agi-rws.nl/">AGI-RWS</a>',
        numZoomLevels: 19,
        isBaseLayer: false,
        visibility: false
    });

    var ov_haltes = new OpenLayers.Layer.OSM("Haltes", "http://tiles.mijndev.openstreetmap.nl:8080/openov-haltes/${z}/${x}/${y}.png", {
        attribution: '',
        numZoomLevels: 19,
        isBaseLayer: false,
        visibility: true
    });


    map.addLayers([layerTileNL, ov_zones_overlay, ov_haltes]);
    var click = new OpenLayers.Control.Click();
    map.addControl(click);
    click.activate();

    // center map
    if (!map.getCenter()) {
        map.setCenter(new OpenLayers.LonLat(lon, lat).transform(new OpenLayers.Projection("EPSG:4326"), map.getProjectionObject()), zoom);
    }
}

function getQuerystring(key, default_)
{
  if (default_==null) default_="";
  key = key.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  var regex = new RegExp("[\\?&]"+key+"=([^&#]*)");
  var qs = regex.exec(window.location.href);
  if(qs == null)
    return default_;
  else
    return qs[1];
}

function init_bookmark() {
    tpc = getQuerystring('tpc');
    tpcs = tpc.split(',');

    if (tpc != '' && tpcs.length > 0) {
        for (x = 0; x < tpcs.length; x++) {
            if (tpcs[x] != '') {
                queryGeocoder('query='+tpcs[x], callbackGeocoder);
            }
        }
    } else {
        query = getQuerystring('query');
        if (query != '') {
            queryGeocoder('query='+query, callbackRedirect);
        } else {
            $("#tijden").append('<p>Als je nog geen halte hebt geselecteerd kun je dat nu nog via <a href="index.html">de kaart</a> doen. Of het zoekgedeelte hierboven.</p>');
        }
    }
}
function callbackRedirect(data) {
    if (data != null && data.length > 0) {
        tpcs = ''
        for (x = 0; x < data.length; x++) {
            tpcs += data[x]['tpc']+',';
        }
        window.location = 'overzicht.html?tpc='+tpcs;
    } else {
        $("#tijden").empty()
        $("#tijden").append('<p>We konden deze steekwoorden niet vinden, probeer het eens via de <a href="index.html">de kaart</a>.</p>');
    }
}

function callbackGeocoder(data) {
    if (data != null && data.length > 0) {
       // alert(data[0]['naam']);
       requests = new Array();
       for (x = 0; x < data.length; x++) {
           if ((x <= 4) || (data[x]['distance'] < 40)) {
               requests.push(data[x])
           }
       }

       $(requests).each(function() {
            if (this['type'] == 'kv55') {
                $("#tijden").append('<h1><a href="overzicht.html?tpc='+this['tpc']+'">'+this['naam']+'</a></h1><div id="tpc_'+this['tpc']+'">Laden van GOVI...</div>');
                $.ajax({url: "http://"+subdomains[numreq++%5]+".cache.govi.openov.nl/kv55/"+this['tpc'], success: renderKV55, dataType: "xml"});
            } else if (this['type'] == 'kv55-arriva') {
                $("#tijden").append('<h1><a href="overzicht.html?tpc='+this['tpc']+'">'+this['naam']+'</a></h1><div id="tpc_'+this['tpc']+'">Laden van Arriva...</div>');
                $.ajax({url: "http://"+subdomains[numreq++%5]+".cache.govi.openov.nl/arriva/"+this['tpc'], success: renderKV55, dataType: "xml"});
            } else if (this['type'] == 'ns') {
                $("#tijden").append('<h1><a href="overzicht.html?tpc='+this['tpc']+'">'+this['naam']+'</a></h1><div id="tpc_'+this['tpc']+'">Laden van NS-API...</div>');
                $.ajax({url: "http://nsapi.xmpp.openov.nl/stations/"+this['tpc']+"/avt/", success: renderNSAPIDisco, dataType: "xml"});
            } else if (this['type'] == 'irail') {
                $("#tijden").append('<h1><a href="overzicht.html?tpc='+this['tpc']+'">'+this['naam']+'</a></h1><div id="tpc_'+this['tpc'].replace(/[.]/g, "_")+'">Laden van iRail...</div>');
                $.ajax({url: "http://api.irail.be/liveboard/?id="+this['tpc'], success: renderIRail, dataType: "xml"});
            } else if (this['type'] == 'statisch') {
                $("#tijden").append('<h1><a href="overzicht.html?tpc='+this['tpc']+'">'+this['naam']+'</a></h1><div id="tpc_'+this['tpc']+'">Van deze halte hebben we alleen statische gegevens, deze worden nog niet weergegeven.</div>');
            } else {
                $("#tijden").append('<h1><a href="overzicht.html?tpc='+this['tpc']+'">'+this['naam']+'</a></h1><div id="tpc_'+this['tpc']+'">Helaas hebben we van deze halte alleen een locatie.</div>');
            }
        });
    }
}

function queryGeocoder(querystring, callback) {
    $.get('http://mijndev.openstreetmap.nl:7000?'+querystring, callback, "json");
}

function renderKV55(xmlDoc) {
    tpc = xmlDoc.getElementsByTagName("TimingPointCode")

    if (tpc != null)
        tpc = tpc[0].childNodes[0].nodeValue;

    output = ''
    trips = xmlDoc.getElementsByTagName("Trip");
    for (i = 0; i < trips.length; i++) {
        var time = '';
        owner = trips[i].getElementsByTagName("DataOwnerCode")[0].childNodes[0].nodeValue;
        name = trips[i].getElementsByTagName("DestinationName")[0].childNodes[0].nodeValue;
        expected = trips[i].getElementsByTagName("ExpectedDepartureTime")[0].childNodes[0];
        target = trips[i].getElementsByTagName("TargetDepartureTime")[0].childNodes[0].nodeValue;
        if (!expected) {
            time = target
        } else {
            time = expected.nodeValue;
        }

        // Convert 32h day to human readible day
        timeparts = time.split(':', 3)
        hour = (parseFloat(timeparts[0]) % 24)
        time = addzero(hour) + ":" + timeparts[1] + ":" + timeparts[2];

        if (expected.nodeValue != target) {
            time = '<i>' + time + '</i>';
        }

        output += '<b>' + time + '</b>' + '&nbsp;' + name + '<br />';
    }
    $("#tpc_" + tpc).empty();
    $("#tpc_" + tpc).append(output);
}

function renderNSAPIDisco(xmlDoc) {
    var station = null;
    items = xmlDoc.getElementsByTagName("item");
    output = ''
    for (i = 0; i < items.length; i++) {
        var node = [];
        var name = [];

        node = items[i].attributes['node'].nodeValue.split('/');
        name = items[i].attributes['name'].nodeValue.replace('richting ', '').split(' ');

        output += '<b>' + name.shift() + '</b>&nbsp;' + name.join(' ') + '<br />';
        station = node[1];
    }

    $("#tpc_" + station).empty();
    $("#tpc_" + station).append(output);
}

function addzero(i){
    if (i < 10) {
       i = "0" + i;
    }
    return i;
}

function renderIRail(xmlDoc) {
    // All the code in this function was, if remotely possible, shamelessly plagiarized from: https://github.com/iRail/Widgets/blob/master/maps/js/openstreetmap.js#L70
    station = xmlDoc.getElementsByTagName("station")[0].attributes['id'].nodeValue.replace(/[.]/g, "_");

    departures = xmlDoc.getElementsByTagName("departure");
    output = '';
    for (i = 0; i < departures.length; i++) {
        name = departures[i].getElementsByTagName("station")[0].childNodes[0].nodeValue;
        expected_date = new Date(departures[i].getElementsByTagName("time")[0].childNodes[0].nodeValue * 1000);
        expected = addzero(expected_date.getHours()) + ":" + addzero(expected_date.getMinutes());
        delay = departures[i].getAttribute("delay");
        delay = Math.floor(delay/60);
        if(delay > 0){
            output   += '<b>'+expected+' <font color="red">+' + delay + 'min</font>' + '</b>' + '&nbsp;'+ name + '<br />';
        } else {
            output   += '<b>'+expected+'</b>' + '&nbsp;'+ name + '<br />';
        }
    }

    $("#tpc_" + station).empty();
    $("#tpc_" + station).append(output);
}
