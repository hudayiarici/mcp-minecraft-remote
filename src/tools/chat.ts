import { z } from 'zod'
import { botState, server } from '../server.js'
import { ToolResponse } from '../types.js'
import {
  createErrorResponse,
  createNotConnectedResponse,
  createSuccessResponse,
} from '../utils/error-handler.js'

// Function to register chat-related tools
export function registerChatTools() {
  // Tool for sending chat messages
  server.tool(
    'sendChat',
    'Send a chat message to the Minecraft server',
    {
      message: z.string().describe('Message to send to the server'),
    },
    async ({ message }) => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        botState.bot.chat(message)
        return createSuccessResponse(`Message sent: ${message}`)
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )

  // Tool for reading chat history
  server.tool(
    'readChat',
    'Read recent chat messages from the server',
    {
      count: z.number().optional().default(10).describe('Number of recent messages to read (max 50)'),
    },
    async ({ count }) => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        const history = botState.chatHistory
        if (history.length === 0) {
            return createSuccessResponse("Chat history is empty.")
        }

        const limit = Math.min(count, history.length)
        const recentMessages = history.slice(-limit)

        const formatted = recentMessages.map(msg => {
            const time = msg.timestamp.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
            return `[${time}] <${msg.sender}> ${msg.message}`
        }).join('\n')

        return createSuccessResponse(`Last ${limit} chat messages:\n${formatted}`)
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )

  // Tool to wait for a chat message (Listen Mode)
  server.tool(
    'waitForChat',
    'Wait for a new chat message to arrive. Use this to "listen" for commands from in-game players.',
    {
      trigger: z.string().optional().describe('Specific word/phrase to wait for (e.g. "Claude"). If empty, waits for any message.'),
      timeout: z.number().optional().default(60).describe('Maximum time to wait in seconds (default: 60)'),
    },
    async ({ trigger, timeout }) => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      const bot = botState.bot

      return new Promise<ToolResponse>((resolve) => {
        let chatListener: (username: string, message: string) => void
        let timeoutTimer: NodeJS.Timeout

        // Cleanup function
        const cleanup = () => {
          if (chatListener) bot.removeListener('chat', chatListener)
          if (timeoutTimer) clearTimeout(timeoutTimer)
        }

        // Timer for timeout
        timeoutTimer = setTimeout(() => {
          cleanup()
          resolve(createSuccessResponse(`Stopped listening after ${timeout} seconds. No matching messages received.`))
        }, timeout * 1000)

        // Chat listener
        chatListener = (username, message) => {
          if (username === bot.username) return // Ignore self

          // Check if message matches trigger
          if (!trigger || message.toLowerCase().includes(trigger.toLowerCase())) {
            cleanup()
            resolve(createSuccessResponse(
              `⚠️ NEW MESSAGE RECEIVED:\n` +
              `- Sender: ${username}\n` +
              `- Message: "${message}"\n` +
              `You should analyze this message and respond or act accordingly.`
            ))
          }
        }

        bot.on('chat', chatListener)
        console.error(`Listening for chat messages... (Timeout: ${timeout}s, Trigger: "${trigger || '*'}")`)
      })
    }
  )
}
