require('dotenv').config();

const { Client, GatewayIntentBits, SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { exec } = require('child_process');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const APPLICATION_ID = process.env.APPLICATION_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder()
    .setName('login')
    .setDescription('Se connecter au selfbot (token)')
    .addStringOption(option =>
      option.setName('token')
        .setDescription('Ton token Discord')
        .setRequired(true)
    )
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(APPLICATION_ID, GUILD_ID),
      { body: commands }
    );
    console.log('Commande /login enregistrée (guild command)');
  } catch (error) {
    console.error('Erreur lors de l’enregistrement des commandes :', error);
  }
})();

client.on('ready', () => {
  console.log(`Bot prêt : ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'login') {
    if (interaction.channelId !== CHANNEL_ID) {
      return interaction.reply({ content: 'Cette commande ne peut être utilisée que dans le channel dédié.', ephemeral: true });
    }

    const token = interaction.options.getString('token');

    await interaction.reply({ content: 'Connexion en cours...', ephemeral: true });

    exec(`node selfbot.js "${token}"`, (error, stdout, stderr) => {
      if (error) {
        interaction.followUp({ content: `Erreur lors du lancement du selfbot: ${error.message}`, ephemeral: true });
        return;
      }
      interaction.followUp({ content: `Selfbot lancé avec succès.`, ephemeral: true });
    });
  }
});

client.login(BOT_TOKEN);
