import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

window.Pusher = Pusher

const echo = new Echo({
    broadcaster: 'reverb',
    key: '7zoh9kfmri1bjfxop74c',
    host: '127.0.0.1',
    port: 8080,
    wsHost: '127.0.0.1',
    wsPort: 8080,
    wssPort: 8080,
    forceTLS: false,
    encrypted: false,
    enabledTransports: ['ws', 'wss'],
})

export default echo