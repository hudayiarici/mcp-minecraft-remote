import { pathfinder } from 'mineflayer-pathfinder'
import { z } from 'zod'
import {
  botState,
  createBot,
  server,
  updateConnectionInfo,
  updateConnectionState,
} from '../server.js'
import { ToolResponse } from '../types.js'
import {
  createAlreadyConnectedResponse,
  createErrorResponse,
  createNotConnectedResponse,
  createSuccessResponse,
} from '../utils/error-handler.js'

// Login/connection tool
export function registerConnectTools() {
  server.tool(
    'connectToServer',
    'Connect to a Minecraft server with the specified credentials',
    {
      host: z.string().describe('Minecraft server host address'),
      port: z
        .number()
        .optional()
        .default(25565)
        .describe('Minecraft server port'),
      username: z.string().describe('Minecraft username'),
      password: z
        .string()
        .optional()
        .describe('Minecraft password (if using premium account)'),
      version: z.string().optional().describe('Minecraft version'),
    },
    async ({ host, port, username, password, version }) => {
      if (botState.isConnected && botState.bot) {
        return createAlreadyConnectedResponse()
      }

      try {
        updateConnectionInfo({
          host,
          port,
          username,
          version: version || 'auto',
        })

        // Bot connection options
        const options = {
          host,
          port,
          username,
          password,
          version,
          checkTimeoutInterval: 60000, // Increase timeout check to 60 seconds to prevent false positives
        }

        console.error(`Attempting to connect to ${host}:${port} as ${username} (version: ${version || 'auto'})`)

        // Create the bot
        const bot = createBot(options)

        // Add pathfinder plugin to the bot
        bot.loadPlugin(pathfinder)
        console.error('Pathfinder plugin loaded')

        // Add permanent event listeners for disconnection and errors
        bot.on('kicked', (reason) => {
          console.error(`Bot was kicked: ${reason}`)
          updateConnectionState(false, null)
        })

        bot.on('end', (reason) => {
          console.error(`Bot disconnected: ${reason}`)
          updateConnectionState(false, null)
        })

        bot.on('error', (err) => {
          console.error(`Bot error event: ${err}`)
          if (!botState.isConnected) {
            // If error happens during connection, it will be handled by the once('error') below
            return
          }
        })

        bot.on('login', () => {
            console.error('Bot logged in successfully')
        })

        bot.on('spawn', () => {
            console.error('Bot spawned in the world')
        })

        bot.on('death', () => {
            console.error('Bot died! Respawning...')
            if (bot.entity) {
                botState.lastDeath = {
                    position: bot.entity.position.clone(),
                    time: new Date()
                }
            }
        })

        // Chat listener
        bot.on('chat', (username, message) => {
            if (username === bot.username) return
            
            const logEntry = {
                sender: username,
                message: message,
                timestamp: new Date()
            }
            
            botState.chatHistory.push(logEntry)
            
            // Keep only last 50 messages
            if (botState.chatHistory.length > 50) {
                botState.chatHistory.shift()
            }
            
            console.error(`[CHAT] <${username}> ${message}`)
        })

        return new Promise<ToolResponse>((resolve) => {
          // When login is successful
          bot.once('spawn', () => {
            updateConnectionState(true, bot)
            resolve(
              createSuccessResponse(
                `Successfully connected to ${host}:${port} as ${username}`
              )
            )
          })

          // When an error occurs during initial connection
          bot.once('error', (err) => {
            console.error(`Initial connection error: ${err}`)
            updateConnectionState(false, null)
            resolve(createErrorResponse(err))
          })

          // Timeout handling (if connection is not established after 20 seconds)
          setTimeout(() => {
            if (!botState.isConnected) {
              updateConnectionState(false, null)
              // We should probably quit the bot if it timed out to prevent it from ghosting
              try {
                  bot.quit()
              } catch (e) {
                  // Ignore error if bot is already gone
              }
              resolve(
                createSuccessResponse('Connection timed out after 20 seconds')
              )
            }
          }, 20000)
        })
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )

  // Disconnection tool
  server.tool(
    'disconnectFromServer',
    'Disconnect from the Minecraft server',
    {},
    async () => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        botState.bot.quit()
        updateConnectionState(false, null)
        return createSuccessResponse(
          'Successfully disconnected from the server.'
        )
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )
}
