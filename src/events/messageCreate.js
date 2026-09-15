const { Events, PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const config = require('../config');
const { resolveChannel } = require('../utils/channelHelper');
const { deployRolesPanel } = require('../utils/rolesPanel');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    // Command to manually deploy or refresh the roles panel: !setup-roles
    if (message.content.toLowerCase().trim() === '!setup-roles') {
      // Permission check: Administrator or ManageRoles
      if (
        !message.member.permissions.has(PermissionFlagsBits.Administrator) &&
        !message.member.permissions.has(PermissionFlagsBits.ManageRoles)
      ) {
        return message.reply('❌ You must have "Administrator" or "Manage Roles" permissions to use this command.');
      }

      // Check if current channel is the roles channel or resolve configured roles channel
      let targetChannel = null;
      if (
        config.channels.roles.names.some(
          (name) => name.toLowerCase() === message.channel.name.toLowerCase()
        )
      ) {
        targetChannel = message.channel;
      } else {
        targetChannel = resolveChannel(message.guild, config.channels.roles, 'Roles Channel');
      }

      if (!targetChannel) {
        return message.reply(
          `⚠️ Could not find the roles channel (looked for \`#${config.channels.roles.names[0]}\`). Please create a channel named \`#roles\` first or run this command directly inside it!`
        );
      }

      const deployed = await deployRolesPanel(targetChannel);
      if (deployed) {
        return message.reply(`✅ Roles selection panel successfully deployed to ${targetChannel}!`);
      } else {
        return message.reply(`⚠️ Failed to deploy role panel. Check bot permissions in ${targetChannel}.`);
      }
    }
  }
};
