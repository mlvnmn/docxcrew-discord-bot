require('dotenv').config();

const config = {
  // Authentication credentials
  token: process.env.TOKEN || process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',

  // Server Branding
  serverName: process.env.SERVER_NAME || 'DOCX CREW',

  // Role Configuration
  roles: {
    visitor: {
      id: process.env.VISITOR_ROLE_ID || null,
      name: process.env.VISITOR_ROLE || 'Visitor'
    },
    crew: {
      id: process.env.CREW_ROLE_ID || null,
      name: process.env.CREW_ROLE || 'Crew'
    },
    core: {
      id: process.env.CORE_ROLE_ID || null,
      name: process.env.CORE_ROLE || 'core'
    }
  },

  // Channel configuration
  channels: {
    welcome: {
      id: process.env.WELCOME_CHANNEL_ID || null,
      names: [process.env.WELCOME_CHANNEL || 'welcome', 'welcome', 'welcomes', 'general-welcome', 'welcome-chat']
    },
    roles: {
      id: process.env.ROLES_CHANNEL_ID || null,
      names: [process.env.ROLES_CHANNEL || 'roles', 'roles', 'choose-roles', 'get-roles']
    },
    crewRequests: {
      id: process.env.CREW_REQUESTS_CHANNEL_ID || null,
      names: [
        process.env.CREW_REQUESTS_CHANNEL || 'crew-requests',
        'crew-requests',
        'admin-approval',
        'crew-approval',
        'role-requests'
      ]
    },
    joinLogs: {
      id: process.env.JOIN_LOG_CHANNEL_ID || null,
      names: [process.env.JOIN_LOG_CHANNEL || 'join-logs', 'join-logs', 'log-duh', 'member-logs']
    },
    exitLogs: {
      id: process.env.EXIT_LOG_CHANNEL_ID || null,
      names: [process.env.EXIT_LOG_CHANNEL || 'exit-logs', 'exit-logs', 'leave-logs', 'member-logs']
    }
  },

  // Embed Color Scheme
  colors: {
    welcome: 0x5865F2,   // Discord Blurple / Vibrant Blue
    primary: 0x5865F2,   // Discord Blurple
    joinLog: 0x2ECC71,   // Emerald Green accent
    exitLog: 0xE74C3C,   // Coral Red accent
    warning: 0xFEE75C,   // Amber Warning
    error: 0xED4245      // Alert Red
  }
};

module.exports = config;
