import { describe, test, expect } from 'vitest'
import { PLATFORM_ID, STORAGE_TYPE } from '../../../../src/constants'
import { createBridgeByPlatformId } from '../../../common/bridge/bridge'
import { SUPPORTED_FEATURES } from '../../../../src/platform-bridges/QaToolPlatformBridge'
import PlaygamaBridge from '../../../../src/PlaygamaBridge'

interface Feature {
    keys: string[]
    check: (bridge: PlaygamaBridge) => boolean
}

const FEATURES: Feature[] = [
    // Player
    {
        keys: [SUPPORTED_FEATURES.PLAYER_AUTHORIZATION],
        check: (bridge: PlaygamaBridge) => bridge.player.isAuthorizationSupported,
    },

    // Remote Config
    {
        keys: [SUPPORTED_FEATURES.REMOTE_CONFIG],
        check: (bridge: PlaygamaBridge) => bridge.remoteConfig.isSupported,
    },

    // Payments
    {
        keys: [SUPPORTED_FEATURES.PAYMENTS],
        check: (bridge: PlaygamaBridge) => bridge.payments.isSupported,
    },

    // Social
    {
        keys: [SUPPORTED_FEATURES.SOCIAL_SHARE],
        check: (bridge: PlaygamaBridge) => bridge.social.isShareSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.SOCIAL_JOIN_COMMUNITY],
        check: (bridge: PlaygamaBridge) => bridge.social.isJoinCommunitySupported,
    },
    {
        keys: [SUPPORTED_FEATURES.SOCIAL_INVITE_FRIENDS],
        check: (bridge: PlaygamaBridge) => bridge.social.isInviteFriendsSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.SOCIAL_CREATE_POST],
        check: (bridge: PlaygamaBridge) => bridge.social.isCreatePostSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.SOCIAL_ADD_TO_FAVORITES],
        check: (bridge: PlaygamaBridge) => bridge.social.isAddToFavoritesSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.SOCIAL_ADD_TO_HOME_SCREEN],
        check: (bridge: PlaygamaBridge) => bridge.social.isAddToHomeScreenSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.SOCIAL_RATE],
        check: (bridge: PlaygamaBridge) => bridge.social.isRateSupported,
    },

    // Storage
    {
        keys: [SUPPORTED_FEATURES.STORAGE_LOCAL],
        check: (bridge: PlaygamaBridge) => bridge.storage.isSupported(STORAGE_TYPE.LOCAL_STORAGE),
    },
    {
        keys: [SUPPORTED_FEATURES.STORAGE_INTERNAL],
        check: (bridge: PlaygamaBridge) => bridge.storage.isSupported(STORAGE_TYPE.PLATFORM_INTERNAL),
    },

    // Advertisement
    {
        keys: [SUPPORTED_FEATURES.BANNER],
        check: (bridge: PlaygamaBridge) => bridge.advertisement.isBannerSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.INTERSTITIAL],
        check: (bridge: PlaygamaBridge) => bridge.advertisement.isInterstitialSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.REWARDED],
        check: (bridge: PlaygamaBridge) => bridge.advertisement.isRewardedSupported,
    },

    // Clipboard
    {
        keys: [SUPPORTED_FEATURES.CLIPBOARD],
        check: (bridge: PlaygamaBridge) => bridge.clipboard.isSupported,
    },

    // Achievements
    {
        keys: [SUPPORTED_FEATURES.ACHIEVEMENTS],
        check: (bridge: PlaygamaBridge) => bridge.achievements.isSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.ACHIEVEMENTS, SUPPORTED_FEATURES.ACHIEVEMENTS_GET_LIST],
        check: (bridge: PlaygamaBridge) => bridge.achievements.isGetListSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.ACHIEVEMENTS, SUPPORTED_FEATURES.ACHIEVEMENTS_NATIVE_POPUP],
        check: (bridge: PlaygamaBridge) => bridge.achievements.isNativePopupSupported,
    }
]

describe('Platform QA Tool (integration, PlaygamaBridge)', () => {
    test.each(FEATURES)('Disabled feature %s', async (feature: Feature) => {
        const { bridge } = await createBridgeByPlatformId(PLATFORM_ID.QA_TOOL)
        expect(feature.check(bridge)).toBe(false)
    })

    test.each(FEATURES)('Enabled feature %s', async (feature: Feature) => {
        const { bridge } = await createBridgeByPlatformId(PLATFORM_ID.QA_TOOL, { 
            supportedFeatures: feature.keys
        })
        expect(feature.check(bridge)).toBe(true)
    })
})

