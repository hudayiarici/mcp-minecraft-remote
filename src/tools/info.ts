import { botState, server } from '../server.js'
import {
  createErrorResponse,
  createNotConnectedResponse,
  createSuccessResponse,
} from '../utils/error-handler.js'

// Function to register information retrieval tools
export function registerInfoTools() {
  // Tool to get nearby players
  server.tool(
    'getNearbyPlayers',
    'Get a list of players nearby',
    {},
    async () => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        const players = Object.values(botState.bot.players)
          .filter(
            (player) =>
              player.entity && player.username !== botState.bot?.username
          )
          .map((player) => {
            if (!botState.bot) return ''
            const pos = player.entity!.position
            const distance = pos.distanceTo(botState.bot.entity.position)
            return `${player.username} (Pos: X=${pos.x.toFixed(1)}, Y=${pos.y.toFixed(1)}, Z=${pos.z.toFixed(1)}, Distance: ${distance.toFixed(2)} blocks away)`
          })

        if (players.length === 0) {
          return createSuccessResponse('No other players nearby.')
        }

        return createSuccessResponse(`Nearby players: ${players.join(', ')}`)
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )

  // Tool to get server information
  server.tool(
    'getServerInfo',
    'Get information about the currently connected server',
    {},
    async () => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        let info = `Server Info:
Host: ${botState.connectionInfo.host}
Port: ${botState.connectionInfo.port}
Version: ${botState.bot.version}
Game Mode: ${botState.bot.game.gameMode}
Difficulty: ${botState.bot.game.difficulty}
Time: ${botState.bot.time.timeOfDay}
Players Online: ${Object.keys(botState.bot.players).length}
Your Health: ${botState.bot.health ? botState.bot.health.toFixed(1) : 'N/A'}
Your Food: ${botState.bot.food ? botState.bot.food.toFixed(1) : 'N/A'}`

        if (botState.lastDeath) {
            const ld = botState.lastDeath
            const timeDiff = Math.floor((new Date().getTime() - ld.time.getTime()) / 1000)
            info += `\n\n⚠️ LAST DEATH INFO:\n` +
                    `- Time: ${timeDiff} seconds ago\n` +
                    `- Location: X=${ld.position.x.toFixed(0)}, Y=${ld.position.y.toFixed(0)}, Z=${ld.position.z.toFixed(0)}\n` +
                    `- Hint: Your items are likely at that location.`
        }

        return createSuccessResponse(info)
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )
}
