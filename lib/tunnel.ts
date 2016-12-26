import { EventEmitter } from 'events'
import { NodeTunes, NodeTunesOptions } from 'nodetunes'
import { Nicercast } from 'nicercast'
import * as ip from 'ip'
import { Sonos } from 'sonos'

function generateSonosMetadata(clientName: string) {
        return `<?xml version="1.0"?>
<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
<item id="R:0/0/49" parentID="R:0/0" restricted="true">
    <dc:title>${clientName}</dc:title>
    <upnp:class>object.item.audioItem.audioBroadcast</upnp:class>
    <desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">SA_RINCON65031_</desc>
</item>
</DIDL-Lite>`
    }

export class DeviceTunnel extends EventEmitter {

    readonly device: Sonos
    readonly deviceName: string
    private readonly nodeTunesOptions: Partial<NodeTunesOptions>
    icecastServer: Nicercast
    airplayServer: NodeTunes

    constructor(device: Sonos, deviceName: string,
                nodeTunesOptions: Partial<NodeTunesOptions>) {
        super()
        this.device = device
        this.deviceName = deviceName
        this.nodeTunesOptions = nodeTunesOptions
        this.bindAirplayServer()
    }

    static async createFor(device: Sonos, options: Partial<NodeTunesOptions> = {}) {
        const zoneAttrs = await device.getZoneAttrs()
        return new DeviceTunnel(device, zoneAttrs.CurrentZoneName, options)
    }

    bindAirplayServer() {

        console.log('Creating Airplay server...')

        this.airplayServer = new NodeTunes({
            serverName: `${this.deviceName} (AirSonos)`,
            ...this.nodeTunesOptions,
        })

        this.airplayServer.on('error', this.emit.bind(this, 'error'))

        let clientName = 'AirSonos'
        this.airplayServer.on('clientNameChange', (name) => {
            clientName = `AirSonos @ ${name}`
        })

        this.airplayServer.on('clientConnected', (audioStream) => this.handleClientConnected(audioStream))
        this.airplayServer.on('clientDisconnected', () => this.device.stop())

        this.airplayServer.on('volumeChange', (vol: number) => {
            const targetVol = 100 - Math.floor(-1 * (Math.max(vol, -30) / 30) * 100)
            this.device.setVolume(targetVol)
        })
    }

    handleClientConnected(audioStream) {

        // TODO: support switching input streams when connection is held

        this.icecastServer = new Nicercast(audioStream)

        this.airplayServer.on('metadataChange', (metadata) => {
            console.log('METADATA CHANGING')
            if (metadata.minm) {
                const asarPart = metadata.asar ? ` - ${metadata.asar}` : '' // artist
                const asalPart = metadata.asal ? ` (${metadata.asal})` : '' // album

                this.icecastServer.setMetadata(metadata.minm + asarPart + asalPart)
            }
        })

        this.airplayServer.on('clientDisconnected', () => this.icecastServer.close())

        this.icecastServer.listen(0, async () => {
            // query the server to find the active port
            const port = this.icecastServer.address().port
            console.log('Getting queue')
            const queue = await this.device.getQueue()
            console.log('Got queue!')
            console.log(queue)
            this.device.play(`x-rincon-mp3radio://${ip.address()}:${port}/listen.m3u`,
                             generateSonosMetadata(this.deviceName))
        })
    }

    start() {
        this.airplayServer.start()
    }

    stop() {
        this.airplayServer.stop()
        this.icecastServer.close()
    }

}
