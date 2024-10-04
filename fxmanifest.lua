fx_version 'cerulean'
game 'common'

version '1.0'
author 'EasYx_'
description 'EAS Render est un script qui capture le rendu natif vers les NUI de FiveM & RedM.'
discord 'https://discord.gg/Y29sw2UsvB'

shared_script 'sh_render.lua'

files {
    'ui/libs/three.eas.js',
    'ui/eas_render.html',
    'ui/messages.js',
    'ui/main.js'
}

ui_page 'ui/eas_render.html'