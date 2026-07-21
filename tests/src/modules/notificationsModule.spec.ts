import {
    describe, test, expect, vi, beforeEach,
} from 'vitest'
import NotificationsModule from '../../../src/modules/notifications/NotificationsModule'
import type { NotificationsBridgeContract } from '../../../src/modules/notifications/NotificationsModule'
import type { ScheduledNotification } from '../../../src/modules/notifications/types'
import MsnPlatformBridge from '../../../src/platform-bridges/MsnPlatformBridge'
import bridgeConfig from '../../../src/lib/bridge-config'
import { ERROR_CODE, BridgeError } from '../../../src/constants'

async function loadConfig(values: Record<string, unknown>, platformId = 'msn') {
    global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve(''),
    })
    await bridgeConfig.load(undefined, values)
    bridgeConfig.initialize(platformId)
}

function createBridge(overrides: Record<string, unknown> = {}) {
    return {
        platformId: 'msn',
        playerId: 'player-1',
        isNotificationsSupported: true,
        notificationsLaunchPayload: null,
        notificationsSchedule: vi.fn().mockResolvedValue('ok'),
        on: vi.fn(),
        ...overrides,
    }
}

function createModule(bridge: ReturnType<typeof createBridge>) {
    return new NotificationsModule().initialize(bridge as unknown as NotificationsBridgeContract)
}

const VALID_NOTIFICATION: ScheduledNotification = {
    id: 'tournament',
    title: 'Tournament starts!',
    description: 'Join now and win prizes',
}

describe('NotificationsModule (without SaaS)', () => {
    beforeEach(async () => {
        await loadConfig({})
    })

    test('schedule forwards the notification and the config-mapped platform value to the bridge', async () => {
        await loadConfig({ notifications: [{ id: 'tournament', msn: 3 }] })
        const bridge = createBridge()

        await createModule(bridge).schedule(VALID_NOTIFICATION)

        expect(bridge.notificationsSchedule).toHaveBeenCalledWith(VALID_NOTIFICATION, 3)
    })

    test('schedule passes undefined platform value when there is no mapping', async () => {
        const bridge = createBridge()

        await createModule(bridge).schedule(VALID_NOTIFICATION)

        expect(bridge.notificationsSchedule).toHaveBeenCalledWith(VALID_NOTIFICATION, undefined)
    })

    test('isSupported proxies the platform bridge', () => {
        expect(createModule(createBridge()).isSupported).toBe(true)
        expect(createModule(createBridge({ isNotificationsSupported: false })).isSupported).toBe(false)
    })

    test('getLaunchPayload proxies the platform bridge', () => {
        const bridge = createBridge({ notificationsLaunchPayload: '{"quest":12}' })
        expect(createModule(bridge).getLaunchPayload()).toBe('{"quest":12}')
    })

    test.each([
        ['missing id', { ...VALID_NOTIFICATION, id: '' }],
        ['missing title', { ...VALID_NOTIFICATION, title: '' }],
        ['missing description', { ...VALID_NOTIFICATION, description: undefined }],
        ['negative delay', { ...VALID_NOTIFICATION, delaySeconds: -1 }],
        ['non-integer delay', { ...VALID_NOTIFICATION, delaySeconds: 1.5 }],
        ['non-string payload', { ...VALID_NOTIFICATION, payload: { a: 1 } }],
    ])('schedule rejects with NOTIFICATION_INVALID_PARAMETERS on %s', async (_label, notification) => {
        const bridge = createBridge()

        await expect(createModule(bridge).schedule(notification as unknown as ScheduledNotification))
            .rejects.toMatchObject({ code: ERROR_CODE.NOTIFICATION_INVALID_PARAMETERS })
        expect(bridge.notificationsSchedule).not.toHaveBeenCalled()
    })
})

describe('MsnPlatformBridge notifications', () => {
    async function createMsnBridge(configValues: Record<string, unknown> = {}) {
        await loadConfig(configValues)
        const bridge = new MsnPlatformBridge()
        const scheduleNotificationAsync = vi.fn().mockResolvedValue('Successfully queued the notification.');
        (bridge as unknown as { _platformSdk: unknown })._platformSdk = { scheduleNotificationAsync }
        return { bridge, scheduleNotificationAsync }
    }

    test('maps generic fields onto the MSN notification shape', async () => {
        const { bridge, scheduleNotificationAsync } = await createMsnBridge()

        await bridge.notificationsSchedule({
            ...VALID_NOTIFICATION,
            delaySeconds: 3600,
            image: 'https://cdn.mygame.com/promo.png',
            callToAction: 'Play now',
            payload: 'tournament=1',
        }, 3)

        expect(scheduleNotificationAsync).toHaveBeenCalledWith({
            title: VALID_NOTIFICATION.title,
            description: VALID_NOTIFICATION.description,
            type: 3,
            minDelayInSeconds: 3600,
            imageData: 'https://cdn.mygame.com/promo.png',
            callToAction: 'Play now',
            payload: 'tournament=1',
        })
    })

    test('omits optional fields that were not provided', async () => {
        const { bridge, scheduleNotificationAsync } = await createMsnBridge()

        await bridge.notificationsSchedule(VALID_NOTIFICATION, '5')

        expect(scheduleNotificationAsync).toHaveBeenCalledWith({
            title: VALID_NOTIFICATION.title,
            description: VALID_NOTIFICATION.description,
            type: 5,
        })
    })

    test.each([
        ['no mapping', VALID_NOTIFICATION, undefined],
        ['non-integer type', VALID_NOTIFICATION, 1.5],
        ['type out of range', VALID_NOTIFICATION, 16],
        ['reserved auto type', VALID_NOTIFICATION, 8],
        ['title too long', { ...VALID_NOTIFICATION, title: 'a'.repeat(61) }, 3],
        ['description too long', { ...VALID_NOTIFICATION, description: 'a'.repeat(201) }, 3],
        ['delay over 7 days', { ...VALID_NOTIFICATION, delaySeconds: 604801 }, 3],
    ])('rejects on %s without calling the SDK', async (_label, notification, platformValue) => {
        const { bridge, scheduleNotificationAsync } = await createMsnBridge()

        await expect(bridge.notificationsSchedule(notification, platformValue))
            .rejects.toMatchObject({ code: ERROR_CODE.NOTIFICATION_INVALID_PARAMETERS })
        expect(scheduleNotificationAsync).not.toHaveBeenCalled()
    })

    test('allows reserved types when auto notifications are disabled', async () => {
        const { bridge, scheduleNotificationAsync } = await createMsnBridge({ disableAutoNotifications: true })

        await bridge.notificationsSchedule(VALID_NOTIFICATION, 8)

        expect(scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ type: 8 }))
    })

    test('base bridge rejects scheduling with NOTIFICATIONS_NOT_SUPPORTED', async () => {
        await loadConfig({})
        const bridge = new MsnPlatformBridge()
        const base = Object.getPrototypeOf(Object.getPrototypeOf(bridge))

        await expect(base.notificationsSchedule.call(bridge, VALID_NOTIFICATION, 3))
            .rejects.toBeInstanceOf(BridgeError)
    })
})
