import { z } from 'zod'
import { botState, server } from '../server.js'
import {
    createErrorResponse,
    createNotConnectedResponse,
    createSuccessResponse,
} from '../utils/error-handler.js'
import { ToolResponse } from '../types.js'
import { Vec3 } from 'vec3'
import pkg from 'mineflayer-pathfinder'
const { goals } = pkg

export function registerResourceTools() {
    server.tool(
        'collectBlocks',
        'Collect a specific type of block from the world (e.g., wood, ores). Smartly follows connected blocks (vein mining/tree cutting).',
        {
            blockType: z.string().describe('The type of block to collect (e.g., "oak_log", "iron_ore")'),
            count: z.number().optional().default(1).describe('Number of blocks to collect (default: 1)'),
        },
        async ({ blockType, count }) => {
            if (!botState.isConnected || !botState.bot) {
                return createNotConnectedResponse()
            }

            try {
                const bot = botState.bot
                const mcData = require('minecraft-data')(bot.version)

                // Find block by name (support loose matching)
                let targetId = null
                const targetBlock = bot.registry.blocksByName[blockType.toLowerCase()]
                if (targetBlock) {
                    targetId = targetBlock.id
                } else {
                    // Try to find partially matching blocks if exact match fails
                    const allBlocks = Object.values(bot.registry.blocks)
                    const match = allBlocks.find(b => b.name.includes(blockType.toLowerCase()))
                    if (match) {
                        targetId = match.id
                        console.log(`Inferred block "${match.name}" from input "${blockType}"`)
                    }
                }

                if (targetId === null) {
                    return createErrorResponse(`Block type "${blockType}" not found in Minecraft registry.`)
                }

                return new Promise<ToolResponse>(async (resolve) => {
                    let collectedCount = 0
                    const maxSearchDistance = 64

                    // Helper to safely dig a block
                    const digBlock = async (pos: Vec3): Promise<boolean> => {
                        const block = bot.blockAt(pos)
                        if (!block || block.type !== targetId) return false // Already gone or changed

                        // Move close enough if needed
                        if (bot.entity.position.distanceTo(pos) > 4.5) {
                            const goal = new goals.GoalBlock(pos.x, pos.y, pos.z)
                            try {
                                await bot.pathfinder.goto(goal)
                            } catch (e) {
                                return false // Cannot reach
                            }
                        }

                        // Equip best tool
                        // Simple version: just look for internal "best tool" logic or iterate
                        // For now, we rely on mineflayer's default behavior or we could add explicit tool equipping here
                        // analogous to blocks.ts logic.
                        // Reusing the simple logic from blocks.ts for consistency
                        const items = bot.inventory.items()
                        let fastestTool = null
                        let maxSpeed = 1
                        for (const item of items) {
                            const noToolTime = block.digTime(null, false, false, false)
                            const toolTime = block.digTime(item.type, false, false, false)
                            const multiplier = noToolTime / toolTime
                            if (multiplier > maxSpeed) {
                                maxSpeed = multiplier
                                fastestTool = item
                            }
                        }
                        if (fastestTool) {
                            try { await bot.equip(fastestTool, 'hand') } catch (e) { }
                        }

                        try {
                            await bot.dig(block)
                            collectedCount++
                            return true
                        } catch (e) {
                            // console.error("Dig failed", e)
                            return false
                        }
                    }

                    // Global search for the first block
                    let currentTargetPos: Vec3 | null = null

                    // Initial search
                    const blocks = bot.findBlocks({
                        matching: targetId,
                        maxDistance: maxSearchDistance,
                        count: 1
                    })

                    if (blocks.length === 0) {
                        resolve(createSuccessResponse(`Could not find any "${blockType}" within ${maxSearchDistance} blocks.`))
                        return
                    }

                    currentTargetPos = blocks[0]

                    // Main collection loop
                    const visited = new Set<string>() // formatted 'x,y,z'
                    const queue: Vec3[] = [currentTargetPos!]
                    visited.add(currentTargetPos!.toString())

                    while (collectedCount < count && queue.length > 0) {
                        // Determine next target
                        // If we have queue from vein mining, use it.
                        // If queue empty, but we still need more, do a new Global Search

                        let target = queue.shift()!

                        // Verify block still exists (it might not if we are checking stale queue, though we process strictly)
                        let b = bot.blockAt(target)
                        if (!b || b.type !== targetId) {
                            // If target invalid, try to find another one globally if we ran out of local neighbors
                            if (queue.length === 0) {
                                const freshBlocks = bot.findBlocks({
                                    matching: targetId,
                                    maxDistance: maxSearchDistance,
                                    count: 1
                                })
                                if (freshBlocks.length > 0) {
                                    target = freshBlocks[0]
                                    // Check if we already visited this specific block to avoid loops?
                                    // findBlocks returns nearest. If we mined the nearest, the next nearest appears.
                                } else {
                                    break // No more blocks in world
                                }
                            } else {
                                continue // Skip invalid block, try next in queue
                            }
                        }

                        const success = await digBlock(target)
                        if (success) {
                            // Look for neighbors to Refill Queue (Vein Mining)
                            const vectors = [
                                new Vec3(0, 1, 0),  // Up (Priority for trees)
                                new Vec3(0, -1, 0), // Down
                                new Vec3(1, 0, 0),
                                new Vec3(-1, 0, 0),
                                new Vec3(0, 0, 1),
                                new Vec3(0, 0, -1)
                            ]

                            for (const vec of vectors) {
                                const neighborPos = target.plus(vec)
                                const neighborBlock = bot.blockAt(neighborPos)
                                if (neighborBlock && neighborBlock.type === targetId) {
                                    if (!visited.has(neighborPos.toString())) {
                                        visited.add(neighborPos.toString())
                                        // Push to FRONT of queue if Up/Down to prioritize verticality (trees)
                                        if (vec.y !== 0) {
                                            queue.unshift(neighborPos)
                                        } else {
                                            queue.push(neighborPos)
                                        }
                                    }
                                }
                            }
                        } else {
                            // If failed to dig (unreachable?), maybe try next available?
                        }

                        // If queue is empty but we haven't reached count, scan again
                        if (queue.length === 0 && collectedCount < count) {
                            const freshBlocks = bot.findBlocks({
                                matching: targetId,
                                maxDistance: maxSearchDistance,
                                count: 1
                            })
                            if (freshBlocks.length > 0) {
                                const freshPos = freshBlocks[0]
                                // Ensure we confuse this new block with something we just mined?
                                // findBlocks finds non-air blocks. We just turned previous target to air.
                                // So this should find a new valid block.
                                queue.push(freshPos)
                                visited.add(freshPos.toString())
                            }
                        }
                    }

                    resolve(createSuccessResponse(
                        `Collected ${collectedCount}/${count} ${blockType}.` +
                        (queue.length === 0 && collectedCount < count ? " Could not find more nearby." : "")
                    ))
                })
            } catch (error) {
                return createErrorResponse(error)
            }
        }
    )
}
