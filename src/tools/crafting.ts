import pkg from 'mineflayer-pathfinder'
const { Movements, goals } = pkg
import { Vec3 } from 'vec3'
import { z } from 'zod'
import { botState, server } from '../server.js'
import {
  createErrorResponse,
  createNotConnectedResponse,
  createSuccessResponse,
} from '../utils/error-handler.js'

// Function to register crafting tools
export function registerCraftingTools() {
  // Tool to get available recipes
  server.tool(
    'getRecipes',
    'Get a list of available crafting recipes for a specific item',
    {
      itemName: z.string().describe('Name of the item to check recipes for (e.g. "stick", "iron_pickaxe")'),
    },
    async ({ itemName }) => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        const bot = botState.bot
        const item = bot.registry.itemsByName[itemName.toLowerCase()]
        
        if (!item) {
             return createErrorResponse(`Item "${itemName}" is not known to the server. Check spelling?`)
        }

        const recipes = bot.recipesFor(item.id, null, 1, null)

        if (recipes.length === 0) {
          return createSuccessResponse(
            `No recipes found for "${itemName}". You might lack ingredients or it cannot be crafted.`
          )
        }

        let response = `Found ${recipes.length} recipe(s) for ${itemName}:\n`
        
        recipes.forEach((recipe, idx) => {
             response += `\nRecipe #${idx + 1} (${recipe.requiresTable ? 'Requires Crafting Table' : 'Inventory Crafting'}):\n`
             if (recipe.inShape) {
                 response += "  Shape: (Shaped recipe details omitted for brevity)\n"
             }
             if (recipe.ingredients) {
                 response += "  Ingredients:\n"
                 response += "  - (Complex recipe structure)\n"
             }
        })

        return createSuccessResponse(response)
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )

  // Tool to craft an item
  server.tool(
    'craftItem',
    'Craft an item using available materials. Automatically finds OR PLACES a crafting table if needed.',
    {
      itemName: z.string().describe('Name of the item to craft'),
      count: z
        .number()
        .optional()
        .default(1)
        .describe('Number of items to craft'),
      announcement: z.string().optional().describe('Natural language message to say in chat before crafting (e.g. "Making an iron sword for you!")'),
    },
    async ({ itemName, count, announcement }) => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        const bot = botState.bot

        if (announcement) {
            bot.chat(announcement)
        }

        const item = bot.registry.itemsByName[itemName.toLowerCase()]
        
        if (!item) {
             return createErrorResponse(`Item "${itemName}" is not known.`)
        }

        // Find recipes for this item
        const recipes = bot.recipesFor(item.id, null, 1, null) 

        if (recipes.length === 0) {
          return createSuccessResponse(
            `No craftable recipes found for "${itemName}". You likely missing ingredients.`
          )
        }

        const recipe = recipes[0]
        
        let craftingTable = null
        if (recipe.requiresTable) {
            // 1. Search for existing table
            const tableBlock = bot.findBlock({
                matching: bot.registry.blocksByName['crafting_table'].id,
                maxDistance: 32
            })
            
            if (tableBlock) {
                // Move to existing table
                const movements = new Movements(bot)
                bot.pathfinder.setMovements(movements)
                const goal = new goals.GoalBlock(tableBlock.position.x, tableBlock.position.y, tableBlock.position.z)
                await bot.pathfinder.goto(goal)
                craftingTable = tableBlock
            } else {
                // 2. No table found, check inventory for one
                const tableItem = bot.inventory.items().find(i => i.name === 'crafting_table')
                
                if (tableItem) {
                    // Place the table
                    // Find a solid block to place it on/against
                    const placeRef = bot.findBlock({
                        matching: (blk) => blk.boundingBox === 'block' && blk.name !== 'crafting_table',
                        maxDistance: 4
                    })

                    if (!placeRef) {
                         return createErrorResponse("Need a crafting table but cannot find a place to put it (no solid blocks nearby).")
                    }

                    // Equip table
                    await bot.equip(tableItem, 'hand')
                    
                    // Try to place it
                    // Calculate placement vector (face)
                    const face = new Vec3(0, 1, 0) // Try placing on top first
                    
                    try {
                        await bot.placeBlock(placeRef, face)
                        // Wait a moment for block update
                        await new Promise(r => setTimeout(r, 500))
                        
                        // Find the placed table
                        craftingTable = bot.findBlock({
                            matching: bot.registry.blocksByName['crafting_table'].id,
                            maxDistance: 5
                        })
                        
                        if (!craftingTable) throw new Error("Placed table but couldn't find it.")
                            
                    } catch (err) {
                        return createErrorResponse(`Failed to place crafting table: ${err}`)
                    }

                } else {
                    return createErrorResponse(`Recipe for ${itemName} requires a Crafting Table. None nearby, and you don't have one in inventory.`)
                }
            }
        }

        // Craft the item
        await bot.craft(recipe, count, craftingTable || undefined)

        return createSuccessResponse(
          `Successfully crafted ${count} x ${itemName}`
        )
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )
}
