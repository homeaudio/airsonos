import { search, Sonos } from 'sonos'
import { DeviceTunnel } from './tunnel'

export class AirSonos {

    readonly tunnels: { [groupId: string]: DeviceTunnel } = {}

    constructor(readonly options = {}) { }

    start() {
        search(async (device: Sonos, model) => {

            const tunnel = await DeviceTunnel.createFor(device, this.options)
            tunnel.on('error', (err: any) => {
                if (err.code === 415) {
                    console.error('Warning!', err.message)
                    console.error('AirSonos does not support codecs used by applications such as iTunes or AirFoil.')
                    console.error('Progress on this issue: https://github.com/stephen/nodetunes/issues/1')
                } else {
                    console.error('Unknown error:')
                    console.error(err)
                }
            })

            tunnel.start()
            this.tunnels[tunnel.device.groupId] = tunnel
        })
    }

    stop() {
        return Promise.all(Object.keys(this.tunnels).map(key => this.tunnels[key].stop()))
    }
}
