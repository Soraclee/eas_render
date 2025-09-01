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


--[[
    ############################################
        Lightweight streaming between players
    ############################################
]]

-- Server-side state for streaming subscriptions
local Stream = {
    targetToViewers = {},   -- [targetServerId] = { [viewerServerId] = true, ... }
    viewerToTarget = {},    -- [viewerServerId] = targetServerId
    activeTargets = {}      -- [targetServerId] = true when client should be capturing
}

if isServer then
    --- Subscribe a viewer to a target's stream
    RegisterNetEvent('eas:stream:subscribe', function(targetId)
        local viewerId = source

        targetId = tonumber(targetId)
        if not targetId then return end

        if not Stream.targetToViewers[targetId] then
            Stream.targetToViewers[targetId] = {}
        end

        -- If viewer was already subscribed to someone else, unsubscribe first
        local oldTarget = Stream.viewerToTarget[viewerId]
        if oldTarget and Stream.targetToViewers[oldTarget] then
            Stream.targetToViewers[oldTarget][viewerId] = nil
            if next(Stream.targetToViewers[oldTarget]) == nil then
                Stream.targetToViewers[oldTarget] = nil
                Stream.activeTargets[oldTarget] = nil
                TriggerClientEvent('eas:stream:enable', oldTarget, false)
            end
        end

        Stream.viewerToTarget[viewerId] = targetId
        Stream.targetToViewers[targetId][viewerId] = true

        -- Notify viewer to open UI
        TriggerClientEvent('eas:stream:viewer:open', viewerId, targetId)

        -- Ask target to start capturing if not already
        if not Stream.activeTargets[targetId] then
            Stream.activeTargets[targetId] = true
            TriggerClientEvent('eas:stream:enable', targetId, true)
        end
    end)

    --- Unsubscribe the calling viewer from any target
    RegisterNetEvent('eas:stream:unsubscribe', function()
        local viewerId = source
        local targetId = Stream.viewerToTarget[viewerId]
        if not targetId then
            TriggerClientEvent('eas:stream:viewer:close', viewerId)
            return
        end

        -- Remove viewer from target list
        if Stream.targetToViewers[targetId] then
            Stream.targetToViewers[targetId][viewerId] = nil
            if next(Stream.targetToViewers[targetId]) == nil then
                Stream.targetToViewers[targetId] = nil
                Stream.activeTargets[targetId] = nil
                TriggerClientEvent('eas:stream:enable', targetId, false)
            end
        end

        Stream.viewerToTarget[viewerId] = nil

        -- Notify viewer to close UI
        TriggerClientEvent('eas:stream:viewer:close', viewerId)
    end)

    --- Receive a frame from target and relay to all subscribed viewers
    RegisterNetEvent('eas:stream:frame', function(frameData)
        local targetId = source
        local viewers = Stream.targetToViewers[targetId]
        if not viewers then return end

        for viewerId, _ in pairs(viewers) do
            TriggerClientEvent('eas:stream:frame', viewerId, targetId, frameData)
        end
    end)

    --- Cleanup on disconnect
    AddEventHandler('playerDropped', function()
        local playerId = source

        -- If a viewer disconnects
        local targetId = Stream.viewerToTarget[playerId]
        if targetId then
            Stream.viewerToTarget[playerId] = nil
            if Stream.targetToViewers[targetId] then
                Stream.targetToViewers[targetId][playerId] = nil
                if next(Stream.targetToViewers[targetId]) == nil then
                    Stream.targetToViewers[targetId] = nil
                    Stream.activeTargets[targetId] = nil
                    TriggerClientEvent('eas:stream:enable', targetId, false)
                end
            end
        end

        -- If a target disconnects
        if Stream.targetToViewers[playerId] then
            for vId, _ in pairs(Stream.targetToViewers[playerId]) do
                Stream.viewerToTarget[vId] = nil
                TriggerClientEvent('eas:stream:viewer:close', vId)
            end
            Stream.targetToViewers[playerId] = nil
            Stream.activeTargets[playerId] = nil
        end
    end)
else
    -- Client-side: capture loop + viewer UI hooks
    local streamEnabled = false
    local streamLoopRunning = false

    local function streamLoop()
        if streamLoopRunning then return end
        streamLoopRunning = true

        Citizen.CreateThread(function()
            while streamEnabled do
                -- Lower quality for bandwidth; jpeg is widely supported
                local ok, result = pcall(function() return EAS.ScreenShot('jpeg', 0.5) end)
                if ok and result then
                    TriggerServerEvent('eas:stream:frame', result)
                end
                Citizen.Wait(150) -- ~6-7 fps; adjust as needed
            end
            streamLoopRunning = false
        end)
    end

    RegisterNetEvent('eas:stream:enable', function(enable)
        streamEnabled = enable and true or false
        if streamEnabled then
            streamLoop()
        end
    end)

    -- Simple helper commands for testing
    RegisterCommand('stream', function(_, args)
        local target = tonumber(args[1])
        if target then
            TriggerServerEvent('eas:stream:subscribe', target)
        else
            print('Usage: /stream [serverId]')
        end
    end, false)

    RegisterCommand('unstream', function()
        TriggerServerEvent('eas:stream:unsubscribe')
    end, false)

    -- Relay frames to NUI for the viewer
    RegisterNetEvent('eas:stream:viewer:open', function(targetId)
        SendNUIMessage({ type = 'stream', action = 'open', target = tostring(targetId) })
    end)

    RegisterNetEvent('eas:stream:viewer:close', function()
        SendNUIMessage({ type = 'stream', action = 'close' })
    end)

    RegisterNetEvent('eas:stream:frame', function(targetId, dataUri)
        SendNUIMessage({ type = 'stream', action = 'frame', data = dataUri, target = tostring(targetId) })
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