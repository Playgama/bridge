# In-Game Purchases

Enable players to purchase items, upgrades, or currency within your game to enhance their experience and generate revenue.

There are two types of purchases — permanent (e.g., ad removal) and consumable (e.g., in-game coins).

#### Support

Check if in-game purchases are supported to offer items or upgrades within the game.

```javascript
bridge.payments.isSupported
```

#### Setup

Setup in-game purchases in the [config file](setup.md#config). For each product add an `id` and fill in the information for the required platforms, example for one product:

```json
{
    ...    
    "payments": [
        {
            "id": "test_product",
            "playgama": {
                "amount": 1 // int price in Gam
            },
            "playdeck": {
                "amount": 1, // int price in Telegram Stars
                "description": "TEST PRODUCT"
            }
        }
    ]
}
```

#### Purchase

Allow players to buy items or upgrades in your game to enhance their gameplay experience.

```javascript
bridge.payments.purchase("test_product") // id you specified in the config file
    .then((purchase) => {
        // success
        console.log('Purchase completed, id:', purchase.id)
    })
    .catch(error => {
        // error
    })
```

Each platform provides its own set of properties for a purchase, so make sure to check the official documentation of the specific platform you are targeting.

Use `purchase` data to verify the purchase. Currently, the Playgama API verification only supports `playgama`, `msn` and `microsoft_store` platforms.

```bash
curl -X POST "https://playgama.com/api/bridge/v1/verify" \
  -H "Content-Type: application/json" \
  -d '{"platform":"<PLATFORM_ID>","type":"purchase","data":{ <...purchase> }}'

#  Response:
#  {
#    success: boolean;
#    errorMessage?: string;

#    -- purchase --
#    orderId?: string;
#    productId?: string;
#    externalId?: string;
#  }
```

#### Consume Purchase

Consume purchased items, such as in-game currency, once they are used, to manage inventory and player progression.

```javascript
bridge.payments.consumePurchase("test_product") // id you specified in the config file
    .then((purchase) => {
        // success
        console.log('Consume completed, id:', purchase.id)
    })
    .catch(error => {
        // error
    })
```

#### Catalog of All Items

Retrieve a list of all available in-game items that players can purchase to display in the game store.

```javascript
bridge.payments.getCatalog()
    .then(catalogItems => {
        // success
        catalogItems.forEach(catalogItem => {
            console.log('ID: ' + catalogItem.id)
            console.log('Price: ' + catalogItem.price)
            console.log('Price Currency Code: ' + catalogItem.priceCurrencyCode)
            console.log('Price Value: ' + catalogItem.priceValue)
        })
    })
    .catch(error => {
        // error
    })
```

#### List of Purchased Items

Retrieve a list of items that the player has purchased to manage their inventory and provide access to purchased content.

> **Warning**
> If the user loses internet connection when making an in-game purchase, the purchase might remain unprocessed. To avoid this, check for unprocessed purchases using this method (e.g., each time the game is launched).

```javascript
bridge.payments.getPurchases()
    .then(purchases => {
        // success
        purchases.forEach(purchase => {
            console.log('ID: ' + purchase.id)
        })
    })
    .catch(error => {
        // error
    })
```
