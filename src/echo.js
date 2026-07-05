import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

window.Pusher = Pusher

const echo = new Echo({
    broadcaster: 'reverb',
    key: '7zoh9kfmri1bjfxop74c',
    host: 'backend-belanjaan-production.up.railway.app',
    port: 443,
    wsHost: 'backend-belanjaan-production.up.railway.app',
    wsPort: 80,
    wssPort: 443,
    forceTLS: true,
    encrypted: true,
    enabledTransports: ['ws', 'wss'],
})

export default echo