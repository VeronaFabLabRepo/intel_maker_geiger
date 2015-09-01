<?php

$servername = "localhost";
$username = "intelmaker";
$password = "vrfablabintel";
$dbname = "intelmaker";

$conn = new mysqli($servername, $username, $password,$dbname);


if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$start = htmlspecialchars($_GET["start"]);
$end = htmlspecialchars($_GET["end"]);


$sql = "SELECT nodeId, geigerValue, lat, lon, dateins, cpm FROM geigerBackPack WHERE UNIX_TIMESTAMP(dateins) > $start AND UNIX_TIMESTAMP(dateins) < $end";

$result = $conn->query($sql);

if ($result->num_rows > 0) {
    echo "[";
    while($row = $result->fetch_assoc()) {
        echo "{lat: ".$row["lat"].", lon:".$row["lon"].", count: ".$row["cpm"]."},";
    }
    echo "]";
} else {
    echo "[]";
}
$conn->close();

//formato '[{lat: 45.52, lng:12.01, count: 3}]'

?>