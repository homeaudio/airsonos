import { promisify } from 'bluebird'
import * as sonos from 'sonos'

const _sonosSearchPromise = promisify<any[]>(sonos.LogicalDevice.search)

export function sonosSearch(): Promise<any[]> {
    return _sonosSearchPromise()
}


export interface ZoneAttrs {

}

export interface SonosDevice {
    groupId: string
    getZoneAttrs(): Promise<ZoneAttrs>
}
