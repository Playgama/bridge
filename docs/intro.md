# Intro

We strive to make our SDK as simple as possible to integrate and use while providing all the tools to make your game engaging and immersive. The integration guide is a comprehensive manual covering all options and player interactions on all supported platforms we work with.

While our full guide covers all features, most games use only the essentials. Below you'll find the required steps and an API reference for quick setup.

> In addition to the documentation, you can rely on our dedicated [GPT assistant](https://chatgpt.com/g/g-6821692dd4408191a7c55e414526b8ee-playgama-bridge) to guide your integration and answer any questions about the Playgama Bridge SDK.

#### Required Steps:

1. [Install and initialize SDK.](setup.md)
2. [Identify the current language and display the required text labels.](platform-parameters.md#language)
3. [Save and retrieve user progress using our storage methods.](user-data.md)
4. [Send Game Ready message.](platform-parameters.md#sending-a-message-to-the-platform)
5. [Display interstitial ads.](advertising-interstitial.md#show-interstitial)

#### API Reference:

1. [Setup](setup.md): Set up the SDK and connect your game.
2. [Platform Parameters](platform-parameters.md): Use platform parameters to manage your game, send messages, check language, and more.
3. [User Data](user-data.md): Handle player data, progress, and preferences.
4. [Advertising](advertising.md): Integrate and control ad placements using this API. It supports multiple ad formats: interstitials, rewards and banners
5. [User Parameters](user-parameters.md): If you need to authorize user, check device type, or retrieve user data, checkout out the User Parameters block.
6. [Social Interactions](social-interactions.md): If you support social interactions, such as inviting friends, "share" buttons on social networks, adding the game to browser favorites, etc., implement calls from the Social Interactions block.
7. [Leaderboards](leaderboards.md): If you have player rankings in your game, be sure to implement calls from the Leaderboards block. Also, remember to support saving user data from the User Data block.
8. [Achievements](achievements.md): If you plan to add achievements or milestones to your game, consider implementing calls from Achievement block.
9. [In-Game Purchases](in-game-purchases.md): If you have in-app purchases, be sure to implement calls from the In-Game Purchases block.
10. [Remote Configuration](remote-configuration.md): If you want to manage your game settings remotely without releasing updates, check out the Remote Configuration block.
