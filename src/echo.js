import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

window.Pusher = Pusher

const echo = new Echo({
    broadcaster: 'reverb',
    key: 'ac46bb33b376bc5828e2', // Sesuai dengan VITE_PUSHER_APP_KEY kamu
    wsHost: 'backend-belanjaan-production.up.railway.app', // PENTING: Ganti dengan domain asli backend Railway-mu tanpa https:// atau /api
    wsPort: 443,
    wssPort: 443,
    forceTLS: true, // Wajib TRUE untuk production web
    enabledTransports: ['ws', 'wss'],
})

export default echo