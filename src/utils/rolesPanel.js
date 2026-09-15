const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const logger = require('./logger');
const { resolveRole } = require('./roleHelper');

/**
 * Creates the Role Selection embed and action buttons
 * @param {import('discord.js').Guild} guild 
 * @returns {{ embeds: EmbedBuilder[], components: ActionRowBuilder[] }}
 */
function createRolesPanelData(guild) {
  const guildIcon = guild.iconURL({ dynamic: true, size: 128 });

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`🎭 Choose Your Role | ${config.serverName}`)
    .setDescription(
      `Welcome to **${config.serverName}**! Please choose your server role below:\n\n` +
      `🌐 **${config.roles.visitor.name}**\n` +
      `• Browse the community and hang out in public chat channels.\n` +
      `• Instantly assigned.\n\n` +
      `🚀 **${config.roles.crew.name}** *(Admin Approval Required)*\n` +
      `• Become an official team member with access to crew channels & projects.\n` +
      `• Clicking below sends your application to server administrators for review.`
    )
    .addFields({
      name: 'ℹ️ Instructions',
      value: `Click **Visitor** to confirm standard access, or **Apply for Crew** to submit an approval request to the admins.`
    })
    .setFooter({
      text: `${config.serverName} • Select an option below`,
      iconURL: guildIcon || undefined
    })
    .setTimestamp();

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('select_role_visitor')
      .setLabel(config.roles.visitor.name)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🌐'),
    new ButtonBuilder()
      .setCustomId('apply_role_crew')
      .setLabel(`Apply for ${config.roles.crew.name}`)
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🚀')
  );

  return {
    embeds: [embed],
    components: [buttons]
  };
}

/**
 * Deploys or updates the role panel in the designated channel
 * @param {import('discord.js').TextChannel} channel 
 */
async function deployRolesPanel(channel) {
  try {
    const { guild } = channel;
    const panelData = createRolesPanelData(guild);

    // Ensure #roles channel is hidden for members with the Crew role
    const crewRole = resolveRole(guild, config.roles.crew);
    const botMember = guild.members.me;

    if (crewRole && botMember && channel.permissionsFor(botMember).has(PermissionFlagsBits.ManageChannels)) {
      try {
        await channel.permissionOverwrites.edit(crewRole.id, {
          ViewChannel: false
        });
        logger.info(`[${guild.name}] Configured #${channel.name} permissions: Hidden for "@${crewRole.name}" role.`);
      } catch (permErr) {
        logger.warn(`[${guild.name}] Could not set ViewChannel:false on #${channel.name} for @${crewRole.name}: ${permErr.message}`);
      }
    }

    // Look for an existing bot panel message in the channel to update it, or send a new one
    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const existingBotMsg = messages
      ? messages.find((m) => m.author.id === channel.client.user.id && m.embeds.length > 0 && m.embeds[0].title?.includes('Choose Your Role'))
      : null;

    if (existingBotMsg) {
      await existingBotMsg.edit(panelData);
      logger.info(`[${channel.guild.name}] Refreshed role panel in #${channel.name}`);
      return existingBotMsg;
    } else {
      const sent = await channel.send(panelData);
      logger.success(`[${channel.guild.name}] Deployed new role panel in #${channel.name}`);
      return sent;
    }
  } catch (err) {
    logger.error(`[${channel.guild.name}] Failed to deploy role panel in #${channel.name}: ${err.message}`);
    return null;
  }
}

module.exports = {
  createRolesPanelData,
  deployRolesPanel
};
