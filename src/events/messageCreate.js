const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');
const logger = require('../utils/logger');
const config = require('../config');
const { resolveChannel } = require('../utils/channelHelper');
const { deployRolesPanel } = require('../utils/rolesPanel');
const { formatUserTag, toSmallCaps } = require('../utils/formatters');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;

    // ==========================================
    // 1. Handle Direct Messages (DMs sent to Bot)
    // ==========================================
    if (!message.guild) {
      const user = message.author;
      const userAvatar = user.displayAvatarURL({ dynamic: true, size: 256 });
      logger.info(`[DM Received] From ${formatUserTag(user)} (ID: ${user.id}): "${message.content}"`);

      // Find #dms channel in any guild the bot is in
      let dmsChannel = null;
      for (const guild of message.client.guilds.cache.values()) {
        const found = resolveChannel(guild, config.channels.dms, 'DMs Channel');
        if (found) {
          dmsChannel = found;
          break;
        }
      }

      if (!dmsChannel) {
        logger.warn(`Received DM from ${user.tag}, but could not find a "#dms" channel on any server.`);
        return;
      }

      // Build DM Log Embed
      const dmEmbed = new EmbedBuilder()
        .setColor(config.colors.dms)
        .setAuthor({
          name: `${toSmallCaps('Direct Message from')} ${formatUserTag(user)}`,
          iconURL: userAvatar
        })
        .setTitle(`💬 ${toSmallCaps('New Private Message Received')}`)
        .setDescription(message.content || '*(No text content)*')
        .addFields(
          {
            name: `👤 ${toSmallCaps('User')}`,
            value: `${user} (\`${formatUserTag(user)}\`)`,
            inline: true
          },
          {
            name: `🆔 ${toSmallCaps('User ID')}`,
            value: `\`${user.id}\``,
            inline: true
          }
        )
        .setThumbnail(userAvatar)
        .setFooter({ text: `User ID: ${user.id}` })
        .setTimestamp();

      // Handle attachments if user sent images or files
      if (message.attachments.size > 0) {
        const attachmentUrls = message.attachments.map((a) => a.url).join('\n');
        dmEmbed.addFields({
          name: `📎 ${toSmallCaps('Attachments')}`,
          value: attachmentUrls.slice(0, 1024)
        });
        const firstImage = message.attachments.find((a) => a.contentType?.startsWith('image/'));
        if (firstImage) {
          dmEmbed.setImage(firstImage.url);
        }
      }

      // Interactive Reply Button
      const replyRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`reply_dm_${user.id}`)
          .setLabel(toSmallCaps(`Reply to ${user.username}`))
          .setStyle(ButtonStyle.Primary)
          .setEmoji('💬')
      );

      try {
        await dmsChannel.send({
          content: `📬 **New DM from ${user}:**`,
          embeds: [dmEmbed],
          components: [replyRow]
        });
        logger.success(`Forwarded DM from ${user.tag} to #${dmsChannel.name}`);

        // React to user DM with checkmark as receipt
        await message.react('✅').catch(() => {});
      } catch (err) {
        logger.error(`Failed to forward DM to #${dmsChannel.name}: ${err.message}`);
      }
      return;
    }

    // ==========================================
    // 2. Handle Server Commands (!setup-roles)
    // ==========================================
    if (message.content.toLowerCase().trim() === '!setup-roles') {
      if (
        !message.member.permissions.has(PermissionFlagsBits.Administrator) &&
        !message.member.permissions.has(PermissionFlagsBits.ManageRoles)
      ) {
        return message.reply('❌ You must have "Administrator" or "Manage Roles" permissions to use this command.');
      }

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
