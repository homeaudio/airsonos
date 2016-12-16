import { promisify } from 'bluebird'
import * as sonos from 'sonos'


export function sonosSearch(callback: Function): Function {
    const searcher = new sonos.Search()
    searcher.on('DeviceAvailable', callback)
    return () => searcher.destroy()
}


export interface ZoneAttrs {

}

export interface SonosDevice {
    groupId: string
    getZoneAttrs(): Promise<ZoneAttrs>
}
