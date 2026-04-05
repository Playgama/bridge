# Achievements

**Support**

Use this to determine if you can implement achievements for your game on the current platform.

```
bridge.achievements.isSupported
```

Check if getting list of achievements is supported.

```
bridge.achievements.isGetListSupported
```

Check if built-in popup is supported.

```
bridge.payments.isNativePopupSupported
```

**Unlock achievement**

Unlocks achievement for a player.

```javascript
let options = { }

switch (bridge.platform.id) {
    case 'y8':
        options = {
            achievement: 'ACHIEVEMENT_NAME',
            achievementkey: 'ACHIEVEMENT_KEY'
        }
        break
    case 'lagged':
        options = {
            achievement: 'ACHIEVEMENT_ID'
        }
        break
}

bridge.achievements.unlock(options)
    .then((result) => {
        // success
    })
    .catch(error => {
        // error
    })
```

**Get List**

Returns the achievement list in JSON

```javascript
let options = { }

bridge.achievements.getList(options)
    .then(list => {
        // success
        switch (bridge.platform.id) {
            case 'y8':
                list.forEach(list => {
                    console.log('achievementid: ' + list.achievementid)
                    console.log('achievement: ' + list.achievement)
                    console.log('description: ' + list.description)
                    console.log('achievementkey: ' + list.achievementkey)
                    console.log('icon: ' + list.icon)
                    console.log('playerid: ' + list.playerid)
                    console.log('playername: ' + list.playername)
                })
                break
        }
    })
    .catch(error => {
        // error
    })
```

**Show Native Popup**

Some platforms support built-in achievement list which is shown in overlay

```javascript
let options = { }

bridge.achievements.showNativePopup(options)
    .then(() => {
        // success
    })
    .catch(error => {
        // error
    })
```
