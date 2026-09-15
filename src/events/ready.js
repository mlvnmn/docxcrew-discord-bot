const { Events, PermissionFlagsBits, ApplicationCommandOptionType } = require('discord.js');
const logger = require('../utils/logger');
const config = require('../config');
const { resolveChannel } = require('../utils/channelHelper');
const { resolveRole } = require('../utils/roleHelper');
const { deployRolesPanel } = require('../utils/rolesPanel');
const { initInviteTracker } = require('../utils/inviteTracker');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.success(`Logged in as ${client.user.tag} (ID: ${client.user.id})`);
    logger.info(`Serving ${client.guilds.cache.size} server(s)`);

    // Clean appearance: no custom status text
    try {
      client.user.setPresence({
        activities: [],
        status: 'online'
      });
    } catch (err) {
      logger.warn(`Failed to set presence: ${err.message}`);
    }

    // Initialize invite tracking cache for all guilds
    await initInviteTracker(client);

    // Command definitions
    const commandsData = [
      {
        name: 'setup-roles',
        description: 'Deploy or refresh the interactive role selection panel in #roles',
        defaultMemberPermissions: PermissionFlagsBits.ManageRoles
      },
      {
        name: 'clear-chat',
        description: 'Delete messages in the current channel',
        defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
        options: [
          {
            name: 'amount',
            description: 'Number of messages to delete (1-100, default: 100)',
            type: ApplicationCommandOptionType.Integer,
            required: false,
            min_value: 1,
            max_value: 100
          }
        ]
      },
      {
        name: 'dm',
        description: 'Send a direct message (DM) to a user using the bot',
        defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
        options: [
          {
            name: 'user',
            description: 'The user to send a DM to',
            type: ApplicationCommandOptionType.User,
            required: true
          },
          {
            name: 'message',
            description: 'The message content to send',
            type: ApplicationCommandOptionType.String,
            required: true
          }
        ]
      }
    ];

    // Register slash commands (Globally & Per-Guild for instant loading)
    try {
      if (client.application) {
        await client.application.commands.set(commandsData);
        logger.info('Registered global slash commands: /setup-roles, /clear-chat, /dm');
      }
      for (const guild of client.guilds.cache.values()) {
        await guild.commands.set(commandsData).catch((err) => {
          logger.warn(`[${guild.name}] Instant guild command registration notice: ${err.message}`);
        });
      }
    } catch (err) {
      logger.warn(`Failed to register slash commands: ${err.message}`);
    }

    // Auto-check and setup for each server
    for (const guild of client.guilds.cache.values()) {
      // 1. Verify roles exist
      const visitorRole = resolveRole(guild, config.roles.visitor);
      const crewRole = resolveRole(guild, config.roles.crew);

      if (!visitorRole) {
        logger.warn(`[${guild.name}] Role "${config.roles.visitor.name}" not found. Please create it in your server.`);
      }
      if (!crewRole) {
        logger.warn(`[${guild.name}] Role "${config.roles.crew.name}" not found. Please create it in your server.`);
      }

      // 2. Deploy roles panel if #roles channel exists
      const rolesChannel = resolveChannel(guild, config.channels.roles, 'Roles Channel');
      if (rolesChannel) {
        await deployRolesPanel(rolesChannel);
      } else {
        logger.info(`[${guild.name}] Channel #${config.channels.roles.names[0]} not found yet. Create it and the bot will post the role selection panel!`);
      }

      // 3. Check for admin approval channel
      const crewRequestsChannel = resolveChannel(guild, config.channels.crewRequests, 'Crew Requests');
      if (!crewRequestsChannel) {
        logger.warn(`[${guild.name}] Admin channel #${config.channels.crewRequests.names[0]} not found. Create it for Crew approval tickets!`);
      }

      // 4. Check for welcome channel
      const welcomeChannel = resolveChannel(guild, config.channels.welcome, 'Welcome Channel');
      if (welcomeChannel) {
        logger.info(`[${guild.name}] Welcome channel found: #${welcomeChannel.name}`);
      } else {
        logger.warn(`[${guild.name}] Channel #${config.channels.welcome.names[0]} not found. Create a "#welcome" channel to receive welcome messages.`);
      }

      // 5. Check for invite tracker channel
      const inviteTrackerChannel = resolveChannel(guild, config.channels.inviteTracker, 'Invite Tracker Channel');
      if (inviteTrackerChannel) {
        logger.info(`[${guild.name}] Invite tracker channel found: #${inviteTrackerChannel.name}`);
      } else {
        logger.warn(`[${guild.name}] Channel #${config.channels.inviteTracker.names[0]} not found.`);
      }
    }

    logger.success(`Bot is fully ready and monitoring member & invite events.`);
  }
};
