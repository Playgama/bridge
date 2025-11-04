import { describe, it, expect } from 'vitest'
import { PLATFORM_ID, STORAGE_TYPE } from '../../../src/constants'
import { createBridgeByPlatformId } from '../../_helpers/bridge'
import { SUPPORTED_FEATURES } from '../../../src/platform-bridges/QaToolPlatformBridge'

const FEATURES = [
    // Player
    {
        keys: [SUPPORTED_FEATURES.PLAYER_AUTHORIZATION],
        check: (bridge) => bridge.player.isAuthorizationSupported,
    },

    // Remote Config
    {
        keys: [SUPPORTED_FEATURES.REMOTE_CONFIG],
        check: (bridge) => bridge.remoteConfig.isSupported,
    },

    // Payments
    {
        keys: [SUPPORTED_FEATURES.PAYMENTS],
        check: (bridge) => bridge.payments.isSupported,
    },

    // Social
    {
        keys: [SUPPORTED_FEATURES.SOCIAL_SHARE],
        check: (bridge) => bridge.social.isShareSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.SOCIAL_JOIN_COMMUNITY],
        check: (bridge) => bridge.social.isJoinCommunitySupported,
    },
    {
        keys: [SUPPORTED_FEATURES.SOCIAL_INVITE_FRIENDS],
        check: (bridge) => bridge.social.isInviteFriendsSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.SOCIAL_CREATE_POST],
        check: (bridge) => bridge.social.isCreatePostSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.SOCIAL_ADD_TO_FAVORITES],
        check: (bridge) => bridge.social.isAddToFavoritesSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.SOCIAL_ADD_TO_HOME_SCREEN],
        check: (bridge) => bridge.social.isAddToHomeScreenSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.SOCIAL_RATE],
        check: (bridge) => bridge.social.isRateSupported,
    },

    // Storage
    {
        keys: [SUPPORTED_FEATURES.STORAGE_LOCAL],
        check: (bridge) => bridge.storage.isSupported(STORAGE_TYPE.LOCAL_STORAGE),
    },
    {
        keys: [SUPPORTED_FEATURES.STORAGE_INTERNAL],
        check: (bridge) => bridge.storage.isSupported(STORAGE_TYPE.PLATFORM_INTERNAL),
    },

    // Advertisement
    {
        keys: [SUPPORTED_FEATURES.BANNER],
        check: (bridge) => bridge.advertisement.isBannerSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.INTERSTITIAL],
        check: (bridge) => bridge.advertisement.isInterstitialSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.REWARDED],
        check: (bridge) => bridge.advertisement.isRewardedSupported,
    },

    // Clipboard
    {
        keys: [SUPPORTED_FEATURES.CLIPBOARD],
        check: (bridge) => bridge.clipboard.isSupported,
    },

    // Achievements
    {
        keys: [SUPPORTED_FEATURES.ACHIEVEMENTS],
        check: (bridge) => bridge.achievements.isSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.ACHIEVEMENTS, SUPPORTED_FEATURES.ACHIEVEMENTS_GET_LIST],
        check: (bridge) => bridge.achievements.isGetListSupported,
    },
    {
        keys: [SUPPORTED_FEATURES.ACHIEVEMENTS, SUPPORTED_FEATURES.ACHIEVEMENTS_NATIVE_POPUP],
        check: (bridge) => bridge.achievements.isNativePopupSupported,
    }
]

describe('Platform QA Tool (integration, PlaygamaBridge)', () => {
    it('Disabled all features', async () => {
        const { bridge } = await createBridgeByPlatformId(PLATFORM_ID.QA_TOOL)

        for (const feature of FEATURES) {
            expect(feature.check(bridge)).toBe(false)
        }

    })

    it('Enabled features', async () => {
        for (const feature of FEATURES) {
            const { bridge } = await createBridgeByPlatformId(PLATFORM_ID.QA_TOOL, { 
                supportedFeatures: feature.keys 
            })
            expect(feature.check(bridge)).toBe(true)
        }
    })
})