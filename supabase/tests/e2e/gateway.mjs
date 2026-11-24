// Gateway locale: /auth/v1 -> GoTrue, /rest/v1 -> PostgREST, /storage/v1 -> storage finto che rispetta le RLS
// (scrive/legge storage.objects tramite PostgREST con il token dell'utente).
import http from 'node:http'
import crypto from 'node:crypto'
const files = new Map() // bucket/path -> {type, buf}
const tokens = new Map() // token -> key
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
function proxy(req, res, port, path, body) {
  const headers = { ...req.headers, host: 'localhost' }
  const r = http.request({ host: '127.0.0.1', port, path, method: req.method, headers }, (pr) => {
    res.writeHead(pr.statusCode, { ...pr.headers, ...cors }); pr.pipe(res)
  })
  r.on('error', (e) => { res.writeHead(502, cors); res.end(String(e)) })
  if (body) r.end(body); else req.pipe(r)
}
async function rest(method, path, auth, body, profile = 'storage') {
  const r = await fetch('http://127.0.0.1:3000' + path, { method, headers: { authorization: auth, 'content-type': 'application/json', 'accept-profile': profile, 'content-profile': profile, prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, json: await r.json().catch(() => null) }
}
const readBody = (req) => new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))) })
http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
  const u = new URL(req.url, 'http://x')
  if (u.pathname.startsWith('/auth/v1')) return proxy(req, res, 9999, req.url.slice(8))
  if (u.pathname.startsWith('/rest/v1')) return proxy(req, res, 3000, req.url.slice(8))
  if (u.pathname.startsWith('/storage/v1')) {
    const p = decodeURIComponent(u.pathname.slice(11))
    const auth = req.headers.authorization
    const send = (s, j) => { res.writeHead(s, { ...cors, 'content-type': 'application/json' }); res.end(JSON.stringify(j)) }
    let m
    if (req.method === 'POST' && (m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/))) {
      const q = await rest('GET', `/objects?bucket_id=eq.${m[1]}&name=eq.${encodeURIComponent(m[2])}&select=id`, auth)
      if (!q.json?.length) return send(400, { statusCode: '404', error: 'not_found', message: 'Object not found' })
      const t = crypto.randomUUID(); tokens.set(t, `${m[1]}/${m[2]}`)
      return send(200, { signedURL: `/object/sign/${m[1]}/${m[2]}?token=${t}` })
    }
    if (req.method === 'GET' && (m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/))) {
      const f = files.get(tokens.get(u.searchParams.get('token')))
      if (!f) { res.writeHead(404, cors); return res.end() }
      res.writeHead(200, { ...cors, 'content-type': f.type }); return res.end(f.buf)
    }
    if (req.method === 'GET' && (m = p.match(/^\/object\/public\/([^/]+)\/(.+)$/))) {
      const f = files.get(`${m[1]}/${m[2]}`)
      if (!f) { res.writeHead(404, cors); return res.end() }
      res.writeHead(200, { ...cors, 'content-type': f.type }); return res.end(f.buf)
    }
    if ((req.method === 'POST' || req.method === 'PUT') && (m = p.match(/^\/object\/([^/]+)\/(.+)$/))) {
      let buf = await readBody(req), type = req.headers['content-type'] || 'application/octet-stream'
      if (type.startsWith('multipart/')) {
        const fd = await new Response(buf, { headers: { 'content-type': type } }).formData()
        for (const [, v] of fd) if (typeof v !== 'string') { type = v.type || 'image/png'; buf = Buffer.from(await v.arrayBuffer()) }
      }
      const q = await rest('POST', '/objects', auth, { bucket_id: m[1], name: m[2] })
      if (q.status >= 300) return send(400, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' })
      files.set(`${m[1]}/${m[2]}`, { type, buf })
      return send(200, { Key: `${m[1]}/${m[2]}`, Id: q.json[0].id })
    }
    if (req.method === 'DELETE' && (m = p.match(/^\/object\/([^/]+)$/))) {
      const { prefixes } = JSON.parse((await readBody(req)).toString() || '{}')
      const out = []
      for (const n of prefixes ?? []) { const q = await rest('DELETE', `/objects?bucket_id=eq.${m[1]}&name=eq.${encodeURIComponent(n)}`, auth); if (q.json?.length) { files.delete(`${m[1]}/${n}`); out.push({ name: n }) } }
      return send(200, out)
    }
    return send(404, { message: 'not implemented ' + req.method + ' ' + p })
  }
  res.writeHead(404, cors); res.end()
}).listen(54321, () => console.log('gateway on 54321'))
