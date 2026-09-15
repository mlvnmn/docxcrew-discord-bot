const { Events, PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const config = require('../config');
const { resolveChannel } = require('../utils/channelHelper');
const { resolveRole } = require('../utils/roleHelper');
const { deployRolesPanel } = require('../utils/rolesPanel');

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

    // Register /setup-roles slash command
    try {
      if (client.application) {
        await client.application.commands.set([
          {
            name: 'setup-roles',
            description: 'Deploy or refresh the interactive role selection panel in #roles',
            defaultMemberPermissions: PermissionFlagsBits.ManageRoles
          }
        ]);
        logger.info('Registered slash command: /setup-roles');
      }
    } catch (err) {
      logger.warn(`Failed to register slash command: ${err.message}`);
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
    }

    logger.success(`Bot is fully ready and monitoring member events.`);
  }
};
