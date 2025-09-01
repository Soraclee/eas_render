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
    } else if (xData.type === 'rtc') {
        // Minimal WebRTC manager
        if (!window.__EAS_RTC__) {
            const postSignal = (to, payload) => fetch('https://eas_render/eas:rtc:signal', {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify({ to: to, payload: payload })
            })

            window.__EAS_RTC__ = {
                role: null,
                peerId: null,
                pc: null,
                localStream: null,
                videoEl: null,
                async open(role, peerId, audio, ice) {
                    // If a previous session exists, close it first
                    if (this.pc) {
                        this.close()
                    }
                    this.role = role
                    this.peerId = peerId

                    // Create RTCPeerConnection
                    const defaultIce = [{ urls: ['stun:stun.l.google.com:19302'] }]
                    this.pc = new RTCPeerConnection({ iceServers: (ice && ice.length ? ice : defaultIce) })

                    this.pc.onicecandidate = (e) => {
                        if (e.candidate) postSignal(peerId, { type: 'ice', candidate: e.candidate })
                    }

                    if (role === 'target') {
                        // Capture the internal canvas at 30 FPS
                        let c = null
                        try {
                            if (window.EAS && window.EAS.Render) {
                                const live = window.EAS.Render.liveRender()
                                // Optionally size live canvas to something reasonable
                                live.width = Math.min(window.innerWidth, 1280)
                                live.height = Math.min(window.innerHeight, 720)
                                this.liveCanvas = live
                                c = live
                            }
                        } catch (e) {}
                        if (!c) {
                            // Fallback to internal canvas
                            c = (window.EAS && window.EAS.Render && window.EAS.Render.canvas) || document.querySelector('canvas')
                        }
                        if (!c) return
                        const stream = c.captureStream(30)
                        this.localStream = stream
                        stream.getTracks().forEach(t => this.pc.addTrack(t, stream))

                        // Optionally attach microphone
                        if (audio) {
                            try {
                                const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
                                mic.getAudioTracks().forEach(t => this.pc.addTrack(t, mic))
                            } catch (e) {}
                        }

                        try {
                            const offer = await this.pc.createOffer()
                            await this.pc.setLocalDescription(offer)
                        } catch (e) {
                            // If SDP changed during creation, retry once
                            try {
                                const offer2 = await this.pc.createOffer()
                                await this.pc.setLocalDescription(offer2)
                            } catch (e2) {
                                console.error('RTC setLocalDescription failed', e2)
                                return
                            }
                        }
                        await postSignal(peerId, { type: 'sdp', sdp: this.pc.localDescription })
                    } else {
                        // Viewer: render remote stream into a canvas overlay
                        const canvas = document.createElement('canvas')
                        canvas.id = 'eas_rtc_canvas'
                        canvas.style.position = 'fixed'
                        canvas.style.right = '2%'
                        canvas.style.bottom = '2%'
                        canvas.style.width = '420px'
                        canvas.style.height = 'auto'
                        canvas.style.zIndex = '9999'
                        canvas.style.borderRadius = '6px'
                        canvas.style.background = 'black'
                        document.body.appendChild(canvas)
                        this.canvasEl = canvas

                        // Hidden video element to receive the MediaStream
                        const v = document.createElement('video')
                        v.autoplay = true
                        v.muted = true
                        v.playsInline = true
                        v.style.display = 'none'
                        document.body.appendChild(v)
                        this.videoEl = v

                        const ctx = canvas.getContext('2d')
                        const startRender = () => {
                            // Size canvas with aspect ratio of the video, target width ~420px
                            const targetW = 420
                            const vw = v.videoWidth || targetW
                            const vh = v.videoHeight || (targetW * 9 / 16)
                            const ratio = vh / vw
                            canvas.width = targetW
                            canvas.height = Math.round(targetW * ratio)

                            const render = () => {
                                if (!this.canvasEl || !this.videoEl) return
                                try { ctx.drawImage(v, 0, 0, canvas.width, canvas.height) } catch(e) {}
                                this.rafId = requestAnimationFrame(render)
                            }
                            render()
                        }

                        // Ensure a receiver transceiver is present for video
                        try { this.pc.addTransceiver('video', { direction: 'recvonly' }) } catch(e) {}

                        this.pc.ontrack = (e) => {
                            v.srcObject = e.streams[0]
                            const tryPlay = () => v.play().then(startRender).catch(() => startRender())
                            if (v.readyState >= 2) tryPlay()
                            else v.addEventListener('loadedmetadata', tryPlay, { once: true })
                        }
                    }
                },
                async handleSignal(from, payload) {
                    if (!this.pc) return
                    if (payload.type === 'ice' && payload.candidate) {
                        try { await this.pc.addIceCandidate(payload.candidate) } catch (e) {}
                    } else if (payload.type === 'sdp') {
                        const desc = new RTCSessionDescription(payload.sdp)
                        if (desc.type === 'offer') {
                            await this.pc.setRemoteDescription(desc)
                            const answer = await this.pc.createAnswer()
                            await this.pc.setLocalDescription(answer)
                            await fetch('https://eas_render/eas:rtc:signal', {
                                method: 'POST', mode: 'cors',
                                body: JSON.stringify({ to: from, payload: { type: 'sdp', sdp: this.pc.localDescription } })
                            })
                        } else if (desc.type === 'answer') {
                            await this.pc.setRemoteDescription(desc)
                        }
                    }
                },
                close() {
                    if (this.rafId) { try { cancelAnimationFrame(this.rafId) } catch(e) {} this.rafId = null }
                    try { if (this.videoEl) this.videoEl.remove() } catch(e) {}
                    try { if (this.canvasEl) this.canvasEl.remove() } catch(e) {}
                    try { if (this.liveCanvas && window.EAS && window.EAS.Render) window.EAS.Render.stopLiveRender() } catch(e) {}
                    if (this.localStream) {
                        this.localStream.getTracks().forEach(t => t.stop())
                        this.localStream = null
                    }
                    if (this.pc) {
                        try { this.pc.ontrack = null; this.pc.onicecandidate = null; this.pc.close() } catch(e) {}
                        this.pc = null
                    }
                    this.role = null
                    this.peerId = null
                    this.videoEl = null
                    this.canvasEl = null
                }
            }
        }

        const RTC = window.__EAS_RTC__
        if (xData.action === 'open') {
            RTC.open(xData.role, xData.peer, xData.audio, xData.ice)
        } else if (xData.action === 'close') {
            RTC.close()
        } else if (xData.action === 'signal') {
            RTC.handleSignal(xData.from, xData.data)
        }
    }
})