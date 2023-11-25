//is the main bot for patient 0
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline'); // Correctly import readline
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { token, clientId } = require('./secrets.json');

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
    console.log('Client ready. Loading commands...');
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
