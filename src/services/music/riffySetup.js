import { createRequire } from 'module';
import { GatewayDispatchEvents } from 'discord.js';
import { logger } from '../../utils/logger.js';
import lavalinkConfig from '../../config/music/lavalink.js';
import { setupPlayerHandler } from './playerHandler.js';

const require = createRequire(import.meta.url);
const { Riffy } = require('riffy');

export function initializeMusic(client) {
    if (!lavalinkConfig.nodes?.length) {
        logger.error('No Lavalink nodes configured. Add lavalink/nodes.json, set LAVALINK_NODES, or set LAVALINK_HOST in your environment.');
        return;
    }

    client.riffy = new Riffy(client, lavalinkConfig.nodes, {
        send: (payload) => {
            const guild = client.guilds.cache.get(payload.d.guild_id);
            if (guild) {
                guild.shard.send(payload);
            }
        },
        defaultSearchPlatform: lavalinkConfig.defaultSearchPlatform,
        restVersion: lavalinkConfig.restVersion,
        bypassChecks: {},
    });

    // RIFFY DEBUG - état des nodes
  setInterval(() => {
    try {
      const nodes = client.riffy?.nodes;

      if (!nodes) {
        logger.warn('[RIFFY DEBUG] Aucun gestionnaire de nodes trouvé');
        return;
      }

      const nodeList =
        typeof nodes.values === 'function'
          ? [...nodes.values()]
          : Object.values(nodes);

      if (nodeList.length === 0) {
        logger.warn('[RIFFY DEBUG] 0 node trouvé dans Riffy');
        return;
      }

      for (const node of nodeList) {
        logger.warn(
          `[RIFFY DEBUG] Node "${node.name || node.options?.name || 'unknown'}" | ` +
          `connected=${node.connected} | ` +
          `available=${node.available} | ` +
          `state=${node.state}`
        );
      }
    } catch (error) {
      logger.error('[RIFFY DEBUG] Erreur lecture nodes:', error);
    }
  }, 5000);

    setupPlayerHandler(client);

    client.on('raw', (packet) => {
        if (
            ![
                GatewayDispatchEvents.VoiceStateUpdate,
                GatewayDispatchEvents.VoiceServerUpdate,
            ].includes(packet.t)
        ) {
            return;
        }
        client.riffy.updateVoiceState(packet);
    });

    client.riffy.on('playerError', (player, error) => {
    logger.error(
        `Music player error in guild ${player.guildId}: ${JSON.stringify(
            error,
            Object.getOwnPropertyNames(error || {})
        )}`
    );
});

        client.riffy.on('nodeConnect', (node) => {
        logger.info(`Lavalink node "${node.name}" connected.`);
    });

    client.riffy.on('nodeError', (node, error) => {
        logger.error(`Lavalink node "${node.name}" error:`, error);
    });

    logger.info(`Music initialized with ${lavalinkConfig.nodes.length} Lavalink node(s).`);
}

export function initRiffyAfterReady(client) {
    logger.info(`Riffy init check: riffy=${!!client.riffy}, user=${client.user?.id || 'none'}`);

    if (client.riffy && client.user?.id) {
        logger.info(`Calling Riffy.init() for user ${client.user.id}...`);

        try {
            client.riffy.init(client.user.id);
            logger.info('Riffy.init() called successfully.');
        } catch (error) {
            logger.error('Riffy.init() threw an error:', error);
        }
    } else {
        logger.error('Riffy.init() NOT called: client.riffy or client.user is missing.');
    }
}
