[{"id":"bbc93502.7b9618","type":"MySQLdatabase","host":"127.0.0.1","port":"3306","db":"intelmaker","tz":""},{"id":"be5a635b.3c8f3","type":"http in","name":"Geiger enter","url":"/geiger","method":"get","x":152,"y":114,"z":"22770541.398f52","wires":[["a8dd1201.3da6d"]]},{"id":"a8dd1201.3da6d","type":"function","name":"http response","func":"\nmsg.res.send(200, \"Valori acquisiti\");\nreturn msg;","outputs":1,"valid":true,"x":339,"y":118,"z":"22770541.398f52","wires":[["96451e39.680b7"]]},{"id":"96451e39.680b7","type":"function","name":"insertDB","func":"var backpackObj = {};\nbackpackObj.nodeId = msg.payload.id;\nbackpackObj.geigerValue = msg.payload.v;\nbackpackObj.lat = msg.payload.lat;\nbackpackObj.lon = msg.payload.lon;\nbackpackObj.cpm = msg.payload.cpm;\n\nmsg.topic = \"insert into geigerBackPack (nodeId, geigerValue, lat, lon, dateins, cpm) values (?,?,?,?,NOW(),?)\"\nmsg.payload = [backpackObj.nodeId, backpackObj.geigerValue, backpackObj.lat, backpackObj.lon, backpackObj.cpm]\nreturn msg;","outputs":1,"valid":true,"x":563,"y":120,"z":"22770541.398f52","wires":[["916c3e32.6ca028"]]},{"id":"916c3e32.6ca028","type":"mysql","mydb":"bbc93502.7b9618","name":"insertValues","x":760,"y":71,"z":"22770541.398f52","wires":[[]]},{"id":"3a911a6d.bb73ee","type":"twitter out","twitter":"","name":"plumake_debug","x":768,"y":202,"z":"22770541.398f52","wires":[]},{"id":"96661068.3a1fd","type":"function","name":"createTweet","func":"var tweet = {};\ntweet.payload = \"[VeronaFabLab IntelMaker]\";\ntweet.payload += \"Nodo: \" + msg.payload.id;\ntweet.payload += \"; Valore: \" + msg.payload.v + \" Bq\";\ntweet.payload += \"; @(\" + msg.payload.lat + \";\" + msg.payload.lon + \")\";\n\nreturn tweet;","outputs":1,"valid":true,"x":574,"y":196,"z":"22770541.398f52","wires":[["3a911a6d.bb73ee"]]}]