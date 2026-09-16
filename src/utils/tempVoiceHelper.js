const { ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const logger = require('./logger');
const { toSmallCaps } = require('./formatters');

// Set to track created temporary channel IDs in memory
const tempChannels = new Set();

/**
 * Check if a voice channel is a trigger channel for creating temporary voice channels.
 * @param {import('discord.js').VoiceChannel} channel 
 * @returns {boolean}
 */
function isTriggerChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildVoice) return false;

  // 1. Check configured ID
  if (config.channels.createVoice?.id && channel.id === config.channels.createVoice.id) {
    return true;
  }

  const cleanName = channel.name.toLowerCase().trim();

  // 2. Check configured names
  if (config.channels.createVoice?.names) {
    const isConfiguredMatch = config.channels.createVoice.names.some(
      (name) => cleanName === name.toLowerCase().trim() || cleanName.includes(name.toLowerCase().trim())
    );
    if (isConfiguredMatch) return true;
  }

  // 3. Check general pattern keywords (e.g. "create voice", "join to create", "create vc")
  return (
    cleanName.includes('create voice') ||
    cleanName.includes('create-voice') ||
    cleanName.includes('join to create') ||
    cleanName.includes('create vc') ||
    cleanName.includes('ᴄʀᴇᴀᴛᴇ ᴠᴏɪᴄᴇ') ||
    cleanName.startsWith('➕')
  );
}

/**
 * Check if a voice channel is a bot-created temporary channel.
 * @param {import('discord.js').VoiceChannel} channel 
 * @returns {boolean}
 */
function isTempChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildVoice) return false;
  if (tempChannels.has(channel.id)) return true;

  // Fallback: check if channel name starts with 🔊 or contains small caps room/vc and is not a trigger channel
  return (
    (channel.name.startsWith('🔊') || channel.name.includes('ʀᴏᴏᴍ') || channel.name.includes('ᴠᴄ')) &&
    !isTriggerChannel(channel)
  );
}

/**
 * Handle user joining a trigger channel to spawn a temporary voice channel.
 * @param {import('discord.js').GuildMember} member 
 * @param {import('discord.js').VoiceChannel} triggerChannel 
 */
async function createTempVoiceChannel(member, triggerChannel) {
  if (!member || !triggerChannel) return;

  const { guild } = triggerChannel;
  // Apply Small Caps font to room name to match server aesthetic
  const roomName = `🔊 ${toSmallCaps(`${member.displayName}'s Room`)}`;

  try {
    const botMember = guild.members.me;

    // Create the temporary voice channel in the same category as the trigger channel
    const tempChannel = await guild.channels.create({
      name: roomName,
      type: ChannelType.GuildVoice,
      parent: triggerChannel.parentId || undefined,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers
          ]
        },
        ...(botMember
          ? [
              {
                id: botMember.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.MoveMembers
                ]
              }
            ]
          : [])
      ],
      reason: `Join-to-Create voice channel for ${member.user.tag}`
    });

    tempChannels.add(tempChannel.id);
    logger.info(`[${guild.name}] Created temporary voice channel "${tempChannel.name}" for ${member.user.tag}`);

    // Move user into newly created channel
    if (member.voice.channelId) {
      await member.voice.setChannel(tempChannel).catch((err) => {
        logger.warn(`[${guild.name}] Could not move ${member.user.tag} to new temp VC: ${err.message}`);
      });
    }

    return tempChannel;
  } catch (err) {
    logger.error(`[${guild.name}] Failed to create temporary voice channel: ${err.message}`);
    return null;
  }
}

/**
 * Handle channel deletion when empty.
 * @param {import('discord.js').VoiceChannel} channel 
 */
async function checkAndDeleteTempChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildVoice) return;

  // Never delete trigger channels!
  if (isTriggerChannel(channel)) return;

  // Wait 1 second for voice state updates to resolve before checking if empty
  setTimeout(async () => {
    try {
      const fetched = channel.guild.channels.cache.get(channel.id);
      if (fetched && isTempChannel(fetched) && fetched.members.size === 0) {
        await fetched.delete('Temporary voice channel empty').catch(() => {});
        tempChannels.delete(fetched.id);
        logger.info(`[${channel.guild.name}] Deleted empty temporary voice channel "${fetched.name}"`);
      }
    } catch (err) {
      logger.error(`[${channel.guild.name}] Failed to delete empty temp VC "${channel.name}": ${err.message}`);
    }
  }, 1000);
}

module.exports = {
  isTriggerChannel,
  isTempChannel,
  createTempVoiceChannel,
  checkAndDeleteTempChannel
};
