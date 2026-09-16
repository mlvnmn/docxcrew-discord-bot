const { Events } = require('discord.js');
const logger = require('../utils/logger');
const { resolveVoiceChannelW, isAllowed } = require('../utils/privateVoiceHelper');
const { isTriggerChannel, createTempVoiceChannel, checkAndDeleteTempChannel } = require('../utils/tempVoiceHelper');
const { formatUserTag } = require('../utils/formatters');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;
    const member = newState.member || oldState.member;

    // 1. Handle member leaving a channel (delete temporary voice channel if empty)
    if (oldChannel && oldChannel.id !== newChannel?.id) {
      await checkAndDeleteTempChannel(oldChannel);
    }

    // 2. Handle member joining or moving into a channel
    if (!newChannel || !member) return;

    // A. Check if joined channel is a "Create Voice" trigger channel
    if (isTriggerChannel(newChannel)) {
      await createTempVoiceChannel(member, newChannel);
      return;
    }

    // B. Check if joined channel is private voice channel 'w'
    const guild = newState.guild;
    const voiceChannelW = resolveVoiceChannelW(guild);

    if (voiceChannelW && newChannel.id === voiceChannelW.id) {
      if (!isAllowed(guild, member.id)) {
        try {
          await member.voice.setChannel(null);
          logger.warn(
            `[${guild.name}] [Private VC Security] Disconnected unauthorized user ${formatUserTag(member.user)} (ID: ${member.id}) from channel '${voiceChannelW.name}'.`
          );

          await member.send({
            content: `🔒 **Access Denied**: Voice channel **#${voiceChannelW.name}** in **${guild.name}** is strictly private. Only authorized users can enter (administrators included).`
          }).catch(() => {});
        } catch (err) {
          logger.error(`Failed to eject unauthorized member ${member.user.tag} from private voice channel: ${err.message}`);
        }
      }
    }
  }
};
