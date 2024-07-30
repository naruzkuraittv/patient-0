const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');

let config;
try {
    config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
} catch (error) {
    console.error('Error reading config.json:', error);
    process.exit(1);
}

const clientId = config.twclientId;
const clientSecret = config.twclientSecret;
const twitchUsername = config.twitchUsername;

async function getAccessToken() {
    try {
        const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: clientId,
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

async function isTwitchChannelLive(username, accessToken) {
    try {
        const response = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${username}`, {
            headers: {
                'Client-ID': clientId,
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('iskittlive')
        .setDescription('Check if Kitt is live on Twitch'),
    async execute(interaction) {
        const accessToken = await getAccessToken();
        if (!accessToken) {
            await interaction.reply('Failed to retrieve access token.');
            return;
        }
        const live = await isTwitchChannelLive(twitchUsername, accessToken);
        if (live) {
            await interaction.reply('The Twitch channel is live right now!');
        } else {
            if (Math.random() < 0.03) {
                await interaction.reply('The Twitch channel is not live right now! QwQ');
            } else {
                await interaction.reply('The Twitch channel is not live right now!');
            }
        }
    },
};
