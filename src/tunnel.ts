import * as Promise from 'bluebird'
import { EventEmitter } from 'events'
import { NodeTunes, NodeTunesOptions } from 'nodetunes'
import { Nicercast } from 'nicercast'
import * as ip from 'ip'
import { SonosDevice } from './sonos'

// the SONOS library sometimes expects callbacks to function,
// even if we don't really care about the result
const EMPTY_CALLBACK = () => { }

export class DeviceTunnel extends EventEmitter {

    icecastServer: Nicercast
    airplayServer: NodeTunes

    constructor(readonly device: SonosDevice,
                readonly deviceName: string,
                readonly options: Partial<NodeTunesOptions>) {
        super()
        this.bindAirplayServer()
    }

    static createFor(device: SonosDevice, options: Partial<NodeTunesOptions> = {}) {

        const getZoneAttrs = Promise.promisify(device.getZoneAttrs.bind(device))

        return getZoneAttrs().then((zoneAttrs) => {
            return new DeviceTunnel(device, zoneAttrs.CurrentZoneName, options)
        })
    }

    bindAirplayServer() {

        this.airplayServer = new NodeTunes({
            serverName: `${this.deviceName} (AirSonos)`,
            ...this.options
        })

        this.airplayServer.on('error', this.emit.bind(this, 'error'))

        let clientName = 'AirSonos'
        this.airplayServer.on('clientNameChange', (name) => {
            clientName = `AirSonos @ ${name}`
        })

        this.airplayServer.on('clientConnected', (audioStream) => this.handleClientConnected(audioStream))
        this.airplayServer.on('clientDisconnected', () => this.device.stop(EMPTY_CALLBACK))

        this.airplayServer.on('volumeChange', (vol: number) => {
            let targetVol = 100 - Math.floor(-1 * (Math.max(vol, -30) / 30) * 100)
            this.device.setVolume(targetVol, EMPTY_CALLBACK)
        })
    }

    handleClientConnected(audioStream) {

        // TODO: support switching input streams when connection is held

        this.icecastServer = new Nicercast(audioStream)

        this.airplayServer.on('metadataChange', (metadata) => {
            if (metadata.minm) {
                let asarPart = metadata.asar ? ` - ${metadata.asar}` : '' // artist
                let asalPart = metadata.asal ? ` (${metadata.asal})` : '' // album

                this.icecastServer.setMetadata(metadata.minm + asarPart + asalPart)
            }
        })

        this.airplayServer.on('clientDisconnected', () => this.icecastServer.close())

        this.icecastServer.listen(0, () => {

            // Query the server to find the active port
            const port = this.icecastServer.address().port
            this.device.play({
                uri: `x-rincon-mp3radio://${ip.address()}:${port}/listen.m3u`,
                metadata: this.generateSonosMetadata(this.deviceName),
            })
        })
    }

    generateSonosMetadata(clientName) {
        return `<?xml version="1.0"?>
<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
<item id="R:0/0/49" parentID="R:0/0" restricted="true">
<dc:title>${clientName}</dc:title>
<upnp:class>object.item.audioItem.audioBroadcast</upnp:class>
<desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON65031_</desc>
</item>
</DIDL-Lite>`
    }

    start() {
        this.airplayServer.start()
    }

    stop() {
        this.airplayServer.stop()
        this.icecastServer.close()
    }

}
