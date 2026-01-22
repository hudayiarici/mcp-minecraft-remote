import pkg from 'mineflayer-pathfinder'
const { Movements, goals } = pkg
import { z } from 'zod'
import { botState, server } from '../server.js'
import { ToolResponse } from '../types.js'
import {
  createErrorResponse,
  createNotConnectedResponse,
  createSuccessResponse,
} from '../utils/error-handler.js'

export function registerCollectionTools() {
  server.tool(
    'collectNearbyItems',
    'Scan for and collect nearby dropped items (floating on the ground)',
    {
      maxDistance: z
        .number()
        .optional()
        .default(10)
        .describe('Maximum distance to search for items (default: 10)'),
    },
    async ({ maxDistance }) => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        const bot = botState.bot
        
        console.error(`Scanning for drops within ${maxDistance} blocks... Total entities: ${Object.keys(bot.entities).length}`)

        // Find all dropped item entities
        const drops = Object.values(bot.entities).filter(
          (entity) =>
            (entity.type === 'object' || entity.name === 'item' || entity.displayName === 'Item') && // broader check
            entity.position.distanceTo(bot.entity.position) <= maxDistance &&
            entity.isValid // Ensure entity is valid/alive
        )

        console.error(`Found ${drops.length} drops.`)

        if (drops.length === 0) {
          return createSuccessResponse(
            `No dropped items found within ${maxDistance} blocks. Try using 'getNearbyEntities' to see what is around.`
          )
        }

        // Sort by distance
        drops.sort(
          (a, b) =>
            a.position.distanceTo(bot.entity.position) -
            b.position.distanceTo(bot.entity.position)
        )

        const movements = new Movements(bot)
        bot.pathfinder.setMovements(movements)

        // Function to collect items sequentially
        const collectedItems: string[] = []
        
        // We will try to collect up to 5 closest items to avoid long execution
        const targetDrops = drops.slice(0, 5)

        for (const drop of targetDrops) {
             const goal = new goals.GoalBlock(
                Math.floor(drop.position.x),
                Math.floor(drop.position.y),
                Math.floor(drop.position.z)
             )
             
             try {
                 await bot.pathfinder.goto(goal)
                 // Wait a bit to ensure pickup
                 await new Promise(r => setTimeout(r, 500))
                 // Use metadata if available to identify item, otherwise generic name
                 // Mineflayer entity metadata for items is complex, we'll just say "an item"
                 // or try to parse if possible. For now, generic.
                 collectedItems.push(`item at (${drop.position.x.toFixed(0)}, ${drop.position.y.toFixed(0)}, ${drop.position.z.toFixed(0)})`)
             } catch (e) {
                 console.error("Failed to reach item:", e)
             }
        }

        return createSuccessResponse(
          `Attempted to collect items. Visited locations: ${collectedItems.join(', ')}. Check inventory to see what was picked up.`
        )
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )
}
