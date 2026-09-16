const { Events } = require('discord.js');
const logger = require('../utils/logger');
const { resolveVoiceChannelW, isAllowed } = require('../utils/privateVoiceHelper');
const { formatUserTag } = require('../utils/formatters');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    // Only care if member joined or moved into a channel
    const newChannel = newState.channel;
    if (!newChannel) return;

    const guild = newState.guild;
    const voiceChannelW = resolveVoiceChannelW(guild);

    // Check if the joined channel is private voice channel 'w'
    if (!voiceChannelW || newChannel.id !== voiceChannelW.id) return;

    const member = newState.member;
    if (!member) return;

    // Check if member is allowed in 'w'
    if (!isAllowed(guild, member.id)) {
      try {
        // Disconnect/Kick unauthorized user from the voice channel instantly
        await member.voice.setChannel(null);

        logger.warn(
          `[${guild.name}] [Private VC Security] Disconnected unauthorized user ${formatUserTag(member.user)} (ID: ${member.id}) from channel '${voiceChannelW.name}'.`
        );

        // Notify member via DM
        await member.send({
          content: `🔒 **Access Denied**: Voice channel **#${voiceChannelW.name}** in **${guild.name}** is strictly private. Only authorized users can enter (administrators included).`
        }).catch(() => {
          // Ignore if user has DMs closed
        });
      } catch (err) {
        logger.error(`Failed to eject unauthorized member ${member.user.tag} from private voice channel: ${err.message}`);
      }
    }
  }
};
