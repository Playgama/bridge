function addDynamicScript() {
    const scriptElement = document.createElement('script')
    // const timestamp = Date.now()

    // scriptElement.src = `./playgama-bridge.js?r=${timestamp}`
    scriptElement.src = './playgama-bridge.js'
    document.body.appendChild(scriptElement)

    scriptElement.onload = function () {
        runAfterScriptLoad()
    }
}

function runAfterScriptLoad() {
    const optionsSection = document.getElementById('options-section')
    const platformSection = document.getElementById('platform-section')
    const gameSection = document.getElementById('game-section')
    const deviceSection = document.getElementById('device-section')
    const playerSection = document.getElementById('player-section')
    const storageSection = document.getElementById('storage-section')
    const advertisementSection = document.getElementById('advertisement-section')
    const socialSection = document.getElementById('social-section')
    const leaderboardsSection = document.getElementById('leaderboards-section')
    const paymentsSection = document.getElementById('payments-section')
    const achievementsSection = document.getElementById('achievements-section')
    const remoteConfigSection = document.getElementById('remote-config-section')
    const clipboardSection = document.getElementById('clipboard-section')

    platformSection.style.display = 'none'
    gameSection.style.display = 'none'
    deviceSection.style.display = 'none'
    playerSection.style.display = 'none'
    storageSection.style.display = 'none'
    advertisementSection.style.display = 'none'
    socialSection.style.display = 'none'
    leaderboardsSection.style.display = 'none'
    paymentsSection.style.display = 'none'
    achievementsSection.style.display = 'none'
    remoteConfigSection.style.display = 'none'
    clipboardSection.style.display = 'none'

    const platformIdText = document.getElementById('platform-id-text')
    const platformLanguageText = document.getElementById('platform-language-text')
    const platformPayloadText = document.getElementById('platform-payload-text')
    const platformTldText = document.getElementById('platform-tld-text')
    const platformServerTimeText = document.getElementById('platform-server-time-text')
    const platformSendMessageStatus = document.getElementById('platform-send-message-status')
    const platformServerTimeButton = document.getElementById('platform-server-time-button')
    const platformMessageInput = document.getElementById('platform-send-message-input')
    const platformMessageButton = document.getElementById('platform-send-message-button')
    const platformIsAudioEnabledText = document.getElementById('platform-is-audio-enabled-text')
    const platformIsGetAllGamesSupportedText = document.getElementById('platform-is-get-all-games-supported-text')
    const platformIsGetGameByIdSupportedText = document.getElementById('platform-is-get-game-by-id-supported-text')
    const platformAllGamesContainer = document.getElementById('platform-all-games-container')
    const platformGetAllGamesButton = document.getElementById('platform-get-all-games-button')
    const platformGameByIdInput = document.getElementById('platform-game-by-id-input')
    const platformGameByIdContainer = document.getElementById('platform-game-by-id-container')
    const platformGetGameByIdButton = document.getElementById('platform-get-game-by-id-button')

    const gameVisibilityStatesText = document.getElementById('game-visibility-states-text')

    const deviceTypeText = document.getElementById('device-type-text')

    const isPlayerAuthorizationSupportedText = document.getElementById('is-player-authorization-supported-text')
    const isPlayerAuthorizedText = document.getElementById('is-player-authorized-text')
    const playerIdText = document.getElementById('player-id-text')
    const playerNameText = document.getElementById('player-name-text')
    const playerPhotosText = document.getElementById('player-photos-text')
    const authorizePlayerButton = document.getElementById('authorize-player-button')

    const isStorageLocalStorageSupportedText = document.getElementById('is-storage-local-storage-supported-text')
    const isStorageLocalStorageAvailableText = document.getElementById('is-storage-local-storage-available-text')
    const isStoragePlatformInternalSupportedText = document.getElementById('is-storage-platform-internal-supported-text')
    const isStoragePlatformInternalAvailableText = document.getElementById('is-storage-platform-internal-available-text')
    const storageDataCoinsInput = document.getElementById('storage-data-coins-input')
    const storageDataLevelInput = document.getElementById('storage-data-level-input')
    const storageTypeInput = document.getElementById('storage-type-input')
    const getStorageDataButton = document.getElementById('get-storage-data-button')
    const setStorageDataButton = document.getElementById('set-storage-data-button')
    const deleteStorageDataButton = document.getElementById('delete-storage-data-button')

    const advertisementIsBannerSupportedText = document.getElementById('advertisement-is-banner-supported-text')
    const advertisementBannerStateText = document.getElementById('advertisement-banner-state-text')
    const advertisementShowBannerButton = document.getElementById('advertisement-show-banner-button')
    const advertisementHideBannerButton = document.getElementById('advertisement-hide-banner-button')
    const advertisementMinimumDelayBetweenInterstitialInput = document.getElementById('advertisement-minimum-delay-between-interstitial-input')
    const advertisementSetMinimumDelayBetweenInterstitialButton = document.getElementById('advertisement-set-minimum-delay-between-interstitial-button')
    const advertisementInterstitialStateText = document.getElementById('advertisement-interstitial-state-text')
    const advertisementIsInterstitialSupportedText = document.getElementById('advertisement-is-interstitial-supported-text')
    const advertisementShowInterstitialButton = document.getElementById('advertisement-show-interstitial-button')
    const advertisementRewardedStateText = document.getElementById('advertisement-rewarded-state-text')
    const advertisementRewardedPlacementText = document.getElementById('advertisement-rewarded-placement-text')
    const advertisementIsRewardedSupportedText = document.getElementById('advertisement-is-rewarded-supported-text')
    const advertisementShowRewardedButton = document.getElementById('advertisement-show-rewarded-button')
    const advertisementAdBlockDetectButton = document.getElementById('advertisement-is-adblock-detected-button')
    const advertisementIsAdBlockDetectedText = document.getElementById('advertisement-is-adblock-detected-text')

    const socialIsShareSupportedText = document.getElementById('social-is-share-supported-text')
    const socialIsInviteFriendsSupportedText = document.getElementById('social-is-invite-friends-supported-text')
    const socialIsJoinCommunitySupportedText = document.getElementById('social-is-join-community-supported-text')
    const socialIsCreatePostSupportedText = document.getElementById('social-is-create-post-supported-text')
    const socialIsAddToHomeScreenSupportedText = document.getElementById('social-is-add-to-home-screen-supported-text')
    const socialIsAddToFavoritesSupportedText = document.getElementById('social-is-add-to-favorites-supported-text')
    const socialIsRateSupportedText = document.getElementById('social-is-rate-supported-text')
    const socialVkGroupIdInput = document.getElementById('social-vk-group-id-input')
    const socialVkShareLinkInput = document.getElementById('social-vk-share-link-input')
    const socialShareButton = document.getElementById('social-share-button')
    const socialInviteFriendsButton = document.getElementById('social-invite-friends-button')
    const socialJoinCommunityButton = document.getElementById('social-join-community-button')
    const socialCreatePostMessageInput = document.getElementById('social-create-post-message-input')
    const socialCreatePostAttachmentsInput = document.getElementById('social-create-post-attachments-input')
    const socialCreatePostButton = document.getElementById('social-create-post-button')
    const socialAddToHomeScreenButton = document.getElementById('social-add-to-home-screen-button')
    const socialAddToFavoritesButton = document.getElementById('social-add-to-favorites-button')
    const socialRateButton = document.getElementById('social-rate-button')

    const leaderboardsIdInput = document.getElementById('leaderboards-id-input')
    const leaderboardsTypeText = document.getElementById('leaderboards-type-text')
    const leaderboardsScoreInput = document.getElementById('leaderboards-score-input')
    const leaderboardsSetScoreButton = document.getElementById('leaderboards-set-score-button')
    const leaderboardsGetEntriesButton = document.getElementById('leaderboards-get-entries-button')
    const leaderboardsEntriesContainer = document.getElementById('leaderboards-entries-container')
    const leaderboardsShowNativePopupButton = document.getElementById('leaderboards-show-native-popup-button')

    const paymentsIsSupportedText = document.getElementById('payments-is-supported-text')
    const paymentsGetPurchasesButton = document.getElementById('payments-get-purchases-button')
    const paymentPurchasesContainer = document.getElementById('payments-purchases-container')
    const paymentsGetCatalogButton = document.getElementById('payments-get-catalog-button')
    const paymentCatalogContainer = document.getElementById('payments-catalog-container')
    const paymentsPurchaseButton = document.getElementById('payments-purchase-button')
    const paymentsConsumeButton = document.getElementById('payments-consume-button')
    const purchaseStatusContainer = document.getElementById('payments-purchase-status')

    const achievementsIsSupportedText = document.getElementById('achievements-is-supported-text')
    const achievementsIsGetListSupportedText = document.getElementById('achievements-is-get-list-supported-text')
    const achievementsIsNativePopupSupportedText = document.getElementById('achievements-is-native-popup-supported-text')
    const achievementsGetListButton = document.getElementById('achievements-get-list-button')
    const achievementListContainer = document.getElementById('achievements-list-container')
    const achievementsShowNativeButton = document.getElementById('achievements-show-native-popup-button')
    const achievementsIdInput = document.getElementById('achievements-id-input')
    const achievementsNameInput = document.getElementById('achievements-name-input')
    const achievementsUnlockButton = document.getElementById('achievements-unlock-button')
    const achievementsUnlockStatusContainer = document.getElementById('achievements-unlock-status-container')

    const remoteConfigIsSupportedText = document.getElementById('remote-config-is-supported-text')
    const remoteConfigButton = document.getElementById('get-remote-config-button')
    const remoteConfigContainer = document.getElementById('remote-config-container')

    const clipboardIsSupportedText = document.getElementById('clipboard-is-supported-text')
    const clipboardInput = document.getElementById('clipboard-input')
    const clipboardReadButton = document.getElementById('clipboard-read-button')
    const clipboardWriteButton = document.getElementById('clipboard-write-button')

    const gameVisibilityStates = []
    let lastInterstitialStates = []
    let lastRewardedStates = []
    let lastBannerStates = []

    bridge
        .initialize()
        .then(() => {
            optionsSection.style.display = 'none'

            platformIdText.innerText = bridge.platform.id
            platformLanguageText.innerText = bridge.platform.language
            platformPayloadText.innerText = bridge.platform.payload
            platformTldText.innerText = bridge.platform.tld
            platformIsAudioEnabledText.innerText = bridge.platform.isAudioEnabled
            platformIsGetAllGamesSupportedText.innerText = bridge.platform.isGetAllGamesSupported
            platformIsGetGameByIdSupportedText.innerText = bridge.platform.isGetGameByIdSupported

            deviceTypeText.innerText = bridge.device.type

            isPlayerAuthorizationSupportedText.innerText = bridge.player.isAuthorizationSupported
            isPlayerAuthorizedText.innerText = bridge.player.isAuthorized

            playerIdText.innerText = bridge.player.id
            playerNameText.innerText = bridge.player.name
            playerPhotosText.innerText = bridge.player.photos

            isStorageLocalStorageSupportedText.innerText = bridge.storage.isSupported(bridge.STORAGE_TYPE.LOCAL_STORAGE)
            isStorageLocalStorageAvailableText.innerText = bridge.storage.isAvailable(bridge.STORAGE_TYPE.LOCAL_STORAGE)
            isStoragePlatformInternalSupportedText.innerText = bridge.storage.isSupported(bridge.STORAGE_TYPE.PLATFORM_INTERNAL)
            isStoragePlatformInternalAvailableText.innerText = bridge.storage.isAvailable(bridge.STORAGE_TYPE.PLATFORM_INTERNAL)

            socialIsShareSupportedText.innerText = bridge.social.isShareSupported
            socialIsInviteFriendsSupportedText.innerText = bridge.social.isInviteFriendsSupported
            socialIsJoinCommunitySupportedText.innerText = bridge.social.isJoinCommunitySupported
            socialIsCreatePostSupportedText.innerText = bridge.social.isCreatePostSupported
            socialIsAddToHomeScreenSupportedText.innerText = bridge.social.isAddToHomeScreenSupported
            socialIsAddToFavoritesSupportedText.innerText = bridge.social.isAddToFavoritesSupported
            socialIsRateSupportedText.innerText = bridge.social.isRateSupported

            advertisementIsBannerSupportedText.innerText = bridge.advertisement.isBannerSupported
            advertisementBannerStateText.innerText = bridge.advertisement.bannerState
            advertisementIsInterstitialSupportedText.innerText = bridge.advertisement.isInterstitialSupported
            advertisementInterstitialStateText.innerText = bridge.advertisement.interstitialState
            advertisementIsRewardedSupportedText.innerText = bridge.advertisement.isRewardedSupported
            advertisementRewardedStateText.innerText = bridge.advertisement.rewardedState
            advertisementMinimumDelayBetweenInterstitialInput.value = bridge.advertisement.minimumDelayBetweenInterstitial
            advertisementRewardedPlacementText.innerText = bridge.advertisement.rewardedPlacement

            gameVisibilityStates.push(bridge.game.visibilityState)
            gameVisibilityStatesText.innerText = gameVisibilityStates.join(' → ')

            bridge.game.on('visibility_state_changed', (state) => {
                gameVisibilityStates.push(state)
                gameVisibilityStatesText.innerText = gameVisibilityStates.join(' → ')
            })

            bridge.advertisement.on('interstitial_state_changed', (state) => {
                lastInterstitialStates.push(state)

                if (lastInterstitialStates.length > 3) {
                    lastInterstitialStates = lastInterstitialStates.slice(lastInterstitialStates.length - 3)
                }

                advertisementInterstitialStateText.innerText = lastInterstitialStates.join(' → ')
            })

            bridge.advertisement.on('rewarded_state_changed', (state) => {
                lastRewardedStates.push(state)

                if (lastRewardedStates.length > 3) {
                    lastRewardedStates = lastRewardedStates.slice(lastRewardedStates.length - 3)
                }

                advertisementRewardedStateText.innerText = lastRewardedStates.join(' → ')
                advertisementRewardedPlacementText.innerText = bridge.advertisement.rewardedPlacement
            })

            bridge.advertisement.on('banner_state_changed', (state) => {
                lastBannerStates.push(state)

                if (lastBannerStates.length > 3) {
                    lastBannerStates = lastBannerStates.slice(lastBannerStates.length - 3)
                }

                advertisementBannerStateText.innerText = lastBannerStates.join(' → ')
            })

            leaderboardsTypeText.innerText = bridge.leaderboards.type

            achievementsIsSupportedText.innerText = bridge.achievements.isSupported
            achievementsIsGetListSupportedText.innerText = bridge.achievements.isGetListSupported
            achievementsIsNativePopupSupportedText.innerText = bridge.achievements.isNativePopupSupported

            paymentsIsSupportedText.innerText = bridge.payments.isSupported
            remoteConfigIsSupportedText.innerText = bridge.remoteConfig.isSupported
            clipboardIsSupportedText.innerText = bridge.clipboard.isSupported

            platformSection.style.display = 'block'
            gameSection.style.display = 'block'
            deviceSection.style.display = 'block'
            playerSection.style.display = 'block'
            storageSection.style.display = 'block'
            advertisementSection.style.display = 'block'
            socialSection.style.display = 'block'
            leaderboardsSection.style.display = 'block'
            paymentsSection.style.display = 'block'
            achievementsSection.style.display = 'block'
            remoteConfigSection.style.display = 'block'
            clipboardSection.style.display = 'block'

            bridge.platform.sendMessage(bridge.PLATFORM_MESSAGE.GAME_READY)
        })

    platformServerTimeButton.addEventListener('click', () => {
        bridge.platform.getServerTime()
            .then((timestamp) => {
                platformServerTimeText.innerText = timestamp
            })
            .catch(() => {
                platformServerTimeText.innerText = 'Failed to fetch'
            })
    })

    platformMessageButton.addEventListener('click', () => {
        bridge
            .platform
            .sendMessage(platformMessageInput.value)
            .then(() => {
                platformSendMessageStatus.innerText = 'Success'
            })
            .catch((error) => {
                platformSendMessageStatus.innerText = `Failed: ${error}`
            })
    })

    platformGetAllGamesButton.addEventListener('click', () => {
        bridge
            .platform
            .getAllGames()
            .then((games) => {
                platformAllGamesContainer.innerText = JSON.stringify(games, undefined, 2)
            })
            .catch((error) => {
                platformAllGamesContainer.innerText = `Failed: ${error}`
            })
    })

    platformGetGameByIdButton.addEventListener('click', () => {
        bridge
            .platform
            .getGameById(platformGameByIdInput.value)
            .then((game) => {
                platformGameByIdContainer.innerText = JSON.stringify(game, undefined, 2)
            })
            .catch((error) => {
                platformGameByIdContainer.innerText = `Failed: ${error}`
            })
    })

    authorizePlayerButton.addEventListener('click', () => {
        bridge
            .player
            .authorize()
            .then(() => {
                isPlayerAuthorizedText.innerText = bridge.player.isAuthorized
                playerIdText.innerText = bridge.player.id
                playerNameText.innerText = bridge.player.name
                playerPhotosText.innerText = bridge.player.photos
            })
    })

    getStorageDataButton.addEventListener('click', () => {
        bridge.storage
            .get(['coins', 'level'], storageTypeInput.value)
            .then((data) => {
                console.log('Get Storage Data: Done', data)

                if (data) {
                    storageDataCoinsInput.value = data[0]
                    storageDataLevelInput.value = data[1]
                }
            })
            .catch((error) => console.log('Get Storage Data Error', error))
    })

    setStorageDataButton.addEventListener('click', () => {
        bridge.storage
            .set(['coins', 'level'], [storageDataCoinsInput.value, storageDataLevelInput.value], storageTypeInput.value)
            .then(() => console.log('Set Storage Data: Done'))
            .catch((error) => console.log('Set Storage Data Error', error))
    })

    deleteStorageDataButton.addEventListener('click', () => {
        bridge.storage
            .delete(['coins', 'level'], storageTypeInput.value)
            .then(() => {
                storageDataCoinsInput.value = ''
                storageDataLevelInput.value = ''
                console.log('Delete Storage Data: Done')
            })
            .catch((error) => console.log('Delete Storage Data Error', error))
    })

    advertisementSetMinimumDelayBetweenInterstitialButton.addEventListener('click', () => {
        const { value } = advertisementMinimumDelayBetweenInterstitialInput
        bridge.advertisement.setMinimumDelayBetweenInterstitial(value)
        advertisementMinimumDelayBetweenInterstitialInput.value = bridge.advertisement.minimumDelayBetweenInterstitial
    })

    advertisementShowBannerButton.addEventListener('click', () => {
        bridge.advertisement.showBanner()
    })

    advertisementHideBannerButton.addEventListener('click', () => {
        bridge.advertisement.hideBanner()
    })

    advertisementShowInterstitialButton.addEventListener('click', () => {
        bridge.advertisement.showInterstitial()
    })

    advertisementShowRewardedButton.addEventListener('click', () => {
        bridge.advertisement.showRewarded()
    })

    advertisementAdBlockDetectButton.addEventListener('click', () => {
        bridge.advertisement.checkAdBlock()
            .then((res) => {
                advertisementIsAdBlockDetectedText.innerText = res
            })
    })

    socialShareButton.addEventListener('click', () => {
        const data = {
            vk: {
                link: socialVkShareLinkInput.value,
            },
        }

        bridge.social.share(data)
    })

    socialInviteFriendsButton.addEventListener('click', () => {
        bridge.social.inviteFriends({ ok: { text: 'Invite friends' } })
    })

    socialJoinCommunityButton.addEventListener('click', () => {
        bridge.social.joinCommunity({ vk: { groupId: socialVkGroupIdInput.value } })
    })

    socialCreatePostButton.addEventListener('click', () => {
        const data = {
            vk: {
                message: socialCreatePostMessageInput.value,
                attachments: socialCreatePostAttachmentsInput.value,
            },
            ok: {
                media: [{
                    type: 'text',
                    text: socialCreatePostMessageInput.value,
                }],
            },
        }
        bridge.social.createPost(data)
    })

    socialAddToHomeScreenButton.addEventListener('click', () => {
        bridge.social.addToHomeScreen()
    })

    socialAddToFavoritesButton.addEventListener('click', () => {
        bridge.social.addToFavorites()
    })

    socialRateButton.addEventListener('click', () => {
        bridge.social.rate()
    })

    leaderboardsSetScoreButton.addEventListener('click', () => {
        bridge
            .leaderboards
            .setScore(leaderboardsIdInput.value, leaderboardsScoreInput.value)
    })

    leaderboardsGetEntriesButton.addEventListener('click', () => {
        bridge
            .leaderboards
            .getEntries(leaderboardsIdInput.value)
            .then((data) => {
                let text = ''
                data.forEach((e) => {
                    text += `ID: ${e.id}, name: ${e.name}, score: ${e.score}, rank: ${e.rank}, photo: ${e.photo}`
                })
                leaderboardsEntriesContainer.innerText = text
            })
    })

    leaderboardsShowNativePopupButton.addEventListener('click', () => {
        bridge.leaderboards.showNativePopup(leaderboardsIdInput.value)
            .catch((error) => console.log(error))
    })

    paymentsGetPurchasesButton.addEventListener('click', () => {
        bridge.payments.getPurchases()
            .then((purchases) => paymentPurchasesContainer.innerText = JSON.stringify(purchases, undefined, 2))
    })

    paymentsGetCatalogButton.addEventListener('click', () => {
        bridge.payments.getCatalog()
            .then((catalog) => paymentCatalogContainer.innerText = JSON.stringify(catalog, undefined, 2))
    })

    paymentsPurchaseButton.addEventListener('click', () => {
        bridge.payments.purchase(document.getElementById('payments-id-input').value)
            .then((result) => { purchaseStatusContainer.innerText = JSON.stringify(result) })
            .catch((error) => { purchaseStatusContainer.innerText = JSON.stringify(error) })
    })

    paymentsConsumeButton.addEventListener('click', () => {
        bridge.payments.consumePurchase(document.getElementById('payments-id-input').value)
            .then((result) => { purchaseStatusContainer.innerText = JSON.stringify(result) })
            .catch((error) => { purchaseStatusContainer.innerText = JSON.stringify(error) })
    })

    achievementsShowNativeButton.addEventListener('click', () => {
        bridge.achievements.showNativePopup()
            .catch((error) => console.log(error))
    })

    achievementsGetListButton.addEventListener('click', () => {
        bridge.achievements.getList()
            .then((list) => achievementListContainer.innerText = JSON.stringify(list))
            .catch((error) => console.log(error))
    })

    achievementsUnlockButton.addEventListener('click', () => {
        let options = {}

        switch (bridge.platform.id) {
            case 'lagged':
                options = {
                    achievement: achievementsIdInput.value,
                }
                break
            case 'y8':
                options = {
                    achievement: achievementsNameInput.value,
                    achievementkey: achievementsIdInput.value,
                }
                break
            default:
                break
        }

        bridge.achievements.unlock(options)
            .then((result) => achievementsUnlockStatusContainer.innerText = JSON.stringify(result))
            .catch((error) => console.log(error))
    })

    remoteConfigButton.addEventListener('click', () => {
        bridge.remoteConfig.get()
            .then((config) => {
                remoteConfigContainer.innerText = JSON.stringify(config, undefined, 2)
            })
            .catch((error) => console.log(error))
    })

    clipboardReadButton.addEventListener('click', () => {
        bridge.clipboard.read()
            .then((text) => {
                clipboardInput.value = text
            })
            .catch((error) => console.log(error))
    })

    clipboardWriteButton.addEventListener('click', () => {
        bridge.clipboard.write(clipboardInput.value)
            .then(() => console.log('success'))
            .catch((error) => console.log(error))
    })
}

addDynamicScript()
