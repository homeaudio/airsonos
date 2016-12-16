import { sonosSearch } from './sonos'
import { DeviceTunnel } from './tunnel'
import * as sonos from 'sonos'

export class AirSonos {

    readonly tunnels: { [groupId: string]: DeviceTunnel } = {}

    constructor(readonly options = {}) { }

    start() {
        const searcher = sonos.search(async (device, model) => {
            console.log(device)
            console.log(model)

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

    async refresh() {
        const devices = await sonosSearch()
            // remove old groups
            // add new groups
            // update existing groups with new configurations
    }

    stop() {
        return Promise.all(Object.keys(this.tunnels).map(key => this.tunnels[key].stop()))
    }
}
