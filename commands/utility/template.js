// this file is named template.js and it is located in path: */bot/commands/ at */bot/commands/template.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('template')
		.setDescription('template command description'),
	async execute(interaction) {
		// interaction.user is the object representing the User who ran the command
		// interaction.member is the GuildMember object, which represents the user in the specific guild
		await interaction.reply(`This test command was run by ${interaction.user.username}, who joined on ${interaction.member.joinedAt}.`);
	},
};
