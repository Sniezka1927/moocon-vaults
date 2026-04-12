import { app } from './app'

const port = Number(process.env.PORT ?? 7777)

app.listen(port)

console.info({ port, url: `http://localhost:${port}` }, 'API listening')
