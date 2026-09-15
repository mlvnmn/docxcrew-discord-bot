const { ChannelType, PermissionFlagsBits } = require('discord.js');
const logger = require('./logger');

/**
 * Resolves a target text channel by specific ID or prioritized list of channel names.
 * Also checks bot permissions to prevent silent failures.
 * 
 * @param {import('discord.js').Guild} guild The guild to search within
 * @param {object} channelConfig Config object containing optional `id` and `names` array
 * @param {string} purpose Contextual label for logging (e.g. 'Welcome', 'Join Log')
 * @returns {import('discord.js').TextChannel|null}
 */
function resolveChannel(guild, channelConfig, purpose = 'Channel') {
  if (!guild || !guild.channels) {
    logger.warn(`Cannot resolve ${purpose}: Invalid guild provided.`);
    return null;
  }

  let channel = null;

  // 1. Try finding by ID if provided
  if (channelConfig.id) {
    channel = guild.channels.cache.get(channelConfig.id);
  }

  // 2. Try finding by candidate names in order
  if (!channel && Array.isArray(channelConfig.names)) {
    for (const name of channelConfig.names) {
      if (!name) continue;
      const cleanName = name.toLowerCase().trim();
      channel = guild.channels.cache.find(
        (c) =>
          c.name.toLowerCase() === cleanName &&
          (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
      );
      if (channel) break;
    }
  }

  // If still not found, return null
  if (!channel) {
    const attemptedNames = (channelConfig.names || []).filter(Boolean).join(', ');
    logger.warn(
      `[${guild.name}] ${purpose} channel not found. Looked for ID "${channelConfig.id || 'none'}" or names: [${attemptedNames}].`
    );
    return null;
  }

  // Validate bot permissions in this channel
  const botMember = guild.members.me;
  if (botMember) {
    const permissions = channel.permissionsFor(botMember);
    const requiredPermissions = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks
    ];

    const missing = requiredPermissions.filter((perm) => !permissions.has(perm));
    if (missing.length > 0) {
      logger.warn(
        `[${guild.name}] Missing permissions in #${channel.name} (${purpose}): Bot needs View Channel, Send Messages, and Embed Links.`
      );
      return null;
    }
  }

  return channel;
}

module.exports = {
  resolveChannel
};
