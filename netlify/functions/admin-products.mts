import type { Context } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { requireAdmin } from './_admin.mjs'

interface Product {
  id: string
  label: string
  price: number
  description?: string
  imageId?: string
  suffix?: string
  active?: boolean
  createdAt?: string
  updatedAt?: string
}

interface UpsertBody {
  id?: string
  label?: string
  price?: number | string
  description?: string
  imageId?: string
  suffix?: string
  active?: boolean
}

const PRODUCTS_KEY = 'products'

function slugify(s: string) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

async function readProducts(): Promise<Product[]> {
  const store = getStore('site-config')
  const data = await store.get(PRODUCTS_KEY, { type: 'json' }).catch(() => null)
  if (Array.isArray(data)) return data as Product[]
  return []
}

async function writeProducts(products: Product[]) {
  const store = getStore('site-config')
  await store.setJSON(PRODUCTS_KEY, products)
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'GET') {
    const products = await readProducts()
    return Response.json({ products })
  }

  const guard = await requireAdmin()
  if (guard instanceof Response) return guard

  if (req.method === 'POST') {
    let body: UpsertBody
    try {
      body = (await req.json()) as UpsertBody
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }

    const label = String(body.label || '').trim()
    if (!label) return new Response('Label is required', { status: 400 })

    const priceNum = typeof body.price === 'number' ? body.price : parseFloat(String(body.price || '0'))
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return new Response('Price must be a non-negative number', { status: 400 })
    }

    const products = await readProducts()
    const now = new Date().toISOString()
    let id = String(body.id || '').trim()
    if (id) {
      const idx = products.findIndex((p) => p.id === id)
      if (idx === -1) return new Response('Product not found', { status: 404 })
      products[idx] = {
        ...products[idx],
        label,
        price: priceNum,
        description: body.description !== undefined ? String(body.description) : products[idx].description || '',
        imageId: body.imageId !== undefined ? String(body.imageId || '') : products[idx].imageId || '',
        suffix: body.suffix !== undefined ? String(body.suffix || '') : products[idx].suffix || '',
        active: body.active !== undefined ? !!body.active : products[idx].active !== false,
        updatedAt: now,
      }
    } else {
      const baseId = slugify(label) || `bundle-${Date.now().toString(36)}`
      let candidate = baseId
      let i = 2
      while (products.some((p) => p.id === candidate)) {
        candidate = `${baseId}-${i++}`
      }
      id = candidate
      products.push({
        id,
        label,
        price: priceNum,
        description: body.description ? String(body.description) : '',
        imageId: body.imageId ? String(body.imageId) : '',
        suffix: body.suffix ? String(body.suffix) : '',
        active: body.active !== false,
        createdAt: now,
        updatedAt: now,
      })
    }

    await writeProducts(products)
    return Response.json({ ok: true, products })
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url)
    const id = (url.searchParams.get('id') || '').trim()
    if (!id) return new Response('Missing id', { status: 400 })
    const products = await readProducts()
    const next = products.filter((p) => p.id !== id)
    if (next.length === products.length) return new Response('Product not found', { status: 404 })
    await writeProducts(next)
    return Response.json({ ok: true, products: next })
  }

  return new Response('Method not allowed', { status: 405 })
}
