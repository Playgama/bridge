# Social Interactions

Enable social features to enhance player engagement by allowing them to share, join communities, invite friends, and more.

#### Share

Use this to allow players to share game content or achievements on social media platforms.

```javascript
bridge.social.isShareSupported
```

Check if the share functionality is supported on the platform.

```javascript
let options = { }

switch (bridge.platform.id) {
    case 'vk':
        options = {
            link: 'YOUR_LINK'
        }
        break
    case 'facebook':
        options = {
            image: 'A base64 encoded image to be shared', 
            text: 'A text message to be shared.',
        }
    case 'msn':
        options = {
            title: 'A title to display',
            image: 'A base64 encoded image or image URL to be shared', 
            text: 'A text message to be shared.',
        }
        break
}

bridge.social.share(options)
    .then(() => {
        // success
    })
    .catch(error => {
        // error
    })
```

#### Join Community

Enable players to join social communities related to your game, enhancing engagement and loyalty.

```javascript
bridge.social.isJoinCommunitySupported
```

Check if the join community functionality is supported on the platform.

```javascript
let options = { }

switch (bridge.platform.id) {
    case 'vk':
        options = {
            groupId: YOUR_GROUP_ID
        }
        break
    case 'ok':
        options = {
            groupId: YOUR_GROUP_ID
        }
        break
    case 'facebook':
        options = {
            isPage: true // if isPage = true, invite to page, else invite to group
        }
        break
}

bridge.social.joinCommunity(options)
    .then(() => {
        // success
    })
    .catch(error => {
        // error
    })
```

#### Invite Friends

Allow players to invite their friends to play the game, helping to grow your player base organically.

```javascript
bridge.social.isInviteFriendsSupported
```

Check if the invite friends functionality is supported on the platform.

```javascript
let options = { }

switch (bridge.platform.id) {
    case 'ok':
        options = {
            text: 'Hello World!'
        }
        break
    case 'facebook':
        options = {
            image: 'A base64 encoded image to be shared',  
            text: 'A text message',
        }
        break
}

bridge.social.inviteFriends(options)
    .then(() => {
        // success
    })
    .catch(error => {
        // error
    })
```

#### Create Post

Use this to let players create posts about their achievements or updates directly from the game.

```javascript
bridge.social.isCreatePostSupported
```

Check if the create post functionality is supported on the platform.

```javascript
let options = { }

switch (bridge.platform.id) {
    case 'ok':
        options = {
            media: [
                {
                    'type': 'text',
                    'text': 'Hello World!'
                },
                {
                    'type': 'link',
                    'url': 'https://apiok.ru'
                },
                {
                    'type': 'poll',
                    'question': 'Do you like our API?',
                    'answers': [
                        { 'text': 'Yes' },
                        { 'text': 'No' }
                    ],
                    'options': 'SingleChoice,AnonymousVoting'
                }
            ]
        }
        break
}

bridge.social.createPost(options)
    .then(() => {
        // success
    })
    .catch(error => {
        // error
    })
```

#### Add to Favorites

Allow players to bookmark your game for easy access in the future.

```javascript
bridge.social.isAddToFavoritesSupported
```

Check if the add to favorites functionality is supported on the platform.

```javascript
bridge.social.addToFavorites()
    .then(() => {
        // success
    })
    .catch(error => {
        // error
    })
```

#### Add to Home Screen

Enable players to add a shortcut to your game on their home screen for quick access.

```javascript
bridge.social.isAddToHomeScreenSupported
```

Check if the add to home screen functionality is supported on the platform.

```javascript
bridge.social.addToHomeScreen()
    .then(() => {
        // success
    })
    .catch(error => {
        // error
    })
```

#### Rate Game

Encourage players to rate your game, providing valuable feedback and improving visibility.

```javascript
bridge.social.isRateSupported
```

Check if the rate game functionality is supported on the platform.

```javascript
bridge.social.rate()
    .then(() => {
        // success
    })
    .catch(error => {
        // error
    })
```

#### External Links

Allow players to follow links to external websites, such as your game's official site or related resources.

```javascript
bridge.social.isExternalLinksAllowed
```

Check if external links are allowed on the platform.
