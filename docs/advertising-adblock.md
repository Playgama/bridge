# AdBlock

Check if the ad blocker is enabled.

```javascript
bridge.advertisement.checkAdBlock()
    .then(result => {
        console.log(result) // true or false
    })
    .catch(error => {
        console.log(error)
    })
```
