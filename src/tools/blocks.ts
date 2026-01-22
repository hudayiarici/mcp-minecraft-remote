import { Vec3 } from 'vec3'
import { z } from 'zod'
import { botState, server } from '../server.js'
import { ToolResponse } from '../types.js'
import {
  createErrorResponse,
  createNotConnectedResponse,
  createSuccessResponse,
} from '../utils/error-handler.js'

// Function to register block operation tools
export function registerBlockTools() {
  // Tool for digging blocks
  server.tool(
    'digBlock',
    'Dig a block at the specified coordinates',
    {
      x: z.number().describe('X coordinate'),
      y: z.number().describe('Y coordinate'),
      z: z.number().describe('Z coordinate'),
      announcement: z.string().optional().describe('Natural language message to say in chat before digging (e.g. "Mining this iron ore!")'),
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

        // Get block at specified coordinates
        const targetPos = new Vec3(x, y, z)
        const block = bot.blockAt(targetPos)

        if (!block || block.name === 'air') {
          return createSuccessResponse(
            'No block found at the specified coordinates.'
          )
        }

        // Check distance
        const distance = bot.entity.position.distanceTo(targetPos)
        if (distance > 4.5) {
          return createSuccessResponse(
            `Target block is too far (${distance.toFixed(1)} blocks away). Please use 'moveTo' to get closer (within 4 blocks) before digging.`
          )
        }

        // Auto-equip best tool
        const pathfinder = bot.pathfinder as any // Access pathfinder directly
        // Use pathfinder's bestHarvestTool if available, or manual logic
        // But simpler: just get all items and check harvest compatibility
        
        // We will try to find the best tool in inventory
        const items = bot.inventory.items()
        const bestTool = items.reduce((best, item) => {
           // Simple heuristic: check mining speed multiplier
           const currentMultiplier = block.material && item.name.includes(block.material) ? 10 : 1 // Simplified
           // Actually mineflayer has a recipe/block lookup.
           // Let's rely on bot.pathfinder.bestHarvestTool if we can, but since we didn't setup the plugin for that specifically,
           // we will use a basic search.
           return best // Placeholder for complex logic, see below
        }, null)

        // Better approach: Use mineflayer's internal block digging check
        // We can just iterate inventory and see which one is fastest
        let fastestTool = null
        let maxSpeed = 1

        for (const item of items) {
            // digTime signature: (heldItemType, creative, inWater, notOnGround, enchantments, effects)
            // We assume survival, not in water, on ground for simplicity of comparison
            const noToolTime = block.digTime(null, false, false, false)
            const toolTime = block.digTime(item.type, false, false, false)
            
            const multiplier = noToolTime / toolTime
            if (multiplier > maxSpeed) {
                maxSpeed = multiplier
                fastestTool = item
            }
        }

        if (fastestTool) {
            try {
                await bot.equip(fastestTool, 'hand')
            } catch (e) {
                console.error("Failed to equip tool:", e)
            }
        }

        return new Promise<ToolResponse>((resolve) => {
          let deathListener: () => void;

          // Cleanup function to remove listener
          const cleanup = () => {
            if (deathListener) {
              botState.bot?.removeListener('death', deathListener)
            }
          }

          // Listener for death event
          deathListener = () => {
            cleanup()
            const spawnPos = botState.bot?.entity.position
            resolve(createSuccessResponse( // Return success type but with warning text so AI processes it
              `⚠️ CRITICAL: Bot DIED while digging! \n` +
              `- Action: Cancelled\n` +
              `- Inventory: Likely dropped at death location\n` +
              `- Current Location: Respawned at X=${spawnPos?.x.toFixed(0)}, Y=${spawnPos?.y.toFixed(0)}, Z=${spawnPos?.z.toFixed(0)}\n` +
              `Please replan your actions.`
            ))
          }

          botState.bot!.on('death', deathListener)

          // Dig the block
          botState
            .bot!.dig(block)
            .then(() => {
              cleanup()
              resolve(
                createSuccessResponse(
                  `Successfully dug ${block.name} at X=${x}, Y=${y}, Z=${z}`
                )
              )
            })
            .catch((err) => {
              cleanup()
              resolve(createErrorResponse(err))
            })

          // Timeout handling (if still digging after 30 seconds)
          setTimeout(() => {
            cleanup()
            resolve(
              createSuccessResponse(
                'Digging is taking longer than expected. Still trying...'
              )
            )
          }, 30000)
        })
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )

  // Tool for placing blocks
  server.tool(
    'placeBlock',
    'Place a block at the specified location',
    {
      x: z.number().describe('X coordinate'),
      y: z.number().describe('Y coordinate'),
      z: z.number().describe('Z coordinate'),
      itemName: z.string().describe('Name of the item to place'),
    },
    async ({ x, y, z, itemName }) => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        // Find item from inventory
        const item = botState.bot.inventory
          .items()
          .find((item) => item.name.toLowerCase() === itemName.toLowerCase())

        if (!item) {
          return createSuccessResponse(
            `Item "${itemName}" not found in inventory.`
          )
        }

        // Hold item in hand
        await botState.bot.equip(item, 'hand')

        // Get reference block and placement face for target position
        const targetPos = { x, y, z }
        const faceVectors = [
          { x: 0, y: 1, z: 0 }, // Up
          { x: 0, y: -1, z: 0 }, // Down
          { x: 1, y: 0, z: 0 }, // East
          { x: -1, y: 0, z: 0 }, // West
          { x: 0, y: 0, z: 1 }, // South
          { x: 0, y: 0, z: -1 }, // North
        ]

        // Check each face to see if placement is possible
        for (const faceVector of faceVectors) {
          const referencePos = {
            x: targetPos.x - faceVector.x,
            y: targetPos.y - faceVector.y,
            z: targetPos.z - faceVector.z,
          }

          const referenceBlock = botState.bot.blockAt(
            new Vec3(referencePos.x, referencePos.y, referencePos.z)
          )

          if (referenceBlock && referenceBlock.name !== 'air') {
            try {
              // Place the block
              await botState.bot.placeBlock(
                referenceBlock,
                new Vec3(faceVector.x, faceVector.y, faceVector.z)
              )

              return createSuccessResponse(
                `Successfully placed ${itemName} at X=${x}, Y=${y}, Z=${z}`
              )
            } catch (err) {
              // If placement fails on this face, try the next face
              continue
            }
          }
        }

        // If placement fails on all faces
        return createSuccessResponse(
          `Failed to place ${itemName}. No suitable surface found or not enough space.`
        )
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )

  // Tool for finding blocks nearby
  server.tool(
    'findBlocks',
    'Search for specific block types in the surrounding area',
    {
      blockNames: z
        .array(z.string())
        .describe('List of block names to search for (e.g., ["oak_log", "stone"])'),
      maxDistance: z
        .number()
        .optional()
        .default(32)
        .describe('Maximum distance to search (default: 32)'),
      count: z
        .number()
        .optional()
        .default(1)
        .describe('Maximum number of blocks to find (default: 1)'),
    },
    async ({ blockNames, maxDistance, count }) => {
      if (!botState.isConnected || !botState.bot) {
        return createNotConnectedResponse()
      }

      try {
        const bot = botState.bot
        
        // Find block IDs for the given names
        const blockTypes = blockNames
          .map(name => {
            const block = bot.registry.blocksByName[name.toLowerCase()]
            return block ? block.id : null
          })
          .filter(id => id !== null) as number[]

        if (blockTypes.length === 0) {
          return createErrorResponse(`None of the specified blocks [${blockNames.join(', ')}] were found in the game registry.`)
        }

        const foundPositions = bot.findBlocks({
          matching: blockTypes,
          maxDistance,
          count: count * 2 // Find more initially, then sort and slice
        })

        if (foundPositions.length === 0) {
          return createSuccessResponse(`No blocks of type [${blockNames.join(', ')}] found within ${maxDistance} blocks.`)
        }

        // Sort by weighted distance (penalize vertical distance to prefer blocks at same level)
        const botPos = bot.entity.position
        foundPositions.sort((a, b) => {
            const distA = a.distanceTo(botPos)
            const distB = b.distanceTo(botPos)
            const vertA = Math.abs(a.y - botPos.y)
            const vertB = Math.abs(b.y - botPos.y)
            
            // Score = distance + vertical_penalty
            // We want blocks closer to our Y level to appear first even if they are slightly further horizontally
            const scoreA = distA + (vertA * 2) 
            const scoreB = distB + (vertB * 2)
            
            return scoreA - scoreB
        })

        // Take only requested count
        const limitedPositions = foundPositions.slice(0, count)

        const results = limitedPositions.map(pos => {
          const block = bot.blockAt(pos)
          return {
            name: block?.name || 'unknown',
            x: pos.x,
            y: pos.y,
            z: pos.z,
            distance: pos.distanceTo(bot.entity.position).toFixed(1)
          }
        })

        const resultText = results
          .map(r => `${r.name} at X=${r.x}, Y=${r.y}, Z=${r.z} (${r.distance} blocks away)`)
          .join('\n')

        return createSuccessResponse(`Found the following blocks:\n${resultText}`)
      } catch (error) {
        return createErrorResponse(error)
      }
    }
  )
}
