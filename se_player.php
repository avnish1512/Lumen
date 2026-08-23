<?php
////////////////////// SUPEREMBED PLAYER SCRIPT //////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////
////////////////////////// PLAYER SETTINGS ///////////////////////////////////////////////

// do not change anything outside this section

// player font - paste font name from Google fonts, replace spaces with +
$player_font = "Poppins";

// player colors - paste color code in HEX format without # eg. 123456
$player_bg_color = "000000"; // background color
$player_font_color = "ffffff"; // font color
$player_primary_color = "34cfeb"; // primary color for loader and buttons
$player_secondary_color = "6900e0"; // secondary color for hovers and elements

// player loader - you can choose a loading animation from 1 to 10
$player_loader = 1;

// preferred server - you can choose server that will be on top of the list and open after
// clicking play button, works only for quality >= 720p
// options are: vidlox = 7, fembed = 11, mixdrop = 12, upstream = 17, videobin = 18,
// doodstream = 21, streamtape = 25, streamsb = 26, voe = 29, ninjastream = 33
$preferred_server = 25; // streamtape; leave 0 for no preference

// here you can choose source list style
// 1 = button with server count and full page overlay with server list
// 2 = button with icon and dropdown with server list
$player_sources_toggle_type = 2;

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

if (!isset($_GET['video_id']) || !is_string($_GET['video_id'])) {
    echo "Missing video_id";
    exit;
}

$video_id = trim($_GET['video_id']);
if (empty($video_id)) {
    echo "Missing video_id";
    exit;
}

$is_tmdb = isset($_GET['tmdb']) && is_string($_GET['tmdb']) ? trim($_GET['tmdb']) : "0";

$season = "0";
if (isset($_GET['season']) && is_string($_GET['season'])) {
    $season = trim($_GET['season']);
} elseif (isset($_GET['s']) && is_string($_GET['s'])) {
    $season = trim($_GET['s']);
}

$episode = "0";
if (isset($_GET['episode']) && is_string($_GET['episode'])) {
    $episode = trim($_GET['episode']);
} elseif (isset($_GET['e']) && is_string($_GET['e'])) {
    $episode = trim($_GET['e']);
}

$preferred_srv = $preferred_server;
if (isset($_GET['preferred_server']) && is_string($_GET['preferred_server'])) {
    $pref = trim($_GET['preferred_server']);
    if (in_array($pref, ['0', '7', '11', '12', '17', '18', '21', '25', '26', '29', '33'], true)) {
        $preferred_srv = $pref;
    }
}

$queryParams = http_build_query([
    'video_id'                   => $video_id,
    'tmdb'                       => $is_tmdb,
    'season'                     => $season,
    'episode'                    => $episode,
    'player_font'                => $player_font,
    'player_bg_color'            => $player_bg_color,
    'player_font_color'          => $player_font_color,
    'player_primary_color'       => $player_primary_color,
    'player_secondary_color'     => $player_secondary_color,
    'player_loader'              => $player_loader,
    'preferred_server'           => $preferred_srv,
    'player_sources_toggle_type' => $player_sources_toggle_type,
]);

$request_url = "https://getsuperembed.link/?" . $queryParams;
$player_url = "";

if (function_exists('curl_version')) {
    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL            => $request_url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 7,
        CURLOPT_HEADER         => false,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $player_url = curl_exec($curl);
    curl_close($curl);
} else {
    $context = stream_context_create([
        'http' => [
            'timeout' => 7,
        ],
    ]);
    $player_url = @file_get_contents($request_url, false, $context);
}

if (!empty($player_url) && is_string($player_url)) {
    $player_url = trim($player_url);
    if (strpos($player_url, "https://") === 0) {
        header("Location: " . $player_url, true, 302);
        exit;
    } else {
        echo "<span style='color:red'>" . htmlspecialchars($player_url, ENT_QUOTES, 'UTF-8') . "</span>";
    }
} else {
    echo "Request server didn't respond";
}

?>
