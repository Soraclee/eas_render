function sendCallbackNUI(id, data) {
    fetch('https://eas_render/eas:callbackRender', {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify({
            id : id,
            data : data
        })
    })
}

window.addEventListener('message', event => {
    const xData = event.data
    const rId = xData.id

    if (xData.type === 'screenshot') {
        if (xData.options) {
            EAS.Render.takeScreenshot(xData.options, res => sendCallbackNUI(rId, res))
        } else {
            sendCallbackNUI(rId, EAS.Render.screenshot(xData.encoding, xData.quality))
        }
    } else if (xData.type === 'record') {
        if (!xData.options) xData.options = {}

        xData.options.url = xData.url
        xData.options.duration = xData.duration

        if (xData.screen) {
            EAS.Render.takeRecordScreen(xData.options, res => sendCallbackNUI(rId, res))
        } else EAS.Render.takeRecordMic(xData.options, res => sendCallbackNUI(rId, res))
    } else if (xData.type === 'stream') {
        // Lightweight viewer overlay for incoming frames
        if (!window.__EAS_STREAM__) {
            window.__EAS_STREAM__ = {
                container: null,
                img: null,
                open(target) {
                    if (this.container) return
                    const cont = document.createElement('div')
                    cont.id = 'eas_stream_viewer'
                    cont.style.position = 'fixed'
                    cont.style.right = '2%'
                    cont.style.bottom = '2%'
                    cont.style.zIndex = '9999'
                    cont.style.padding = '6px'
                    cont.style.background = 'rgba(0,0,0,0.6)'
                    cont.style.borderRadius = '6px'
                    cont.style.backdropFilter = 'blur(2px)'
                    const img = document.createElement('img')
                    img.style.display = 'block'
                    img.style.width = '360px'
                    img.style.height = 'auto'
                    img.style.objectFit = 'contain'
                    img.alt = 'EAS Stream ' + (target || '')
                    cont.appendChild(img)
                    document.body.appendChild(cont)
                    this.container = cont
                    this.img = img
                },
                close() {
                    if (this.container) {
                        this.container.remove()
                        this.container = null
                        this.img = null
                    }
                },
                frame(data) {
                    if (!this.container) this.open()
                    if (this.img) this.img.src = data
                }
            }
        }

        const StreamUI = window.__EAS_STREAM__
        if (xData.action === 'open') {
            StreamUI.open(xData.target)
        } else if (xData.action === 'close') {
            StreamUI.close()
        } else if (xData.action === 'frame') {
            StreamUI.frame(xData.data)
        }
    }
})