# Patient 0
this discord bot is a meant for usage in The Asylum, a discord server. its meant to automate tasks for starting up stream, and post stream.

# Passive Commands
## auto role
Asigns a @Streaming With Kit whenever user joins #streaming vc. and takes it away if user leaves, unless kit is streaming or there is an admin in vc.
# Things to Configure (config.json)
- Streaming VC channel id
- Streaming With kit id 

# restrictions
only users with @moderator or higher can use /commands from this bot.
##### will be updated whenever people ask for more functionality.

## to do
post to chanel x if streamer y is live

##### secrets.json is ignored, heres a template if i ever move servers or give code away to someone else
{
    "token": "000000000000000000000000000000000000000000000000000000000",
    "clientId": "000000000000000000000000000000000000000000000000000000000",
    "twclientId": "000000000000000000000000000000000000000000000000000000000",
    "twclientSecret": "000000000000000000000000000000000000000000000000000000000",
    "twitchUsername": "OnStartTwitchUsername",
    "announcements_channel": "0000000000000000000"
}

#### livemessage.json is ignored, heres a template if i ever move servers or give code away to someone else whenever multi user is supported
{ "username": "message here",
  "username2":"${twitchUsername} is now live on Twitch! https://twitch.tv/${twitchUsername}",
  "username3": "your local __***${twitchUsername}***__ is now live on Twitch! \nhttps://twitch.tv/${twitchUsername}",
  "continueousCheckUsername": "your local ***${twitchUsername}*** is now live on Twitch! \nhttps://twitch.tv/${twitchUsername}"
}


























