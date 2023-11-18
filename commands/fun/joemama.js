const { SlashCommandBuilder } = require('discord.js');

function generateLaugh() {
    const laughTypes = ['ah', 'hah', 'aha', 'ahh', 'hhh', 'hha', 'haa', 'aaa', 'ha', 'aa'];
    let laugh = '';
    while (laugh.length < 20) {
        const laughType = laughTypes[Math.floor(Math.random() * laughTypes.length)];
        const isUpperCase = Math.random() < 0.5;
        const chunk = isUpperCase ? laughType.toUpperCase() : laughType;
        laugh += chunk;
        // Trim if exceed 20 characters
        if (laugh.length > 20) laugh = laugh.substring(0, 20);
    }
    return laugh;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('joemama')
        .setDescription('Responds with a random laugh or a special message'),
    async execute(interaction) {
        // 3% chance to send the special message
        if (Math.random() < 0.03) {
            await interaction.reply(`Not funny, bro <@688298096941203465>`);
        } else {
            await interaction.reply(generateLaugh());
        }
    },
};
