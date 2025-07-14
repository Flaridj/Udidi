const { Client, IntentsBitField } = require('discord.js-selfbot-v13');

const token = process.argv[2];
if (!token) {
  console.error('Token requis en argument');
  process.exit(1);
}

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.DirectMessages,
  ],
  partials: ['CHANNEL'],
});

client.on('ready', () => {
  console.log(`${client.user.tag} (selfbot) prêt !`);
});

let afk = {
  active: false,
  message: '',
  mode: 'CHANNEL', // 'DM' ou 'CHANNEL'
};

async function askQuestion(channel, question, options, authorId) {
  let text = question + '\n';
  options.forEach((opt, i) => {
    text += `${i + 1}. ${opt}\n`;
  });
  await channel.send(text);

  const filter = m => m.author.id === authorId && /^[1-9]\d*$/.test(m.content) && parseInt(m.content) <= options.length;

  try {
    const collected = await channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] });
    return parseInt(collected.first().content);
  } catch {
    await channel.send('Temps écoulé, opération annulée.');
    throw new Error('Timeout');
  }
}

client.on('messageCreate', async message => {
  if (message.author.id !== client.user.id) {
    // Gestion AFK : si message mentionne le selfbot
    if (afk.active && message.mentions.has(client.user)) {
      try {
        if (afk.mode === 'DM') {
          await message.author.send(`${message.author}, ${afk.message}`);
        } else {
          await message.channel.send(`${message.author}, ${afk.message}`);
        }
      } catch (err) {
        console.error('Erreur en envoyant le message AFK:', err);
      }
    }
    return; // On traite uniquement nos messages plus bas
  }

  const args = message.content.trim().split(' ');
  const command = args[0].toLowerCase();

  // Désactivation AFK automatique si actif et message différent de ?afk
  if (afk.active && command !== '?afk') {
    afk.active = false;
    afk.message = '';
    afk.mode = 'CHANNEL';
    message.channel.send('✅ Mode AFK désactivé, bienvenue de retour !');
  }

  // ?voice [channelId]
  if (command === '?voice' && args[1]) {
    const channelId = args[1];
    const channel = client.channels.cache.get(channelId);
    if (!channel || channel.type !== 2) {
      return message.channel.send('ID de channel vocal invalide.');
    }
    try {
      await channel.join();
      message.channel.send(`Connecté au vocal ${channel.name}`);
    } catch (err) {
      message.channel.send(`Erreur lors de la connexion au vocal: ${err.message}`);
    }
  }

  // ?grab [userId] [lien] [ping]
  else if (command === '?grab' && args.length >= 4) {
    const userId = args[1];
    const lien = args[2];
    const ping = args.slice(3).join(' ');

    try {
      const user = await client.users.fetch(userId);
      if (!user) return message.channel.send('Utilisateur introuvable.');

      await user.send(`Cc ça va ${ping} ?`);

      const filter = m => m.author.id === userId;
      const collected = await user.dmChannel.awaitMessages({ filter, max: 1, time: 300000 });

      if (!collected.size) {
        return message.channel.send('Pas de réponse de l\'utilisateur.');
      }

      await user.send(`Ça te dirait de venir sur ${lien} ? On rush le top 3fr ping ${ping} dans ticket owner et je te rank.`);
      message.channel.send(`Message envoyé à ${user.tag} et réponse reçue.`);

    } catch (err) {
      message.channel.send(`Erreur lors de l'envoi du message : ${err.message}`);
    }
  }

  // ?presence
  else if (command === '?presence') {
    const channel = message.channel;
    const authorId = message.author.id;

    try {
      const activityTypes = ['Playing', 'Streaming', 'Listening', 'Watching', 'Competing'];
      const typeIndex = await askQuestion(channel, 'Quel type d\'activité veux-tu afficher ?', activityTypes, authorId);

      await channel.send('Quel message veux-tu afficher ? (exemple : "League of Legends")');
      const filterText = m => m.author.id === authorId;
      const collectedText = await channel.awaitMessages({ filter: filterText, max: 1, time: 120000, errors: ['time'] });
      const activityText = collectedText.first().content;

      const statuses = ['Online', 'Idle', 'Do Not Disturb', 'Invisible'];
      const statusIndex = await askQuestion(channel, 'Quel statut Discord veux-tu ?', statuses, authorId);

      const discordActivityTypes = [0, 1, 2, 3, 5];
      const discordStatuses = ['online', 'idle', 'dnd', 'invisible'];

      let streamingUrl = null;
      if (discordActivityTypes[typeIndex - 1] === 1) {
        await channel.send('Pour le streaming, entre l\'URL (exemple: https://twitch.tv/tonpseudo) ou tape "none" :');
        const collectedUrl = await channel.awaitMessages({ filter: filterText, max: 1, time: 120000, errors: ['time'] });
        const url = collectedUrl.first().content;
        streamingUrl = (url.toLowerCase() === 'none') ? null : url;
      }

      await client.user.setPresence({
        activities: [{
          name: activityText,
          type: discordActivityTypes[typeIndex - 1],
          url: streamingUrl,
        }],
        status: discordStatuses[statusIndex - 1],
      });

      channel.send(`✅ Présence mise à jour : ${activityTypes[typeIndex - 1]} ${activityText}, statut ${statuses[statusIndex - 1]}`);

    } catch (err) {
      if (err.message === 'Timeout') return;
      channel.send(`Erreur: ${err.message}`);
    }
  }

  // ?afk [message] [DM|CHANNEL]
  else if (command === '?afk' && args.length >= 3) {
    const mode = args[args.length - 1].toUpperCase();
    if (mode !== 'DM' && mode !== 'CHANNEL') {
      return message.channel.send('Le mode doit être "DM" ou "CHANNEL".');
    }
    const msg = args.slice(1, -1).join(' ');
    if (!msg) {
      return message.channel.send('Tu dois fournir un message AFK.');
    }

    afk.active = true;
    afk.message = msg;
    afk.mode = mode;

    message.channel.send(`Mode AFK activé avec le message : "${msg}" (réponse en ${mode})`);
  }
});

client.login(token);
