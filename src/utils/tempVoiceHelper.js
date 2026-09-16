const { ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const logger = require('./logger');

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

  // Fallback: check if channel name starts with 🔊 and is not a trigger channel
  return channel.name.startsWith('🔊') && !isTriggerChannel(channel);
}

/**
 * Handle user joining a trigger channel to spawn a temporary voice channel.
 * @param {import('discord.js').GuildMember} member 
 * @param {import('discord.js').VoiceChannel} triggerChannel 
 */
async function createTempVoiceChannel(member, triggerChannel) {
  if (!member || !triggerChannel) return;

  const { guild } = triggerChannel;
  const roomName = `🔊 ${member.displayName}'s Room`;

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

    // Safety check: If user left before move completed, delete channel immediately
    if (tempChannel.members.size === 0) {
      await tempChannel.delete('Temporary VC left empty immediately after creation').catch(() => {});
      tempChannels.delete(tempChannel.id);
      logger.info(`[${guild.name}] Deleted empty temporary voice channel "${tempChannel.name}"`);
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

  // Only delete temporary channels that have 0 members
  if (isTempChannel(channel) && channel.members.size === 0) {
    try {
      await channel.delete('Temporary voice channel empty');
      tempChannels.delete(channel.id);
      logger.info(`[${channel.guild.name}] Deleted empty temporary voice channel "${channel.name}"`);
    } catch (err) {
      logger.error(`[${channel.guild.name}] Failed to delete empty temp VC "${channel.name}": ${err.message}`);
    }
  }
}

module.exports = {
  isTriggerChannel,
  isTempChannel,
  createTempVoiceChannel,
  checkAndDeleteTempChannel
};
