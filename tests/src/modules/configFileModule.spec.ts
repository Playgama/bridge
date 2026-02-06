import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ConfigFileModule, LOAD_STATUS, PARSE_STATUS } from '../../../src/modules/ConfigFileModule'

function createConfigFileModule() {
    return new ConfigFileModule()
}

function mockFetch(response: { ok: boolean; status?: number; statusText?: string; text?: string }) {
    return vi.fn().mockResolvedValue({
        ok: response.ok,
        status: response.status || 200,
        statusText: response.statusText || 'OK',
        text: () => Promise.resolve(response.text || ''),
    })
}

// Realistic config data based on schema
const createFullConfig = () => ({
    sendAnalyticsEvents: true,
    forciblySetPlatformId: '',
    disableLoadingLogo: false,
    showFullLoadingLogo: true,
    advertisement: {
        useBuiltInErrorPopup: true,
        minimumDelayBetweenInterstitial: 30000,
        interstitial: {
            preloadOnStart: true,
            placementFallback: 'default',
            placements: [
                {
                    id: 'default',
                    yandex: 'R-A-123456-1',
                    vk: 'vk_interstitial_1',
                    game_distribution: 'gd-inter-123',
                },
                {
                    id: 'level_end',
                    yandex: 'R-A-123456-2',
                    vk: 'vk_interstitial_2',
                },
            ],
        },
        rewarded: {
            preloadOnStart: true,
            placementFallback: 'default',
            placements: [
                {
                    id: 'default',
                    yandex: 'R-A-123456-3',
                    vk: 'vk_rewarded_1',
                    crazy_games: 'cg-rewarded-main',
                },
            ],
        },
        banner: {
            placements: [
                {
                    id: 'bottom_banner',
                    yandex: 'R-A-123456-4',
                },
            ],
        },
    },
    payments: [
        {
            id: 'coins_100',
            title: '100 Coins',
            description: 'Get 100 coins to spend in-game',
            price: 0.99,
            currency: 'USD',
            image: 'https://example.com/coins_100.png',
        },
        {
            id: 'premium',
            title: 'Premium Access',
            description: 'Unlock all premium features',
            price: 4.99,
            currency: 'USD',
        },
    ],
    leaderboards: [
        {
            id: 'high_scores',
            title: 'High Scores',
            description: 'Top players by score',
        },
        {
            id: 'weekly_best',
            title: 'Weekly Best',
        },
    ],
    device: {
        useBuiltInOrientationPopup: true,
        supportedOrientations: ['landscape', 'portrait'],
    },
    platforms: {
        yandex: {
            useSignedData: false,
        },
        game_distribution: {
            gameId: 'gd-game-12345',
        },
        telegram: {
            adsgramBlockId: 'tg-ads-block-123',
        },
        y8: {
            gameId: 'y8-game-id',
            adsenseId: 'ca-pub-1234567890',
            channelId: 'y8-channel-1',
        },
        lagged: {
            devId: 'lagged-dev-123',
            publisherId: 'lagged-pub-456',
        },
        huawei: {
            appId: 'huawei-app-12345',
        },
        msn: {
            gameId: 'msn-game-id-789',
        },
        discord: {
            appId: 'discord-app-123456789',
        },
        gamepush: {
            projectId: 'gp-project-123',
            publicToken: 'gp-token-abc123',
        },
        jio_games: {
            adTestMode: true,
        },
        crazy_games: {
            xsollaProjectId: 'xsolla-12345',
            isSandbox: false,
            useUserToken: true,
        },
        facebook: {
            subscribeForNotificationsOnStart: true,
        },
        xiaomi: {
            adSenseId: 'xiaomi-adsense-123',
            hostId: 'xiaomi-host-456',
        },
    },
})

describe('ConfigFileModule', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    describe('load', () => {
        test('should load and parse config successfully', async () => {
            const configData = createFullConfig()

            global.fetch = mockFetch({
                ok: true,
                text: JSON.stringify(configData),
            })

            const module = createConfigFileModule()
            await module.load()

            expect(module.loadStatus).toBe(LOAD_STATUS.SUCCESS)
            expect(module.parseStatus).toBe(PARSE_STATUS.SUCCESS)
            expect(module.options).toEqual(configData)
            expect(module.parsedContent).toEqual(configData)
            expect(module.path).toBe('./playgama-bridge-config.json')
        })

        test('should use custom config path', async () => {
            const customPath = './custom-config.json'
            const configData = {
                sendAnalyticsEvents: false,
                platforms: {
                    yandex: { useSignedData: true },
                },
            }

            global.fetch = mockFetch({
                ok: true,
                text: JSON.stringify(configData),
            })

            const module = createConfigFileModule()
            await module.load(customPath)

            expect(module.path).toBe(customPath)
            expect(global.fetch).toHaveBeenCalledWith(customPath)
        })

        test('should use fallback options when fetch fails', async () => {
            const fallbackOptions = {
                sendAnalyticsEvents: true,
                advertisement: {
                    minimumDelayBetweenInterstitial: 60000,
                },
            }

            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

            const module = createConfigFileModule()
            await module.load(undefined, fallbackOptions)

            expect(module.loadStatus).toBe(LOAD_STATUS.FAILED)
            expect(module.options).toEqual(fallbackOptions)
            expect(module.loadError).toBe('Network error')
        })

        test('should use fallback options when response is not ok', async () => {
            const fallbackOptions = {
                disableLoadingLogo: true,
                device: {
                    supportedOrientations: ['landscape'],
                },
            }

            global.fetch = mockFetch({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            })

            const module = createConfigFileModule()
            await module.load(undefined, fallbackOptions)

            expect(module.loadStatus).toBe(LOAD_STATUS.FAILED)
            expect(module.options).toEqual(fallbackOptions)
            expect(module.loadError).toContain('404')
        })

        test('should use fallback options when JSON is invalid', async () => {
            const fallbackOptions = {
                sendAnalyticsEvents: false,
                platforms: {
                    telegram: { adsgramBlockId: 'fallback-block' },
                },
            }

            global.fetch = mockFetch({
                ok: true,
                text: 'invalid json {{{',
            })

            const module = createConfigFileModule()
            await module.load(undefined, fallbackOptions)

            expect(module.loadStatus).toBe(LOAD_STATUS.SUCCESS)
            expect(module.parseStatus).toBe(PARSE_STATUS.FAILED)
            expect(module.options).toEqual(fallbackOptions)
            expect(module.parseError).toContain('Failed to parse bridge config')
        })

        test('should store raw content', async () => {
            const configData = {
                sendAnalyticsEvents: true,
                leaderboards: [{ id: 'main', title: 'Main Leaderboard' }],
            }
            const rawJson = JSON.stringify(configData)

            global.fetch = mockFetch({
                ok: true,
                text: rawJson,
            })

            const module = createConfigFileModule()
            await module.load()

            expect(module.rawContent).toBe(rawJson)
        })
    })

    describe('getPlatformOptions', () => {
        test('should return base options when platform not found', async () => {
            const configData = {
                sendAnalyticsEvents: true,
                advertisement: {
                    minimumDelayBetweenInterstitial: 30000,
                    interstitial: {
                        preloadOnStart: true,
                        placements: [{ id: 'default' }],
                    },
                },
            }

            global.fetch = mockFetch({
                ok: true,
                text: JSON.stringify(configData),
            })

            const module = createConfigFileModule()
            await module.load()

            const platformOptions = module.getPlatformOptions('unknown_platform')

            expect(platformOptions).toEqual(configData)
        })

        test('should return base options when no platforms defined', async () => {
            const configData = {
                sendAnalyticsEvents: true,
                disableLoadingLogo: false,
            }

            global.fetch = mockFetch({
                ok: true,
                text: JSON.stringify(configData),
            })

            const module = createConfigFileModule()
            await module.load()

            const platformOptions = module.getPlatformOptions('yandex')

            expect(platformOptions).toEqual(configData)
        })

        test('should merge platform options with base options for yandex', async () => {
            const configData = {
                sendAnalyticsEvents: true,
                advertisement: {
                    minimumDelayBetweenInterstitial: 30000,
                    interstitial: {
                        preloadOnStart: true,
                        placements: [
                            { id: 'default', yandex: 'R-A-123456-1' },
                        ],
                    },
                },
                platforms: {
                    yandex: {
                        useSignedData: true,
                        advertisement: {
                            minimumDelayBetweenInterstitial: 60000,
                        },
                    },
                },
            }

            global.fetch = mockFetch({
                ok: true,
                text: JSON.stringify(configData),
            })

            const module = createConfigFileModule()
            await module.load()

            const platformOptions = module.getPlatformOptions('yandex')

            expect(platformOptions.useSignedData).toBe(true)
            expect(platformOptions.sendAnalyticsEvents).toBe(true)
            expect(platformOptions.advertisement.minimumDelayBetweenInterstitial).toBe(60000)
            expect(platformOptions.advertisement.interstitial.preloadOnStart).toBe(true)
        })

        test('should deep merge nested advertisement objects', async () => {
            const configData = {
                advertisement: {
                    useBuiltInErrorPopup: true,
                    minimumDelayBetweenInterstitial: 30000,
                    interstitial: {
                        preloadOnStart: true,
                        placementFallback: 'default',
                        placements: [
                            { id: 'default', vk: 'vk_inter_1' },
                        ],
                    },
                    rewarded: {
                        preloadOnStart: false,
                        placements: [
                            { id: 'default', vk: 'vk_reward_1' },
                        ],
                    },
                },
                platforms: {
                    vk: {
                        advertisement: {
                            minimumDelayBetweenInterstitial: 45000,
                            interstitial: {
                                preloadOnStart: false,
                            },
                        },
                    },
                },
            }

            global.fetch = mockFetch({
                ok: true,
                text: JSON.stringify(configData),
            })

            const module = createConfigFileModule()
            await module.load()

            const platformOptions = module.getPlatformOptions('vk')

            // Should keep base values
            expect(platformOptions.advertisement.useBuiltInErrorPopup).toBe(true)
            expect(platformOptions.advertisement.interstitial.placementFallback).toBe('default')
            expect(platformOptions.advertisement.rewarded.preloadOnStart).toBe(false)
            // Should override specific values
            expect(platformOptions.advertisement.minimumDelayBetweenInterstitial).toBe(45000)
            expect(platformOptions.advertisement.interstitial.preloadOnStart).toBe(false)
        })

        test('should add platform-specific options for crazy_games', async () => {
            const configData = {
                sendAnalyticsEvents: true,
                advertisement: {
                    rewarded: {
                        placements: [{ id: 'default', crazy_games: 'cg-rewarded-1' }],
                    },
                },
                platforms: {
                    crazy_games: {
                        xsollaProjectId: 'xsolla-project-12345',
                        isSandbox: true,
                        useUserToken: false,
                    },
                },
            }

            global.fetch = mockFetch({
                ok: true,
                text: JSON.stringify(configData),
            })

            const module = createConfigFileModule()
            await module.load()

            const platformOptions = module.getPlatformOptions('crazy_games')

            expect(platformOptions.sendAnalyticsEvents).toBe(true)
            expect(platformOptions.xsollaProjectId).toBe('xsolla-project-12345')
            expect(platformOptions.isSandbox).toBe(true)
            expect(platformOptions.useUserToken).toBe(false)
        })

        test('should handle multiple platforms independently', async () => {
            const configData = {
                sendAnalyticsEvents: true,
                platforms: {
                    yandex: { useSignedData: true },
                    game_distribution: { gameId: 'gd-game-123' },
                    telegram: { adsgramBlockId: 'tg-block-456' },
                    gamepush: { projectId: 'gp-123', publicToken: 'token-abc' },
                },
            }

            global.fetch = mockFetch({
                ok: true,
                text: JSON.stringify(configData),
            })

            const module = createConfigFileModule()
            await module.load()

            const yandexOptions = module.getPlatformOptions('yandex')
            expect(yandexOptions.useSignedData).toBe(true)
            expect(yandexOptions.sendAnalyticsEvents).toBe(true)

            const gdOptions = module.getPlatformOptions('game_distribution')
            expect(gdOptions.gameId).toBe('gd-game-123')
            expect(gdOptions.sendAnalyticsEvents).toBe(true)

            const tgOptions = module.getPlatformOptions('telegram')
            expect(tgOptions.adsgramBlockId).toBe('tg-block-456')

            const gpOptions = module.getPlatformOptions('gamepush')
            expect(gpOptions.projectId).toBe('gp-123')
            expect(gpOptions.publicToken).toBe('token-abc')

            // Unknown platform should get base options only
            const unknownOptions = module.getPlatformOptions('unknown')
            expect(unknownOptions.sendAnalyticsEvents).toBe(true)
            expect(unknownOptions.useSignedData).toBeUndefined()
        })

        test('should merge payments arrays by index (deepMerge behavior)', async () => {
            const configData = {
                payments: [
                    { id: 'base_item', title: 'Base Item', description: 'Base', price: 1.99 },
                    { id: 'base_item_2', title: 'Base Item 2', description: 'Base 2', price: 3.99 },
                ],
                leaderboards: [
                    { id: 'base_board', title: 'Base Board' },
                ],
                platforms: {
                    facebook: {
                        subscribeForNotificationsOnStart: false,
                        payments: [
                            { id: 'fb_item', title: 'FB Item', description: 'FB only', price: 2.99 },
                        ],
                    },
                },
            }

            global.fetch = mockFetch({
                ok: true,
                text: JSON.stringify(configData),
            })

            const module = createConfigFileModule()
            await module.load()

            const fbOptions = module.getPlatformOptions('facebook')

            expect(fbOptions.subscribeForNotificationsOnStart).toBe(false)
            // deepMerge merges arrays by index - first element is overwritten, second remains
            expect(fbOptions.payments[0]).toEqual({ id: 'fb_item', title: 'FB Item', description: 'FB only', price: 2.99 })
            expect(fbOptions.payments[1]).toEqual({ id: 'base_item_2', title: 'Base Item 2', description: 'Base 2', price: 3.99 })
            // Base leaderboards should still be present
            expect(fbOptions.leaderboards).toEqual([
                { id: 'base_board', title: 'Base Board' },
            ])
        })

        test('should handle device orientation settings', async () => {
            const configData = {
                device: {
                    useBuiltInOrientationPopup: true,
                    supportedOrientations: ['landscape', 'portrait'],
                },
                platforms: {
                    jio_games: {
                        adTestMode: true,
                        device: {
                            useBuiltInOrientationPopup: false,
                        },
                    },
                },
            }

            global.fetch = mockFetch({
                ok: true,
                text: JSON.stringify(configData),
            })

            const module = createConfigFileModule()
            await module.load()

            const jioOptions = module.getPlatformOptions('jio_games')

            expect(jioOptions.adTestMode).toBe(true)
            // Platform device settings override base
            expect(jioOptions.device.useBuiltInOrientationPopup).toBe(false)
            // Base orientations preserved when not overridden
            expect(jioOptions.device.supportedOrientations).toEqual(['landscape', 'portrait'])
        })
    })

    describe('initial state', () => {
        test('should have pending status before load', () => {
            const module = createConfigFileModule()

            expect(module.loadStatus).toBe(LOAD_STATUS.PENDING)
            expect(module.parseStatus).toBe(PARSE_STATUS.PENDING)
            expect(module.options).toEqual({})
            expect(module.path).toBe('')
            expect(module.rawContent).toBe('')
            expect(module.loadError).toBe('')
            expect(module.parseError).toBe('')
        })
    })

    describe('forciblySetPlatformId', () => {
        test('should include forciblySetPlatformId in options', async () => {
            const configData = {
                forciblySetPlatformId: 'qa_tool',
                sendAnalyticsEvents: false,
            }

            global.fetch = mockFetch({
                ok: true,
                text: JSON.stringify(configData),
            })

            const module = createConfigFileModule()
            await module.load()

            expect((module.options as { forciblySetPlatformId?: string }).forciblySetPlatformId).toBe('qa_tool')
        })
    })
})
