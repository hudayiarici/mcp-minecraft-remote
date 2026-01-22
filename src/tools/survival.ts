import { z } from 'zod'
import { botState, server } from '../server.js'
import {
  createErrorResponse,
  createNotConnectedResponse,
  createSuccessResponse,
} from '../utils/error-handler.js'

export function registerSurvivalTools() {
  // Tool to eat food
  server.tool(
    'eat',
    'Eat food from inventory to restore hunger',
    {
      foodName: z
        .string()
        .optional()
        .describe('Specific food name to eat (optional, otherwise picks best food)'),
    },
    async ({ foodName }) => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        const bot = botState.bot
        
        if (bot.food === 20) {
            return createSuccessResponse("Hunger is full (20/20), no need to eat.")
        }

        let foodItem
        if (foodName) {
            foodItem = bot.inventory.items().find(item => item.name.includes(foodName.toLowerCase()))
        } else {
            // Find best food (items that are edible)
            // Mineflayer generic items don't strictly have "foodPoints" property easily accessible without registry lookup
            // So we look for common food names or use registry
            const foods = bot.registry.foodsArray
            const edibleIds = new Set(foods.map(f => f.id))
            
            const inventoryFood = bot.inventory.items().filter(item => edibleIds.has(item.type))
            if (inventoryFood.length > 0) {
                foodItem = inventoryFood[0] // Just pick the first one found
            }
        }

        if (!foodItem) {
            return createErrorResponse("No food found in inventory!")
        }

        await bot.equip(foodItem, 'hand')
        await bot.consume()

        return createSuccessResponse(`Ate ${foodItem.displayName}. New food level: ${bot.food}`)

      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )
}
