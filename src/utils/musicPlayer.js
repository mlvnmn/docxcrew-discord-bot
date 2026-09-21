const ffmpegStatic = require('ffmpeg-static');
if (ffmpegStatic) {
  process.env.FFMPEG_PATH = ffmpegStatic;
}

const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('./logger');

let playerInstance = null;

/**
 * Builds interactive music UI control buttons (Pause/Resume, Skip, Stop, Vol-, Vol+, Queue).
 * @param {boolean} isPaused
 * @returns {ActionRowBuilder[]}
 */
function buildMusicControlRows(isPaused = false) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_music_pause_resume')
      .setEmoji(isPaused ? '▶️' : '⏸️')
      .setLabel(isPaused ? 'Resume' : 'Pause')
      .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_music_skip')
      .setEmoji('⏭️')
      .setLabel('Next')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_music_stop')
      .setEmoji('⏹️')
      .setLabel('Stop')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('btn_music_voldown')
      .setEmoji('🔉')
      .setLabel('-10%')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_music_volup')
      .setEmoji('🔊')
      .setLabel('+10%')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_music_queue')
      .setEmoji('📜')
      .setLabel('View Full Queue')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

/**
 * Initialize the discord-player instance attached to the Discord Client.
 * @param {import('discord.js').Client} client
 * @returns {Promise<Player>}
 */
async function initMusicPlayer(client) {
  if (playerInstance) return playerInstance;

  const player = new Player(client, {
    ytdlOptions: {
      highWaterMark: 1 << 25, // 32MB buffer to prevent audio stuttering & frame drops
      quality: 'highestaudio',
      filter: 'audioonly',
      liveBuffer: 60000,
      dlChunkSize: 0
    }
  });

  try {
    // Load default extractors (YouTube, Spotify, SoundCloud, Apple Music, attachment URLs, etc.)
    await player.extractors.loadMulti(DefaultExtractors);
    logger.info('Loaded default extractors for music player (YouTube, Spotify, SoundCloud, etc.)');
  } catch (err) {
    logger.warn(`Notice loading extractors: ${err.message}`);
  }

  // Event: Player starts playing a track
  player.events.on('playerStart', (queue, track) => {
    if (!queue.metadata || !queue.metadata.channel) return;
    const embed = new EmbedBuilder()
      .setColor('#00ff7f')
      .setTitle('🎵 Now Playing')
      .setDescription(`[**${track.title}**](${track.url})\n\nRequested by: ${track.requestedBy}`)
      .setThumbnail(track.thumbnail || null)
      .addFields(
        { name: 'Duration', value: track.duration || 'Live / Unknown', inline: true },
        { name: 'Artist / Author', value: track.author || 'Unknown', inline: true },
        { name: 'Volume', value: `${queue.node.volume}%`, inline: true }
      )
      .setFooter({ text: `Queue size: ${queue.tracks?.data?.length || 0} track(s)` })
      .setTimestamp();

    queue.metadata.channel.send({
      embeds: [embed],
      components: buildMusicControlRows(queue.node.isPaused())
    }).catch(() => {});
  });

  // Event: Single track added to queue
  player.events.on('audioTrackAdd', (queue, track) => {
    if (!queue.metadata || !queue.metadata.channel) return;
    if (queue.isPlaying() && queue.tracks?.data?.length > 0) {
      const embed = new EmbedBuilder()
        .setColor('#1e90ff')
        .setTitle('🎶 Added to Queue')
        .setDescription(`[**${track.title}**](${track.url})`)
        .setThumbnail(track.thumbnail || null)
        .addFields(
          { name: 'Duration', value: track.duration || 'Unknown', inline: true },
          { name: 'Requested By', value: `${track.requestedBy}`, inline: true }
        );

      queue.metadata.channel.send({ embeds: [embed] }).catch(() => {});
    }
  });

  // Event: Playlist added to queue
  player.events.on('audioTracksAdd', (queue, tracks) => {
    if (!queue.metadata || !queue.metadata.channel) return;
    const embed = new EmbedBuilder()
      .setColor('#1e90ff')
      .setTitle('📚 Playlist Added to Queue')
      .setDescription(`Added **${tracks.length}** tracks to the queue.`)
      .setTimestamp();

    queue.metadata.channel.send({ embeds: [embed] }).catch(() => {});
  });

  // Event: Empty channel disconnect
  player.events.on('emptyChannel', (queue) => {
    if (!queue.metadata || !queue.metadata.channel) return;
    queue.metadata.channel.send('⚠️ Voice channel is empty. Disconnecting...').catch(() => {});
  });

  // Event: Queue completed
  player.events.on('emptyQueue', (queue) => {
    if (!queue.metadata || !queue.metadata.channel) return;
    queue.metadata.channel.send('✅ Finished playing all queued songs! Disconnecting from voice channel...').catch(() => {});
  });

  // Event: General player error
  player.events.on('error', (queue, error) => {
    logger.error(`[MusicPlayer Error] ${error.message}`);
  });

  // Event: Stream error
  player.events.on('playerError', (queue, error) => {
    logger.error(`[MusicPlayer Connection Error] ${error.message}`);
  });

  playerInstance = player;
  logger.success('Music Player service initialized successfully.');
  return player;
}

/**
 * Returns the global Player instance.
 * @returns {Player|null}
 */
function getMusicPlayer() {
  return playerInstance;
}

module.exports = {
  initMusicPlayer,
  getMusicPlayer,
  buildMusicControlRows
};
