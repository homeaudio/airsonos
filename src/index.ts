#!/usr/bin/env node

import * as flags from 'flags'
import { AirSonos } from './airsonos'

flags.defineBoolean('diagnostics', false, 'run diagnostics utility')
flags.defineBoolean('version', false, 'return version number')
flags.defineInteger('timeout', 5, 'disconnect timeout (in seconds)')
flags.defineBoolean('verbose', false, 'show verbose output')
flags.parse()

if (flags.get('version')) {

    const pjson = require('../package.json')
    console.log(pjson.version)

} else if (flags.get('diagnostics')) {

    const diag = require('../lib/diagnostics')
    diag()

} else {

    console.log('Searching for Sonos devices on network...\n')

    const instance = new AirSonos({
        timeout: flags.get('timeout'),
        verbose: flags.get('verbose'),
    })

    instance.start().then((tunnels) => {

        tunnels.forEach((tunnel) => {
            console.log(`${tunnel.deviceName} (@ ${tunnel.device.host}:${tunnel.device.port}, ${tunnel.device.groupId})`)
        })

        console.log(`\nSearch complete. Set up ${tunnels.length} device tunnel${tunnels.length === 1 ? '' : 's'}.`)
    })

}
