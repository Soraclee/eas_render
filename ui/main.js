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

import {
    OrthographicCamera,
    Scene,
    WebGLRenderTarget,
    LinearFilter,
    NearestFilter,
    RGBAFormat,
    UnsignedByteType,
    CfxTexture,
    ShaderMaterial,
    PlaneBufferGeometry,
    Mesh,
    WebGLRenderer
} from './libs/three.eas.js'


class EAS_Render {

    constructor() {

        window.addEventListener('resize', this.resize)

        const gameTexture = new CfxTexture()
        gameTexture.needsUpdate = true

        const material = new ShaderMaterial({

            uniforms: {"tDiffuse": { value: gameTexture }},
            vertexShader: `
			varying vec2 vUv;

			void main() {
				vUv = vec2(uv.x, 1.0-uv.y);
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
`,
            fragmentShader: `
			varying vec2 vUv;
			uniform sampler2D tDiffuse;

			void main() {
				gl_FragColor = texture2D(tDiffuse, vUv);
			}
`
        })

        const renderer = new WebGLRenderer()
        renderer.autoClear = false

        const cameraRTT = new OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, -10000, 10000)

        cameraRTT.position.z = 100
        
        this.cameraRTT = cameraRTT
        this.material = material
        this.renderer = renderer
        this.gameTexture = gameTexture

        this.resize()

        const canvas = document.createElement("canvas")

        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        this.canvas = canvas
        this.animateNative = this.animateNative.bind(this)
        this.animateNative()
    }

    dataURItoBlob(dataURI) {
        const byteString = atob(dataURI.split(',')[1])
        const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
    
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
      
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i)
        }
    
        return new Blob([ab], {type: mimeString})
    }

    /**
     * @param {float} x En pixel
     * @param {float} z En pixel
     * @param {float} width En pixel
     * @param {float} height En pixel
     * @returns {undefined}
     */
    cameraOffset(x, z, width, height) {
        this.cameraRTT.setViewOffset(window.innerWidth, window.innerHeight, x, z, width, height)
    }

    resize(dimension) {
        if (dimension) {
            this.cameraOffset(window.innerWidth / 2, -100.0, 1920, window.innerHeight)
        } else this.cameraRTT.clearViewOffset()

        const sceneRTT = new Scene()
        const plane = new PlaneBufferGeometry(window.innerWidth, window.innerHeight)

        const quad = new Mesh(plane, this.material)
        quad.position.z = -100
        sceneRTT.add(quad)

        const rtTexture = new WebGLRenderTarget(window.innerWidth, window.innerHeight, { minFilter: LinearFilter, magFilter: NearestFilter, format: RGBAFormat, type: UnsignedByteType })

        this.sceneRTT = sceneRTT
        this.rtTexture = rtTexture

        this.renderer.setPixelRatio(window.devicePixelRatio)
        this.renderer.setSize(window.innerWidth, window.innerHeight)
    }

    /**
     * @param {element} canvas Si null, prend l'élement canvas par défault
     * @returns {undefined}
     */
    animateNative(canvas) {
        if (this.isAnimated) {
            requestAnimationFrame(() => this.animateNative(canvas))
        }

        this.renderer.clear()
        this.renderer.render(this.sceneRTT, this.cameraRTT, this.rtTexture, true)

        const read = new Uint8Array(window.innerWidth * window.innerHeight * 4)
        this.renderer.readRenderTargetPixels(this.rtTexture, 0, 0, window.innerWidth, window.innerHeight, read)

        if (!canvas) canvas = this.canvas

        const cxt = canvas.getContext('2d')
        const imageData = new ImageData(new Uint8ClampedArray(read.buffer), window.innerWidth, window.innerHeight)

        cxt.putImageData(imageData, 0, 0)
    }

    /**
     * Savoir si le type et l'encodage sont valide ou non. Si seul le type est valide alors il retourne l'encodage par défaut
     * 
     * @param {string} type
     * @param {string} encoding
     * @returns {string} Nom de l'encodage ou celui par défaut pour le type
     */
    isValidEncoding(type, encoding) {
        const encList = {
            'image' : [
                'png',
                'jpeg',
                'webp'
            ],

            'video' : [
                'mp4'
            ],
            
            'audio' : [
                'mp3'
            ]
        }

        if (encoding) {
            for (let i = 0; i < encList[type].length; i++) {
                const encodeName = encList[type][i]

                if (encodeName === encoding.toLowerCase()) {
                    return encodeName
                }
            }
        } else return encList[type][0]
          
    }

    /**
     * Prend un screenshot et retourne l'URI sous l'encodage choisi
     * 
     * @param {string} encoding
     * @param {float} quality
     * @returns {string} URI de l'image
     */
    screenshot(encoding, quality) {
        const type = 'image'

        encoding = this.isValidEncoding(type, encoding)
        quality = quality || 0.92

        this.animateNative()

        return this.canvas.toDataURL(type + '/' + encoding, quality)
    }

    /**
     * Prend un screenshot, converti l'URI en Blob et upload le fichier à l'URL renseigné
     * 
     * @param {object} xData Paramètre du screenshot et de l'upload
     * @param {function} cb Callback executé à la fin de l'upload
     * @returns {undefined}
     */
    takeScreenshot(xData, cb) {
        const encoding = this.isValidEncoding('image', xData.encoding)
        const screenshot = this.screenshot(encoding, xData.quality)

        this.uploadFile({
            field : xData.field,
            blob : this.dataURItoBlob(screenshot),
            fileName : 'screenshot.' + encoding,
            url : xData.url,
            method : xData.method,
            headers : xData.headers
        }, cb)
    }

    createMediaRecorder(stream, chunks, delayed) {
        this.mediaRecorder = new MediaRecorder(stream)

        this.mediaRecorder.ondataavailable = function(e) {
            chunks.push(e.data)
        }

        this.mediaRecorder.start(delayed || 1)
    }

    /**
     * Démarre l'enregistrement de l'écran avec ou sans le son du micro
     * 
     * @param {object} xData Paramètre de l'enregistrement
     * @param {function} cb Callback executé à la fin de l'enregistrement
     * @returns {undefined}
     */
    async startRecordScreen(xData, cb) {
        if (this.mediaRecorder) return

        this.isAnimated = true
        this.animateNative()

        const videoStream = this.canvas.captureStream()
        const newStream = new MediaStream()
        const chunks = []

        if (xData.audio) {
            await navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                stream.getAudioTracks().forEach(function(track) {
                    newStream.addTrack(track)
                })
            })
        }
        
        videoStream.getVideoTracks().forEach(function(track) {
            newStream.addTrack(track)
        })

        this.createMediaRecorder(newStream, chunks, xData.delayed)

        this.onStopRecord = function(e) {
            const encoding = this.isValidEncoding('video', xData.encoding)
            const blob = new Blob(chunks, { 'type' : 'video/' + encoding })

            this.isAnimated = false
            this.mediaRecorder.stop()
            delete this.mediaRecorder

            if (cb) cb(blob)
        }
    }

    /**
     * Stop l'enregistrement si il y en a un en cours (Vidéo & Audio)
     * 
     * @returns {undefined}
     */
    stopRecord() {
        if (this.mediaRecorder) this.onStopRecord()
    }

    /**
     * Lance un enregistrement de l'écran pour X secondes, converti en fichier vidéo et l'upload
     * 
     * @param {object} xData Paramètre de l'enregistrement et de l'upload
     * @param {function} cb Callback executé à la fin de l'upload
     * @returns {undefined}
     */
    takeRecordScreen(xData, cb) {
        if (!xData.duration) return console.error('takeRecordScreen -> duration invalid !')

        const encoding = this.isValidEncoding('video', xData.encoding)

        this.startRecordScreen({
            encoding : encoding,
            audio : xData.audio,
            delayed : xData.delayed
        }, blob => {
            this.uploadFile({
                field : xData.field,
                blob : blob,
                fileName : 'record.' + encoding,
                url : xData.url,
                method : xData.method,
                headers : xData.headers
            }, cb)
        })

        setTimeout(() => this.stopRecord(), (xData.duration + 1) * 1000)
    }

    /**
     * Démarre l'enregistrement du micro
     * 
     * @param {object} xData Paramètre de l'enregistrement
     * @param {function} cb Callback executé à la fin de l'enregistrement
     * @returns {undefined}
     */
    async startRecordMic(xData, cb) {
        if (this.mediaRecorder) return

        const newStream = new MediaStream()
        const chunks = []

        await navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            stream.getAudioTracks().forEach(function(track) {
                newStream.addTrack(track)
            })
        })

        this.createMediaRecorder(newStream, chunks, xData.delayed)

        this.onStopRecord = function(e) {
            const encoding = this.isValidEncoding('audio', xData.encoding)
            const blob = new Blob(chunks, { 'type' : 'audio/' + encoding })

            this.mediaRecorder.stop()
            delete this.mediaRecorder

            if (cb) cb(blob)
        }
    }

    /**
     * Lance un enregistrement du micro pour X secondes, converti en fichier audio et l'upload
     * 
     * @param {object} xData Paramètre de l'enregistrement et de l'upload
     * @param {function} cb Callback executé à la fin de l'upload
     * @returns {undefined}
     */
    takeRecordMic(xData, cb) {
        if (!xData.duration) return console.error('takeRecordMic -> duration invalid !')

            const encoding = this.isValidEncoding('audio', xData.encoding)
    
            this.startRecordMic({
                encoding : encoding,
                delayed : xData.delayed
            }, blob => {
                this.uploadFile({
                    field : xData.field,
                    blob : blob,
                    fileName : 'record.' + encoding,
                    url : xData.url,
                    method : xData.method,
                    headers : xData.headers
                }, cb)
            })
    
            setTimeout(() => this.stopRecord(), (xData.duration + 1) * 1000)
    }

    /**
     * Permet d'envoyer une requête HTTP customisé pour upload un fichier à partir d'un Blob
     * 
     * @param {object} xRequest Paramètre de la requête (Field, Blob, File Name, Method...)
     * @param {function} cb Callback executé au retour de la requête avec comme argument la réponse
     * @returns {undefined}
     */
    uploadFile(xRequest, cb) {
        const formData = new FormData()
        formData.append(xRequest.field || 'files[]', xRequest.blob, xRequest.fileName)

        fetch(xRequest.url, {
            method: xRequest.method || 'POST',
            mode: xRequest.mode || 'cors',
            headers: xRequest.headers,
            body: formData
        })
        .then(response => response.text())
        .then(text => {
            if (cb) cb(text)
        })
    }

    /**
     * Démarre le rendu en live de l'écran dans un canvas temporaire et retourne le canvas
     * 
     * @returns {element}
     */
    liveRender() {
        const canvas = document.createElement("canvas")

        canvas.style.display = 'block'
        canvas.id = 'liveRender'

        document.body.appendChild(canvas)

        this.live = canvas
        this.resize(true)
        this.isAnimated = true
        this.animateNative(canvas)

        return canvas
    }

    /**
     * Stop le rendu live et supprime le canvas temporaire
     * 
     * @returns {undefined}
     */
    stopLiveRender() {
        this.live.remove()
        this.isAnimated = false
    }
}


/**
 * Créé l'objet EAS_Render et le stock dans EAS.Render
 */
setTimeout(() => {
    if (!window.EAS) {
        window.EAS = {
            Render : new EAS_Render()
        }
    } else window.EAS.Render = new EAS_Render()
}, 250)