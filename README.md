# EAS_Render (FiveM & RedM)
EAS_Render est un script permettant de capturer le rendu graphique natif du jeu et de l'exporter en NUI.

Avec cette librairie, vous pouvez par exemple prendre un screenshot, faire un rec, enregistrer le micro ou encore afficher le rendu en temps réel sur votre écran. Une fonctionnalité pratique pour faire un système d'appareil photo pour un script de téléphone.

En plus de cela, il est totalement compatible avec les scripts ayant comme dépendances screenshot-basic et bien plus optimisé que ce dernier.

> [!NOTE]
> Ce script est basé sur la méthode de capture du rendu de [screenshot-basic](https://github.com/citizenfx/screenshot-basic).

# Installation
Téléchargé eas_render, ensuite vous avez deux options pour installer le script :
1) Placez-le dans votre dossier de ressource et ajoutez-le dans votre server.cfg
2) Prenez les sources et intègre-les dans un core

# Compatibilité
Ce script est compatible avec les scripts ayant besoin de screenshot-basic pour fonctionner. Les fonctions `requestScreenshot` et `requestScreenshotUpload` fonctionnent exactement de la même façon. En plus de cela, les exports sont les mêmes donc vous n'avez pas besoin de modifier votre code.

Les deux exemples ci-dessous fonctionnent :
```lua
exports['screenshot-basic']:requestScreenshot(function(data)
    TriggerEvent('chat:addMessage', { template = '<img src="{0}" style="max-width: 300px;" />', args = { data } })
end)
```

```lua
exports['screenshot-basic']:requestScreenshotUpload('https://wew.wtf/upload.php', 'files[]', function(data)
    local resp = json.decode(data)
    TriggerEvent('chat:addMessage', { template = '<img src="{0}" style="max-width: 300px;" />', args = { resp.files[1].url } })
end)
```


# Utilisation
Pour l'utilisation des features, deux options s'offrent a vous :
1) Travailler directement en JS dans le NUI
2) Utiliser les exports directement depuis le Lua

### Travailler directement en JS dans le NUI
Vous pouvez importer l'objet dans votre NUI avec cette ligne en HTML :
```html
<script type="module" src="nui://eas_render/ui/main.js"></script>
```
Ou directement modifier le `eas_render.html`

### Exports directement depuis le Lua
Pour récupérer l'export vous avez juste à suivre l'exemple ci-dessous :

```lua
local EAS_Render = exports.eas_render:get()
```

Pour prendre un screenshot et récupèrer l'image en URI base64 :

```lua
--- Client
---@param encoding string (Optionnel, Default : 'png')
---@param quality number (Optionnel, Default : 0.92)

-- Sans Callback
local imgURI = EAS_Render.ScreenShot(encoding, quality)

-- Avec Callback
EAS_Render.ScreenShot(function(imgURI)
    print(imgURI)
end, encoding, quality)
```

Pour prendre un screenshot et l'upload sur un lien custom :
```lua
--- Client & Server
---@param player number (NetId)
---@param url string
---@param options table (Optionnel)

-- Exemple d'options (Default Value) :
options = {
    encoding = 'png',
    quality = 0.92,
    field = 'files[]',
    headers = {} -- Request Headers
}

-- Sans Callback
local requestData = EAS_Render.TakeScreenShot(player --[[Server]], url, options)

-- Avec Callback
EAS_Render.TakeScreenShot(player --[[Server]], url, options, function(requestData)
    print(requestData)
end)
```

Pour faire un enregistrement de l'écran + micro et l'upload sur un lien custom :

```lua
--- Client & Server
---@param player number (NetId)
---@param url string
---@param duration number (Durée en seconde)
---@param options table (Optionnel)

-- Exemple d'options (Default Value) :
options = {
    encoding = 'mp4',
    audio = false, -- Record Micro
    delayed = 0, -- Temps en ms d'attente
    field = 'files[]',
    headers = {} -- Request Headers
}

-- Sans Callback
local requestData = EAS_Render.TakeRecordScreen(player --[[Server]], url, duration, options)

-- Avec Callback
EAS_Render.TakeRecordScreen(player --[[Server]], url, duration, options, function(requestData)
    print(requestData)
end)
```
