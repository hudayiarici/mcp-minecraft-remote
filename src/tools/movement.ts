import pkg from 'mineflayer-pathfinder';
const { Movements, goals } = pkg;
import { z } from 'zod'
import { botState, server } from '../server.js'
import { ToolResponse } from '../types.js'
import {
  createErrorResponse,
  createNotConnectedResponse,
  createSuccessResponse,
} from '../utils/error-handler.js'

// Function to register movement-related tools
export function registerMovementTools() {
  // Tool to get current position information
  server.tool(
    'getPosition',
    'Get the current position of the player in the Minecraft world',
    {},
    async () => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        const position = botState.bot.entity.position
        return createSuccessResponse(
          `Current position: X=${position.x.toFixed(2)}, Y=${position.y.toFixed(
            2
          )}, Z=${position.z.toFixed(2)}`
        )
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )

  // Tool to move to a specified location
  server.tool(
    'moveTo',
    'Move the player to a specific location',
    {
      x: z.number().describe('X coordinate'),
      y: z.number().describe('Y coordinate'),
      z: z.number().describe('Z coordinate'),
      announcement: z.string().optional().describe('Natural language message to say in chat before moving (e.g. "On my way to the coordinates!")'),
    },
    async ({ x, y, z, announcement }) => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        const bot = botState.bot
        
        if (announcement) {
            bot.chat(announcement)
        }

        // Set pathfinder Movements with improved capabilities
        const movements = new Movements(bot)
        
        // Allow breaking blocks if we have tools, and placing blocks if we have dirt/cobble
        // This makes the bot much smarter at navigating terrain
        movements.canDig = true
        movements.allow1by1towers = true // Allow building up
        movements.allowParkour = true // Allow jumping gaps
        
        bot.pathfinder.setMovements(movements)

        // Set target position
        const goal = new goals.GoalBlock(x, y, z)

        return new Promise<ToolResponse>((resolve) => {
          let deathListener: () => void;
          let stuckCheckInterval: NodeJS.Timeout;
          let lastPosition = bot.entity.position.clone();
          let stuckCounter = 0;

          const cleanup = () => {
             if (deathListener) bot.removeListener('death', deathListener)
             if (stuckCheckInterval) clearInterval(stuckCheckInterval)
          }

          // Stuck detection logic
          stuckCheckInterval = setInterval(() => {
              const currentPos = bot.entity.position
              const dist = currentPos.distanceTo(lastPosition)
              
              // If moved less than 0.5 blocks in 2 seconds while moving
              if (dist < 0.5) {
                  stuckCounter++
                  if (stuckCounter > 3) { // Stuck for 6+ seconds
                      cleanup()
                      bot.pathfinder.stop()
                      resolve(createSuccessResponse(
                          `⚠️ WARNING: Bot appears to be STUCK! \n` +
                          `- The bot tried to move but couldn't make progress.\n` +
                          `- Possible causes: Obstacles, holes, or getting caught on blocks.\n` +
                          `- Recommendation: Try 'moveControl' to jump or move sideways, or 'digBlock' to clear the way.`
                      ))
                  }
              } else {
                  stuckCounter = 0 // Reset if moved
                  lastPosition = currentPos.clone()
              }
          }, 2000)

          deathListener = () => {
             cleanup()
             bot.pathfinder.stop() // Stop moving
             const pos = bot.entity.position
             resolve(createSuccessResponse(
                 `⚠️ CRITICAL: Bot DIED while moving! \n` +
                 `- Action: Movement Cancelled\n` +
                 `- Destination: NOT Reached\n` +
                 `- Current Location: Respawned at X=${pos.x.toFixed(0)}, Y=${pos.y.toFixed(0)}, Z=${pos.z.toFixed(0)}\n` +
                 `Please recover your items or start over.`
             ))
          }

          bot.on('death', deathListener)

          // Start movement
          bot.pathfinder.goto(goal)
            .then(() => {
              cleanup()
              if (botState.bot === bot) {
                resolve(
                  createSuccessResponse(
                    `Successfully moved to X=${x}, Y=${y}, Z=${z}`
                  )
                )
              } else {
                resolve(createErrorResponse('Bot disconnected during movement'))
              }
            })
            .catch((err) => {
              cleanup()
              resolve(createErrorResponse(err)) // Pathfinder errors (no path, timeout)
            })

          // Timeout handling (if still moving after 2 minutes)
          setTimeout(() => {
            cleanup()
            bot.pathfinder.stop()
            resolve(
              createSuccessResponse(
                'Movement timed out (2 minutes). The destination might be too far or complex to reach.'
              )
            )
          }, 120000)
        })
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )

  // Tool to move to a specific player
  server.tool(
    'moveToPlayer',
    'Move the player to a specific player\'s position',
    {
      username: z.string().describe('Username of the player to move to'),
      announcement: z.string().optional().describe('Natural language message to say in chat before moving (e.g. "Coming to you, Steve!")'),
    },
    async ({ username, announcement }) => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        const bot = botState.bot

        if (announcement) {
            bot.chat(announcement)
        }

        const targetPlayer = bot.players[username]
        if (!targetPlayer || !targetPlayer.entity) {
          return createErrorResponse(
            `Could not find player "${username}" or they are too far away to be seen.`
          )
        }

        const pos = targetPlayer.entity.position
        const movements = new Movements(bot)
        bot.pathfinder.setMovements(movements)
        const goal = new goals.GoalBlock(
          Math.floor(pos.x),
          Math.floor(pos.y),
          Math.floor(pos.z)
        )

        return new Promise<ToolResponse>((resolve) => {
          bot.pathfinder.goto(goal)
            .then(() => {
              if (botState.bot === bot) {
                resolve(
                  createSuccessResponse(`Successfully moved to player ${username}`)
                )
              } else {
                resolve(createErrorResponse('Bot disconnected during movement'))
              }
            })
            .catch((err) => {
              resolve(createErrorResponse(err))
            })

          setTimeout(() => {
            resolve(
              createSuccessResponse(
                `Still moving towards ${username}... This might take a while.`
              )
            )
          }, 60000)
        })
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )
}
