# User Data

Store and manage player data to enhance gameplay experience and retain progress.

There are two types of storage: `local_storage` and `platform_internal`. When writing to local storage, data is saved on the player's device. When writing to internal storage, data is saved on the platform's servers.

> **Warning**
> If you need to call storage methods in a sequence, make sure you wait for previous call to finish, so there is no potential data collisions.
>
> ```javascript
> await bridge.storage.set('key', 'value', storageType)
> const data = await bridge.storage.get('key', storageType)
>
> // OR
>
> bridge.storage.set('key', 'value' storageType)
>     .then(() => bridge.storage.get('key', storageType))
>     .then((data) => {
>       //
>     })
> ```

> **Warning**
> Consider using arrays parameters to save, retrieve, or delete data for multiple keys.
>
> ```javascript
> const [data1, data2] = await bridge.storage.get(['key1', 'key2'], storageType)
> ```

#### Current Storage Type

Identify the default storage type to understand where data is being saved (local or server).

```javascript
bridge.storage.defaultType
```

Possible values: `local_storage`, `platform_internal`.

#### Support Check

Verify if the specified storage type is supported on the platform to ensure compatibility.

```javascript
bridge.storage.isSupported(storageType)
```

#### Availability Check

Check if the specified storage type is currently available for use to manage data storage effectively.

```javascript
bridge.storage.isAvailable(storageType)
```

#### Load Data

Retrieve stored data based on a key or multiple keys to restore player progress or settings.

```javascript
// Load data by key
bridge.storage.get('key')
    .then(data => {
        // Data loaded and you can work with it
        // data = null if there is no data for the given key
        console.log('Data: ', data)
    })
    .catch(error => {
        // Error, something went wrong
    })

// Load data by multiple keys
bridge.storage.get(['key_1', 'key2'])
    .then(data => {
        // Data loaded and you can work with it
        // data[n] = null if there is no data for the given key
        console.log('Data: ', data)
    })
    .catch(error => {
        // Error, something went wrong
    })
```

#### Save Data

Save data to the specified storage with a key to retain player progress or settings.

```javascript
// Save data by key
bridge.storage.set('key', 'value')
    .then(() => {
        // Data successfully saved
    })
    .catch(error => {
        // Error, something went wrong
    })

// Save data by multiple keys
bridge.storage.set(['key_1', 'key2'], ['value_1', 'value_2'])
    .then(() => {
        // Data successfully saved
    })
    .catch(error => {
        // Error, something went wrong
    })
```

#### Delete Data

Remove data from the specified storage by key to manage player data and settings effectively.

```javascript
// Delete data by key
bridge.storage.delete('key')
    .then(() => {
        // Data successfully deleted
    })
    .catch(error => {
        // Error, something went wrong
    })

// Delete data by multiple keys
bridge.storage.delete(['key_1', 'key2'])
    .then(() => {
        // Data successfully deleted
    })
    .catch(error => {
        // Error, something went wrong
    })
```

All data operations interact with the current platform storage. You can specify the storage type as the second argument. Ensure the storage is available before using it.

```javascript
let storageType = bridge.STORAGE_TYPE.LOCAL_STORAGE
await bridge.storage.get('key', storageType)
await bridge.storage.set('key', 'value', storageType)
await bridge.storage.delete('key', storageType)
```
