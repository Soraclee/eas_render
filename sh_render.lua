/*
*    ______           _____    _____                _           
*   |  ____|   /\    / ____|  |  __ \              | |          
*   | |__     /  \  | (___    | |__) |___ _ __   __| | ___ _ __ 
*   |  __|   / /\ \  \___ \   |  _  // _ \ '_ \ / _` |/ _ \ '__|
*   | |____ / ____ \ ____) |  | | \ \  __/ | | | (_| |  __/ |   
*   |______/_/    \_\_____/   |_|  \_\___|_| |_|\__,_|\___|_|
*
*   Version : 1.0
*   Discord : discord.gg/Mk2nksuKGr 
*   Github : https://github.com/easyx-fr/eas_render
*    
*   Developed by EasYx_ <https://linktree.easyx.fr>
*
*/

-- Variables
local EAS = {}
local Request = {id = 0}
local isServer = IsDuplicityVersion()
local isClient = not isServer


-- Events
if not isServer then
    RegisterNuiCallback('eas:callbackRender', function(data, cb)
        cb(true)

        local id = data.id
        local xRequest = Request[id]

        print(id)

        if xRequest then 
            if xRequest.cb then
                xRequest.cb(data.data)
            else
                xRequest.data = data.data
            end

            Citizen.Wait(1000)

            Request[id] = nil
        end
    end)

    RegisterNetEvent('eas:render:client', function(requestId, action, options)
        TriggerServerEvent('eas:render:server', requestId, EAS[action](table.unpack(options)))
    end)
else
    RegisterServerEvent('eas:render:server', function(requestId, data)
        local xRequest = Request[requestId]

        if xRequest then
            if xRequest.cb then
                xRequest.cb(data)
            else
                xRequest.data = data
            end

            Citizen.Wait(1000)

            Request[requestId] = nil
        end
    end)
end


-- Local Functions
local function sendNUI(id, name, data)
    if not data then data = {} end
    data.id = id
    data.type = name

    SendNUIMessage(data)
end

local function sendTrigger(name, pl, id, options)
    TriggerClientEvent('eas:render:client', pl, id, name, options)
end

local function addRequest(cb)
    local id = Request.id + 1
    Request.id = id
    id = tostring(id)

    Request[id] = {cb = cb}
    
    return id, Request[id]
end

local function waitRequest(req, cb)
    if not cb or (type(cb) == 'table' and not cb['__cfx_functionReference']) then
        while not req.data do
            Citizen.Wait(25)
        end

        return req.data
    else
        req.cb = cb
    end
end

-- Global Functions
if not isServer then
    function EAS.ScreenShot(cb, encoding, quality)
        local rId, req = addRequest()

        sendNUI(rId, 'screenshot', {
            encoding = encoding,
            quality = quality
        })

        return waitRequest(req, cb)
    end
end

function EAS.TakeScreenShot(pl, url, options, cb)
    if isClient then
        cb = options
        options = url
        url = pl
    end

    if type(url) ~= 'string' then
        return print('^1[ERROR] Url invalide pour TakeScreenShot !')
    end

    if not options then
        options = {url = url}
    else
        options.url = url
    end

    local rId, req = addRequest()

    if isServer then
        sendTrigger('TakeScreenShot', pl, rId, {url, options})
    else
        sendNUI(rId, 'screenshot', {
            options = options
        })
    end

    return waitRequest(req, cb)
end

function EAS.TakeRecordScreen(pl, url, duration, options, cb)
    if isClient then
        cb = options
        options = duration
        duration = url
        url = pl
    end

    if not url then
        return print('^1[ERROR] Url invalide pour TakeRecordScreen !')
    end

    local rId, req = addRequest()

    if isServer then
        sendTrigger('TakeRecordScreen', pl, rId, {url, duration, options})
    else
        sendNUI(rId, 'record', {
            screen = true,
            url = url,
            duration = duration,
            options = options
        })
    end

    return waitRequest(req, cb)
end

function EAS.TakeRecordMicro(pl, url, duration, options, cb)
    if isClient then
        cb = options
        options = duration
        duration = url
        url = pl
    end

    if not url then
        return print('^1[ERROR] Url invalide pour TakeRecordMicro !')
    end

    local rId, req = addRequest()

    if isServer then
        sendTrigger('TakeRecordMicro', pl, rId, {url, duration, options})
    else
        sendNUI(rId, 'record', {
            url = url,
            duration = duration,
            options = options
        })
    end

    return waitRequest(req, cb)
end

-- Export EAS Variable
exports('get', function() return EAS end)


--[[
    ############################################
        Compatibilité avec Screenshot-basic
    ############################################
]]

if not isServer then
    function requestScreenshot(options, cb)
        local encoding, quality

        if type(options) == 'table' and not options['__cfx_functionReference'] then
            encoding, quality = options.encoding, options.quality
        else
            cb = options
        end

        return EAS.ScreenShot(cb, encoding, quality)
    end

    function requestScreenshotUpload(url, field, options, cb)
        if type(options) == 'table' and not options['__cfx_functionReference'] then
            options.field = field
        else
            cb = options
            options = {field = field}
        end

        return EAS.TakeScreenShot(url, options, cb)
    end

    AddEventHandler('__cfx_export_screenshot-basic_requestScreenshot', function(cb)
        cb(requestScreenshot)
    end)

    AddEventHandler('__cfx_export_screenshot-basic_requestScreenshotUpload', function(cb)
        cb(requestScreenshotUpload)
    end)
end