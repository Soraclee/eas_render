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
    }
})