const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  MessageFlags
} = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');
const { resolveChannel, styleAllChannels } = require('../utils/channelHelper');
const { resolveRole, safelyAddRole, safelyRemoveRole } = require('../utils/roleHelper');
const { deployRolesPanel } = require('../utils/rolesPanel');
const { formatUserTag, toSmallCaps } = require('../utils/formatters');

// In-memory set to prevent spamming duplicate pending requests while bot is running
const pendingCrewRequests = new Set();

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // ==========================================
    // Handle Modal Submissions
    // ==========================================
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('modal_reply_dm_')) {
        const targetUserId = interaction.customId.replace('modal_reply_dm_', '');
        const replyText = interaction.fields.getTextInputValue('reply_text_input');

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
        if (!targetUser) {
          return interaction.editReply({
            content: '❌ User could not be found or fetched.'
          });
        }

        try {
          // Send plain text message directly to user's DMs
          await targetUser.send(replyText);

          // Log sent reply in #dms channel
          const replyLogEmbed = new EmbedBuilder()
            .setColor(config.colors.joinLog)
            .setAuthor({
              name: `Reply Sent to ${formatUserTag(targetUser)}`,
              iconURL: targetUser.displayAvatarURL({ dynamic: true })
            })
            .setDescription(`💬 **Reply sent by ${interaction.user}:**\n> ${replyText.replace(/\n/g, '\n> ')}`)
            .setFooter({ text: `Target User ID: ${targetUserId}` })
            .setTimestamp();

          await interaction.channel.send({ embeds: [replyLogEmbed] });

          logger.success(`Admin ${interaction.user.tag} sent DM reply to ${targetUser.tag}`);
          return interaction.editReply({
            content: `✅ Successfully sent DM reply to **${formatUserTag(targetUser)}**!`
          });
        } catch (err) {
          logger.error(`Failed to send DM to ${targetUser.tag}: ${err.message}`);
          return interaction.editReply({
            content: `❌ Could not send DM to **${formatUserTag(targetUser)}**. They may have Direct Messages disabled or blocked the bot.`
          });
        }
      }
      return;
    }

    // ==========================================
    // Handle /setup-roles and /clear-chat Slash Commands
    // ==========================================
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'setup-roles') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let targetChannel = null;
        if (
          config.channels.roles.names.some(
            (name) => name.toLowerCase() === interaction.channel.name.toLowerCase()
          )
        ) {
          targetChannel = interaction.channel;
        } else {
          targetChannel = resolveChannel(interaction.guild, config.channels.roles, 'Roles Channel');
        }

        if (!targetChannel) {
          return interaction.editReply(
            `⚠️ Could not find the roles channel (searched for \`#${config.channels.roles.names[0]}\`). Please create a channel named \`#roles\` first or run this command directly inside it!`
          );
        }

        const deployed = await deployRolesPanel(targetChannel);
        if (deployed) {
          return interaction.editReply(`✅ Roles selection panel successfully deployed to ${targetChannel}!`);
        } else {
          return interaction.editReply(`⚠️ Failed to deploy role panel. Please verify bot permissions in ${targetChannel}.`);
        }
      }

      // ==========================================
      // Handle /clear-chat Slash Command
      // ==========================================
      if (interaction.commandName === 'clear-chat') {
        if (
          !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) &&
          !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
        ) {
          return interaction.reply({
            content: '❌ You must have "Manage Messages" or Administrator permissions to use this command.',
            flags: MessageFlags.Ephemeral
          });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const amount = interaction.options.getInteger('amount') || 100;

        try {
          const deleted = await interaction.channel.bulkDelete(amount, true);

          if (deleted.size === 0) {
            return interaction.editReply(
              '⚠️ No messages were deleted. (Note: Messages older than 14 days cannot be bulk deleted due to Discord API limitations).'
            );
          }

          logger.info(`[${interaction.guild.name}] ${interaction.user.tag} cleared ${deleted.size} messages in #${interaction.channel.name}`);
          return interaction.editReply(
            `🧹 Successfully deleted **${deleted.size}** message(s) in ${interaction.channel}!`
          );
        } catch (err) {
          logger.error(`[${interaction.guild.name}] Error running /clear-chat: ${err.message}`);
          return interaction.editReply(
            `⚠️ Failed to clear messages: ${err.message}`
          );
        }
      }

      // ==========================================
      // Handle /dm Slash Command
      // ==========================================
      if (interaction.commandName === 'dm') {
        if (
          !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) &&
          !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
        ) {
          return interaction.reply({
            content: '❌ You must have "Manage Messages" or Administrator permissions to use this command.',
            flags: MessageFlags.Ephemeral
          });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const targetUser = interaction.options.getUser('user');
        const dmContent = interaction.options.getString('message');

        if (!targetUser) {
          return interaction.editReply('❌ Invalid user specified.');
        }

        try {
          // Send plain text DM to target user
          await targetUser.send(dmContent);

          // Log outgoing DM in #dms channel if found
          const dmsChannel = resolveChannel(interaction.guild, config.channels.dms, 'DMs Channel');
          if (dmsChannel) {
            const replyLogEmbed = new EmbedBuilder()
              .setColor(config.colors.joinLog)
              .setAuthor({
                name: `DM Sent to ${formatUserTag(targetUser)}`,
                iconURL: targetUser.displayAvatarURL({ dynamic: true })
              })
              .setDescription(`💬 **Message sent by ${interaction.user}:**\n> ${dmContent.replace(/\n/g, '\n> ')}`)
              .setFooter({ text: `Target User ID: ${targetUser.id}` })
              .setTimestamp();

            await dmsChannel.send({ embeds: [replyLogEmbed] });
          }

          logger.success(`[${interaction.guild.name}] Admin ${interaction.user.tag} sent DM to ${targetUser.tag}`);
          return interaction.editReply(
            `✅ Successfully sent DM to ${targetUser} (\`${formatUserTag(targetUser)}\`)!`
          );
        } catch (err) {
          logger.error(`[${interaction.guild.name}] Failed to send DM to ${targetUser.tag}: ${err.message}`);
          return interaction.editReply(
            `❌ Could not send DM to ${targetUser} (\`${formatUserTag(targetUser)}\`). They may have Direct Messages disabled or blocked the bot.`
          );
        }
      }

      // ==========================================
      // Handle /style-channels Slash Command
      // ==========================================
      if (interaction.commandName === 'style-channels') {
        if (
          !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
          !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
        ) {
          return interaction.reply({
            content: '❌ You must have "Manage Channels" or Administrator permissions to use this command.',
            flags: MessageFlags.Ephemeral
          });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
          const { updated, skipped } = await styleAllChannels(interaction.guild);
          return interaction.editReply({
            content: `✨ Successfully converted **${updated}** channel(s) & category(ies) to the **Small Caps** aesthetic font! (${skipped} already styled or skipped)`
          });
        } catch (err) {
          logger.error(`[${interaction.guild.name}] Error running /style-channels: ${err.message}`);
          return interaction.editReply({
            content: `⚠️ Failed to style channels: ${err.message}`
          });
        }
      }

      return;
    }

    if (!interaction.isButton()) return;

    const { customId, guild, member, user } = interaction;

    // ==========================================
    // Handle "Reply to User" DM Button Click
    // ==========================================
    if (customId.startsWith('reply_dm_')) {
      const targetUserId = customId.replace('reply_dm_', '');
      const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);

      const modal = new ModalBuilder()
        .setCustomId(`modal_reply_dm_${targetUserId}`)
        .setTitle(`Reply to ${targetUser ? targetUser.username : 'User'}`);

      const replyInput = new TextInputBuilder()
        .setCustomId('reply_text_input')
        .setLabel(`Message to send to ${targetUser ? targetUser.username : 'User'}`)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Type your reply here...')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(replyInput);
      modal.addComponents(row);

      return interaction.showModal(modal);
    }

    if (!guild) return;

    // ==========================================
    // 1. User Clicks "Visitor"
    // ==========================================
    if (customId === 'select_role_visitor') {
      const visitorRole = resolveRole(guild, config.roles.visitor);
      if (!visitorRole) {
        return interaction.reply({
          content: `⚠️ The **${config.roles.visitor.name}** role could not be found. Please notify an administrator.`,
          flags: MessageFlags.Ephemeral
        });
      }

      if (member.roles.cache.has(visitorRole.id)) {
        return interaction.reply({
          content: `✅ You already have the **${visitorRole.name}** role!`,
          flags: MessageFlags.Ephemeral
        });
      }

      const added = await safelyAddRole(member, visitorRole);
      if (added) {
        return interaction.reply({
          content: `✅ You have been granted the **${visitorRole.name}** role!`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        return interaction.reply({
          content: `⚠️ Could not assign the role. Ensure the bot has "Manage Roles" permission and its role is positioned above **${visitorRole.name}**.`,
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // ==========================================
    // 2. User Clicks "Apply for Crew"
    // ==========================================
    if (customId === 'apply_role_crew') {
      const crewRole = resolveRole(guild, config.roles.crew);
      if (!crewRole) {
        return interaction.reply({
          content: `⚠️ The **${config.roles.crew.name}** role could not be found on this server. Please notify an administrator.`,
          flags: MessageFlags.Ephemeral
        });
      }

      // Check if user already has Crew
      if (member.roles.cache.has(crewRole.id)) {
        return interaction.reply({
          content: `🚀 You are already an official member of the **${crewRole.name}**!`,
          flags: MessageFlags.Ephemeral
        });
      }

      // Check for pending request
      if (pendingCrewRequests.has(user.id)) {
        return interaction.reply({
          content: `⏳ You already have a pending application for **${crewRole.name}**. Please wait for an administrator to review it!`,
          flags: MessageFlags.Ephemeral
        });
      }

      // Resolve admin approval channel
      const approvalChannel = resolveChannel(guild, config.channels.crewRequests, 'Crew Requests');
      if (!approvalChannel) {
        return interaction.reply({
          content: `⚠️ The admin approval channel could not be found. Please notify a server administrator to set up the \`#crew-requests\` channel.`,
          flags: MessageFlags.Ephemeral
        });
      }

      // Build Approval Embed for Admins
      const userAvatar = user.displayAvatarURL({ dynamic: true, size: 256 });
      const createdTimestamp = Math.floor(user.createdTimestamp / 1000);
      const joinedTimestamp = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

      const approvalEmbed = new EmbedBuilder()
        .setColor(config.colors.warning)
        .setAuthor({
          name: `${formatUserTag(user)} applied for ${crewRole.name}`,
          iconURL: userAvatar
        })
        .setTitle(`📋 New Crew Role Application`)
        .setDescription(`Member ${member} has requested to join the **${config.serverName} ${crewRole.name}**.`)
        .addFields(
          {
            name: '👤 Applicant',
            value: `${member} (\`${formatUserTag(user)}\`)`,
            inline: true
          },
          {
            name: '🆔 User ID',
            value: `\`${user.id}\``,
            inline: true
          },
          {
            name: '📅 Account Age',
            value: `<t:${createdTimestamp}:F>\n(<t:${createdTimestamp}:R>)`,
            inline: false
          },
          {
            name: '📥 Joined Server',
            value: joinedTimestamp ? `<t:${joinedTimestamp}:F> (<t:${joinedTimestamp}:R>)` : 'Unknown',
            inline: false
          },
          {
            name: '📌 Current Status',
            value: `⏳ **Pending Administrator Review**`,
            inline: false
          }
        )
        .setThumbnail(userAvatar)
        .setFooter({ text: `Applicant ID: ${user.id}` })
        .setTimestamp();

      const approvalRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_crew_${user.id}`)
          .setLabel(`Approve ${crewRole.name}`)
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`reject_crew_${user.id}`)
          .setLabel('Reject')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );

      // Ping role "core" if found
      const coreRole = resolveRole(guild, config.roles.core);
      const coreMention = coreRole ? `${coreRole}` : `\`@${config.roles.core.name}\``;

      await approvalChannel.send({
        content: `${coreMention} 🔔 **New Crew Application** from ${member}:`,
        embeds: [approvalEmbed],
        components: [approvalRow]
      });

      pendingCrewRequests.add(user.id);

      return interaction.reply({
        content: `📬 Your request to join the **${crewRole.name}** has been submitted! Our admins will review your application shortly.`,
        flags: MessageFlags.Ephemeral
      });
    }

    // ==========================================
    // 3. Admin Clicks "Approve Crew"
    // ==========================================
    if (customId.startsWith('approve_crew_')) {
      const targetUserId = customId.replace('approve_crew_', '');

      // Check admin / reviewer permissions
      if (
        !member.permissions.has(PermissionFlagsBits.ManageRoles) &&
        !member.permissions.has(PermissionFlagsBits.Administrator)
      ) {
        return interaction.reply({
          content: '❌ You must have "Manage Roles" or Administrator permissions to review applications.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferUpdate();

      const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
      const crewRole = resolveRole(guild, config.roles.crew);
      const visitorRole = resolveRole(guild, config.roles.visitor);

      if (!crewRole) {
        return interaction.followUp({
          content: `⚠️ Role **${config.roles.crew.name}** not found on this server.`,
          flags: MessageFlags.Ephemeral
        });
      }

      let roleAssigned = false;
      if (targetMember) {
        roleAssigned = await safelyAddRole(targetMember, crewRole);
        if (visitorRole) {
          await safelyRemoveRole(targetMember, visitorRole);
        }

        // Send DM notification to user
        try {
          await targetMember.send({
            content: `🎉 Congratulations! Your application for the **${crewRole.name}** role in **${config.serverName}** has been **APPROVED** by ${interaction.user.tag}!`
          });
        } catch {
          logger.debug(`Could not DM user ${targetMember.user.tag} about approval (DMs closed).`);
        }
      }

      pendingCrewRequests.delete(targetUserId);

      // Disable buttons and update embed
      const currentEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
      currentEmbed
        .setColor(config.colors.joinLog)
        .spliceFields(4, 1, {
          name: '📌 Decision',
          value: `✅ **APPROVED** by ${interaction.user} (<t:${Math.floor(Date.now() / 1000)}:R>)\n${
            roleAssigned ? `Role \`@${crewRole.name}\` assigned.` : '⚠️ Target user could not be given the role (check hierarchy).'
          }`,
          inline: false
        });

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('approved_disabled')
          .setLabel(`Approved by ${interaction.user.username}`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(true)
          .setEmoji('✅')
      );

      await interaction.editReply({
        embeds: [currentEmbed],
        components: [disabledRow]
      });

      logger.success(`[${guild.name}] Admin ${interaction.user.tag} approved Crew role for user ID: ${targetUserId}`);
      return;
    }

    // ==========================================
    // 4. Admin Clicks "Reject"
    // ==========================================
    if (customId.startsWith('reject_crew_')) {
      const targetUserId = customId.replace('reject_crew_', '');

      // Check admin permissions
      if (
        !member.permissions.has(PermissionFlagsBits.ManageRoles) &&
        !member.permissions.has(PermissionFlagsBits.Administrator)
      ) {
        return interaction.reply({
          content: '❌ You must have "Manage Roles" or Administrator permissions to review applications.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferUpdate();

      const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
      const crewRoleName = config.roles.crew.name;

      if (targetMember) {
        try {
          await targetMember.send({
            content: `Hello, your application for the **${crewRoleName}** role in **${config.serverName}** was **not approved** at this time.`
          });
        } catch {
          logger.debug(`Could not DM user ${targetMember.user.tag} about rejection (DMs closed).`);
        }
      }

      pendingCrewRequests.delete(targetUserId);

      // Disable buttons and update embed
      const currentEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
      currentEmbed
        .setColor(config.colors.exitLog)
        .spliceFields(4, 1, {
          name: '📌 Decision',
          value: `❌ **REJECTED** by ${interaction.user} (<t:${Math.floor(Date.now() / 1000)}:R>)`,
          inline: false
        });

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('rejected_disabled')
          .setLabel(`Rejected by ${interaction.user.username}`)
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true)
          .setEmoji('❌')
      );

      await interaction.editReply({
        embeds: [currentEmbed],
        components: [disabledRow]
      });

      logger.info(`[${guild.name}] Admin ${interaction.user.tag} rejected Crew role for user ID: ${targetUserId}`);
    }
  }
};
