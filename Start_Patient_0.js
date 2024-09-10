const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline'); // Correctly import readline
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');//define axios
const axios = require('axios');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const { token, clientId } = require('./secrets.json');
const commands = [];

client.commands = new Collection();
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
let twitchAccessToken;


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
    const channel = await client.channels.fetch(announcements_channel);
    console.log(isLive);
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
        console.log(`would've sent message to channel ${channel}, that channels name is ${channel.name}`);

    }
}

// Helper function to check if the channel is live
async function isTwitchChannelLive(username, accessToken) {
    try {
        let response = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${username}`, {
            headers: {
                'Client-ID': config.twclientId,
                'Authorization': `Bearer ${accessToken}`
            }
        });
        console.log(response);
        let data = response.data.data;

        // Check if the channel is live
        return data.length > 0 && data[0].type === 'live';
    } catch (error) {
        console.error('Error fetching Twitch stream data:', error);

        // Try to refresh the token and make the request again
        try {
            twitchAccessToken = await getAccessToken(); // Fetch new token if needed
            const response = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${username}`, {
                headers: {
                    'Client-ID': config.twclientId,
                    'Authorization': `Bearer ${twitchAccessToken}`
                }
            });
            const data = response.data.data;

            // Check if the channel is live
            return data.length > 0 && data[0].type === 'live';
        } catch (tokenError) {
            console.error('Error fetching Twitch stream data with new token:', tokenError);
            return false;
        }
    }
}


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

// Function to remove the role from all members
const removeRoleFromAll = async (guild, roleId) => {
    const role = guild.roles.cache.get(roleId);
    if (role) {
        const membersWithRole = role.members;
        await Promise.all(membersWithRole.map(member => member.roles.remove(role)));
        console.log(`Role ${role.name} removed from all members.`);
    } else {
        console.warn(`Role with ID ${roleId} not found`);
    }
};


client.once(Events.ClientReady, async () => {
    console.log('Client ready. setting interval');
    setInterval(checkTwitchLiveStatus, 10000); 
    console.log('interval set, loading commands...');
    loadCommands(path.join(__dirname, 'commands'));
    console.log('Commands loaded. Clearing and registering commands...');
    await clearAndRegisterCommands();
});


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



client.on('voiceStateUpdate', async (oldState, newState) => {
    const voiceChannelId = '1139260093330890752'; // ID of the specific voice channel
    const roleId = '1162572338911518771'; // ID of the role to assign or remove

    // Check if user joined the specified voice channel
    if (newState.channelId === voiceChannelId && oldState.channelId !== voiceChannelId) {
        try {
            const member = newState.member;
            const role = newState.guild.roles.cache.get(roleId);
            if (role) {
                await member.roles.add(role);
                console.log(`Role ${role.name} added to user ${member.displayName}`);
            } else {
                console.warn(`Role with ID ${roleId} not found`);
            }
        } catch (error) {
            console.error('Error adding role to user:', error);
        }
    }

    // Check if the voice channel is empty after a member leaves
    if (oldState.channelId === voiceChannelId && newState.channelId !== voiceChannelId) {
        const voiceChannel = newState.guild.channels.cache.get(voiceChannelId);
        if (voiceChannel && voiceChannel.members.size === 0) {
            // Remove the role from all members
            await removeRoleFromAll(newState.guild, roleId);
        }
    }
});

client.login(token);
