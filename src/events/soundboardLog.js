const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');
const { resolveChannel } = require('../utils/channelHelper');

// Deduplication map to prevent double logging if both raw and VoiceChannelEffectSend trigger
const recentSoundboardLogs = new Map();

function cleanDedupeMap() {
  const now = Date.now();
  for (const [key, timestamp] of recentSoundboardLogs.entries()) {
    if (now - timestamp > 5000) {
      recentSoundboardLogs.delete(key);
    }
  }
}

setInterval(cleanDedupeMap, 10000);

module.exports = {
  name: 'raw',
  async execute(packet, client) {
    try {
      if (!packet || !packet.t || !packet.d) return;

      const eventType = packet.t;
      const data = packet.d;

      // 1. Soundboard Sound Played in VC
      if (eventType === 'VOICE_CHANNEL_EFFECT_SEND') {
        const { guild_id, channel_id, user_id, sound_id, sound_volume, emoji } = data;
        if (!guild_id || !user_id || !channel_id) return;

        // Deduplicate events within 2 seconds
        const dedupeKey = `${user_id}_${sound_id}_${channel_id}`;
        const nowMs = Date.now();
        if (recentSoundboardLogs.has(dedupeKey)) return;
        recentSoundboardLogs.set(dedupeKey, nowMs);

        const guild = client.guilds.cache.get(guild_id);
        if (!guild) return;

        const logChannel = resolveChannel(guild, config.channels.soundboardLogs, 'Soundboard Logs');
        if (!logChannel) return;

        let userTag = 'Unknown User';
        let avatarUrl = guild.iconURL({ dynamic: true });

        try {
          const member = await guild.members.fetch(user_id).catch(() => null);
          if (member) {
            userTag = member.user.tag;
            avatarUrl = member.user.displayAvatarURL({ dynamic: true, size: 256 });
          }
        } catch (_) {}

        // Resolve sound name if cached in guild soundboards
        let soundName = sound_id ? `Sound (ID: ${sound_id})` : 'Soundboard Effect';
        let emojiStr = '';

        if (emoji) {
          if (emoji.id) {
            emojiStr = `<:${emoji.name}:${emoji.id}>`;
          } else if (emoji.name) {
            emojiStr = emoji.name;
          }
        }

        if (guild.soundboards && sound_id) {
          const soundObj = guild.soundboards.cache.get(sound_id);
          if (soundObj?.name) {
            soundName = soundObj.name;
          }
        }

        const volumePercent = sound_volume != null ? Math.round(sound_volume * 100) : 100;
        const unixTime = Math.floor(nowMs / 1000);

        const embed = new EmbedBuilder()
          .setTitle('🔊 Soundboard Sound Played')
          .setColor(config.colors.soundboardLog || 0x9B59B6)
          .setDescription(`<@${user_id}> played soundboard sound **${soundName}** ${emojiStr} in <#${channel_id}>`)
          .addFields(
            { name: '👤 User', value: `<@${user_id}> (\`${userTag}\`)`, inline: true },
            { name: '🔊 Voice Channel', value: `<#${channel_id}>`, inline: true },
            { name: '🎵 Sound Played', value: `${emojiStr} **${soundName}**`, inline: true },
            { name: '🔊 Volume', value: `\`${volumePercent}%\``, inline: true },
            { name: '🕒 Time', value: `<t:${unixTime}:F> (<t:${unixTime}:R>)`, inline: false }
          )
          .setThumbnail(avatarUrl)
          .setTimestamp()
          .setFooter({ text: `User ID: ${user_id} | Channel ID: ${channel_id}`, iconURL: avatarUrl });

        await logChannel.send({ embeds: [embed] }).catch((err) => {
          logger.error(`Failed to send Soundboard log in #${logChannel.name}: ${err.message}`);
        });
      }

      // 2. Soundboard Sound Created
      else if (eventType === 'GUILD_SOUNDBOARD_SOUND_CREATE') {
        const { guild_id, sound_id, name, emoji_name, emoji_id, user } = data;
        const guild = client.guilds.cache.get(guild_id);
        if (!guild) return;

        const logChannel = resolveChannel(guild, config.channels.soundboardLogs, 'Soundboard Logs');
        if (!logChannel) return;

        const emojiStr = emoji_id ? `<:${emoji_name}:${emoji_id}>` : (emoji_name || '');
        const unixTime = Math.floor(Date.now() / 1000);
        const creatorMention = user?.id ? `<@${user.id}>` : 'Unknown Administrator';

        const embed = new EmbedBuilder()
          .setTitle('➕ Soundboard Sound Added')
          .setColor(0x2ECC71)
          .setDescription(`New soundboard sound **${name}** ${emojiStr} was created by ${creatorMention}`)
          .addFields(
            { name: '🎵 Sound Name', value: `${emojiStr} **${name}**`, inline: true },
            { name: '🆔 Sound ID', value: `\`${sound_id}\``, inline: true },
            { name: '👤 Created By', value: creatorMention, inline: true },
            { name: '🕒 Created At', value: `<t:${unixTime}:F>`, inline: false }
          )
          .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
      }

      // 3. Soundboard Sound Deleted
      else if (eventType === 'GUILD_SOUNDBOARD_SOUND_DELETE') {
        const { guild_id, sound_id, name } = data;
        const guild = client.guilds.cache.get(guild_id);
        if (!guild) return;

        const logChannel = resolveChannel(guild, config.channels.soundboardLogs, 'Soundboard Logs');
        if (!logChannel) return;

        const unixTime = Math.floor(Date.now() / 1000);

        const embed = new EmbedBuilder()
          .setTitle('🗑️ Soundboard Sound Removed')
          .setColor(0xE74C3C)
          .setDescription(`Soundboard sound **${name || sound_id}** was removed from the server`)
          .addFields(
            { name: '🎵 Sound Name', value: `**${name || 'Unknown'}**`, inline: true },
            { name: '🆔 Sound ID', value: `\`${sound_id}\``, inline: true },
            { name: '🕒 Removed At', value: `<t:${unixTime}:F>`, inline: false }
          )
          .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (err) {
      logger.error(`Error in soundboardLog raw event handler: ${err.message}`);
    }
  }
};
