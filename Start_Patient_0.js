const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { token, clientId } = require('./secrets.json');
const axios = require('axios');
let config;
try {
    config = JSON.parse(fs.readFileSync('secrets.json', 'utf-8'));
} catch (error) {
    console.error('Error reading secrets.json:', error);
}


let announcements_channel = config.announcements_channel;
let twclientId = config.twclientId;
let clientSecret = config.twclientSecret;
let twitchUsername = config.twitchUsername;


let lastKnownStatus = 'offline'; // Assume offline at startup

async function getAccessToken() {
    try {
        const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: twclientId,
                client_secret: clientSecret,
                grant_type: 'client_credentials'
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error fetching access token:', error);
        return null;
    }
}

function getLiveMessage(twitchUsername) {
    try {
        const liveMessages = JSON.parse(fs.readFileSync('livemessages.json', 'utf-8'));

        let liveMessage = liveMessages[twitchUsername] || `${twitchUsername} is now live on Twitch! https://twitch.tv/${twitchUsername}`;
        
        // Replace any `${twitchUsername}` in the string with the actual username value
        liveMessage = liveMessage.replace(/\$\{twitchUsername\}/g, twitchUsername);

        return liveMessage;
    } catch (error) {
        console.error('Error reading live messages:', error);
        return `${twitchUsername} is now live on Twitch! https://twitch.tv/${twitchUsername}`;
    }
}



// Function to check Twitch live status
async function checkTwitchLiveStatus() {
    
    try {
        config = JSON.parse(fs.readFileSync('secrets.json', 'utf-8'));
        // Re-assign updated secrets to variables
        twclientId = config.twclientId;
        clientSecret = config.twclientSecret;
        twitchUsername = config.twitchUsername;
    } catch (error) {
        console.error('Error reading secrets.json:', error);
        return;
    }

    if (!twitchAccessToken) {
        twitchAccessToken = await getAccessToken(); // Fetch new token if needed
    }

    const isLive = await isTwitchChannelLive(twitchUsername, twitchAccessToken);
    let channel = await client.channels.fetch(announcements_channel);

    if (isLive && lastKnownStatus === 'offline') {
        const liveMessage = getLiveMessage(twitchUsername);
        channel.send(liveMessage);
        lastKnownStatus = 'online'; // Update status to online
        console.log(`${twitchUsername} is now live.`);
    } else if (!isLive && lastKnownStatus === 'online') {
        channel.send(`${twitchUsername} is now offline.`);
        lastKnownStatus = 'offline'; // Update status to offline
        console.log(`${twitchUsername} is now offline.`);
    } else if (isLive) {
        console.log(`${twitchUsername} is still live.`);
    } else {
        console.log(`${twitchUsername} is still offline.`);
    }
}

async function sendMessageInChannel(channelId, sendMessage) {
    console.log(`Sending message to channel: ${channelId}`);
    try {config = JSON.parse(fs.readFileSync('secrets.json', 'utf-8'));
    twclientId = config.twclientId;
    clientSecret = config.twclientSecret;
    twitchUsername = config.twitchUsername;
    } catch (error) {
        console.error('Error reading secrets.json:', error);
        return;
    }
    
    sendMessage = sendMessage.replace(/\$\{twitchUsername\}/g, twitchUsername);

    if (config.devMode === "false") {
        let channel = await client.channels.fetch(config.announcements_channel);
        channel.send(message);

    }
    else{
        let channel = await client.channels.fetch(config.dev_channel);
        channel.send(message);
    }
} 

async function isTwitchChannelLive(username, accessToken) {
    try {
        const response = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${username}`, {
            headers: {
                'Client-ID': config.twclientId,
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const data = response.data.data;
        return data.length > 0 && data[0].type === 'live';
    } catch (error) {
        console.error('Error fetching Twitch stream data:', error);
        return false;
    }
}

const commands = [];
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
client.commands = new Collection();
function loadCommands(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            loadCommands(filePath);
        } else if (file.endsWith('.js')) {
            let shouldLoad = true;
            const stream = fs.createReadStream(filePath);
            const reader = readline.createInterface({ input: stream });

            reader.on('line', (line) => {
                if (line.startsWith('//skip loading')) {
                    console.log(`Skipping command load for: ${file}`);
                    shouldLoad = false;
                }
                reader.close();
                stream.destroy();
            });

            reader.on('close', () => {
                if (shouldLoad) {
                    const command = require(filePath);
                    client.commands.set(command.data.name, command);
                    commands.push(command.data.toJSON());
                    console.log(`Loaded command: ${command.data.name}`);
                }
            });

            reader.on('error', (error) => {
                console.error(`Error reading file ${file}:`, error);
            });
        }
    }
}

async function clearAndRegisterCommands() {
    const guilds = await client.guilds.fetch();
    const rest = new REST({ version: '9' }).setToken(token);

    for (const guild of guilds.values()) {
        try {
            await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: [] });
            await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: commands });
        } catch (error) {
            console.error(`Error handling guild ${guild.id}:`, error);
        }
    }
}

client.once(Events.ClientReady, async () => {
    console.log('Client ready. Loading commands... \n async function may print the same message twice or print skipping command to prevent loading the command twice');
    loadCommands(path.join(__dirname, 'commands'));
    console.log('Commands loaded. Clearing and registering commands...');
    await clearAndRegisterCommands();
    console.log('Commands cleared and registered.');
    twitchAccessToken = await getAccessToken();
    console.log(twitchAccessToken);
    // Set up interval to check Twitch live status every 10 seconds
    setInterval(checkTwitchLiveStatus, 10000); 
    
}
);

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('Error executing command:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

client.login(token);
