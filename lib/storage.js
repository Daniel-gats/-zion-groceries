const fsp = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');

const dataDir = path.join(__dirname, '..', 'data');
const filePaths = {
  products: path.join(dataDir, 'products.json'),
  orders: path.join(dataDir, 'orders.json'),
  users: path.join(dataDir, 'users.json')
};

let pool;
let useDb = Boolean(process.env.DATABASE_URL);
let initialized = false;
const LOW_STOCK_THRESHOLD = 10;
const n = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const i = (v, d = 0) => Number.isFinite(Number.parseInt(v, 10)) ? Number.parseInt(v, 10) : d;
const idEq = (a, b) => String(a) === String(b);
const productNameCompare = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }) || i(a.id) - i(b.id);
const SHOP_LOCATION = {
  label: process.env.SHOP_LOCATION_LABEL || 'Croton Ridge Estate, Kenyatta Road / Theta, Juja',
  lat: n(process.env.SHOP_LATITUDE, -1.1087),
  lng: n(process.env.SHOP_LONGITUDE, 37.0719)
};

const hasCoordinate = (lat, lng) => Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

function distanceKm(fromLat, fromLng, toLat, toLng) {
  const earthRadiusKm = 6371;
  const dLat = (Number(toLat) - Number(fromLat)) * Math.PI / 180;
  const dLng = (Number(toLng) - Number(fromLng)) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(Number(fromLat) * Math.PI / 180)
    * Math.cos(Number(toLat) * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceDeliveryQuote(lat, lng) {
  if (!hasCoordinate(lat, lng)) return null;
  const km = Math.max(0, distanceKm(SHOP_LOCATION.lat, SHOP_LOCATION.lng, lat, lng));
  let fee = 0;
  if (km <= 1) fee = 30;
  else if (km <= 3) fee = 60;
  else if (km <= 5) fee = 100;
  else fee = 150 + Math.ceil(km - 5) * 25;
  return {
    customerLatitude: n(lat),
    customerLongitude: n(lng),
    deliveryDistanceKm: Number(km.toFixed(2)),
    deliveryFee: fee,
    estimatedDeliveryMinutes: Math.max(20, Math.round(18 + km * 6)),
    deliveryArea: `${Number(km.toFixed(2))} km from ${SHOP_LOCATION.label}`
  };
}

function getPool() {
  if (!useDb) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }
  return pool;
}

async function ensureFiles() {
  await fsp.mkdir(dataDir, { recursive: true });
  for (const file of Object.values(filePaths)) {
    try { await fsp.access(file); } catch { await fsp.writeFile(file, '[]'); }
  }
}

async function readJson(file) {
  try {
    const raw = await fsp.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeJson(file, data) {
  await fsp.writeFile(file, JSON.stringify(data, null, 2) + '\n');
}

function deliveryMeta(address = '', city = '', location = {}) {
  const quote = distanceDeliveryQuote(location.customerLatitude ?? location.deliveryLatitude, location.customerLongitude ?? location.deliveryLongitude);
  if (quote) return quote;
  const area = String(address || city || '').trim();
  const value = area.toLowerCase();
  if (!area) return { deliveryArea: '', deliveryFee: 60, estimatedDeliveryMinutes: 55 };
  if (value.includes('crotonridge') || value.includes('croton ridge')) return { deliveryArea: area, deliveryFee: 40, estimatedDeliveryMinutes: 30 };
  if (['hostel', 'campus', 'unity', 'comfy', 'stage', 'town'].some(k => value.includes(k))) return { deliveryArea: area, deliveryFee: 0, estimatedDeliveryMinutes: 25 };
  if (['estate', 'annex', 'pipeline', 'mashuru'].some(k => value.includes(k))) return { deliveryArea: area, deliveryFee: 80, estimatedDeliveryMinutes: 40 };
  return { deliveryArea: area, deliveryFee: 120, estimatedDeliveryMinutes: 55 };
}

function orderNumber() {
  return `ORD-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}

function buildStatusTimestamps(input = {}) {
  return {
    confirmedAt: input.confirmedAt || null,
    preparingAt: input.preparingAt || null,
    deliveryStartedAt: input.deliveryStartedAt || null,
    deliveredAt: input.deliveredAt || null,
    cancelledAt: input.cancelledAt || null,
    paymentConfirmedAt: input.paymentConfirmedAt || null
  };
}

async function initStorage() {
  if (initialized) return;
  await ensureFiles();
  if (useDb) {
    try {
      const db = getPool();
      await db.query('select 1');
      await db.query(`
        create table if not exists users (
          id bigserial primary key,
          email text unique not null,
          password_hash text not null,
          full_name text not null,
          phone text default '',
          address text default '',
          city text default '',
          is_admin boolean default false,
          is_active boolean default true,
          created_at timestamptz default now(),
          last_login timestamptz
        );
        create table if not exists products (
          id bigserial primary key,
          name text not null,
          price numeric(12,2) not null,
          category text not null,
          image text default '',
          unit text default 'kg',
          stock integer default 0,
          description text default '',
          average_rating numeric(3,1) default 0,
          total_reviews integer default 0,
          is_active boolean default true,
          created_at timestamptz default now(),
          updated_at timestamptz default now()
        );
        create table if not exists orders (
          id bigserial primary key,
          order_number text unique not null,
          user_id bigint,
          user_email text,
          user_name text,
          customer_phone text,
          delivery_address text,
          delivery_city text,
          delivery_room text,
          delivery_area text,
          delivery_fee numeric(12,2) default 0,
          estimated_delivery_minutes integer default 30,
          notes text default '',
          admin_note text default '',
          payment_method text default 'cash',
          payment_status text default 'pending',
          payment_reference text default '',
          customer_latitude numeric(10,7),
          customer_longitude numeric(10,7),
          delivery_distance_km numeric(8,2),
          delivery_map_url text default '',
          status text default 'pending',
          is_guest_order boolean default true,
          subtotal_amount numeric(12,2) default 0,
          total_amount numeric(12,2) default 0,
          created_at timestamptz default now(),
          updated_at timestamptz default now(),
          confirmed_at timestamptz,
          preparing_at timestamptz,
          delivery_started_at timestamptz,
          delivered_at timestamptz,
          cancelled_at timestamptz,
          payment_confirmed_at timestamptz
        );
        create table if not exists order_items (
          id bigserial primary key,
          order_id bigint references orders(id) on delete cascade,
          product_id bigint,
          product_name text not null,
          product_price numeric(12,2) default 0,
          quantity integer not null,
          subtotal numeric(12,2) default 0,
          image text default '',
          unit text default 'item'
        );
        alter table orders add column if not exists admin_note text default '';
        alter table orders add column if not exists payment_reference text default '';
        alter table orders add column if not exists customer_latitude numeric(10,7);
        alter table orders add column if not exists customer_longitude numeric(10,7);
        alter table orders add column if not exists delivery_distance_km numeric(8,2);
        alter table orders add column if not exists delivery_map_url text default '';
        alter table orders add column if not exists confirmed_at timestamptz;
        alter table orders add column if not exists preparing_at timestamptz;
        alter table orders add column if not exists delivery_started_at timestamptz;
        alter table orders add column if not exists cancelled_at timestamptz;
        alter table orders add column if not exists payment_confirmed_at timestamptz;
      `);
      const { rows } = await db.query('select count(*)::int as count from products');
      if (rows[0].count === 0) {
        const seed = await readJson(filePaths.products);
        for (const p of seed) {
          await db.query('insert into products (id,name,price,category,image,unit,stock,description,average_rating,total_reviews,is_active,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)', [i(p.id), p.name, n(p.price), p.category, p.image || '', p.unit || 'kg', i(p.stock), p.description || '', n(p.averageRating), i(p.totalReviews), p.isActive !== false, p.createdAt || new Date().toISOString(), p.updatedAt || new Date().toISOString()]);
        }
      }
    } catch (error) {
      console.error('Postgres unavailable, using JSON fallback:', error.message);
      useDb = false;
      if (pool) { await pool.end().catch(() => {}); pool = null; }
    }
  }
  initialized = true;
}

function mapProduct(row) {
  return {
    id: i(row.id), name: row.name, price: n(row.price), category: row.category, image: row.image, unit: row.unit || 'kg', stock: i(row.stock), description: row.description || '',
    averageRating: n(row.average_rating ?? row.averageRating), totalReviews: i(row.total_reviews ?? row.totalReviews), isActive: row.is_active !== undefined ? !!row.is_active : row.isActive !== false,
    createdAt: row.created_at || row.createdAt || null, updatedAt: row.updated_at || row.updatedAt || null
  };
}

function mapUser(row) {
  return {
    id: i(row.id), email: row.email, passwordHash: row.password_hash || row.passwordHash, fullName: row.full_name || row.fullName,
    phone: row.phone || '', address: row.address || '', city: row.city || '', isAdmin: row.is_admin !== undefined ? !!row.is_admin : !!row.isAdmin,
    isActive: row.is_active !== undefined ? !!row.is_active : row.isActive !== false, createdAt: row.created_at || row.createdAt || null, lastLogin: row.last_login || row.lastLogin || null
  };
}

function mapOrder(row, items = []) {
  const customerLatitude = row.customer_latitude ?? row.customerLatitude ?? null;
  const customerLongitude = row.customer_longitude ?? row.customerLongitude ?? null;
  return {
    id: i(row.id), orderNumber: row.order_number || row.orderNumber, userId: row.user_id ?? row.userId ?? null, userEmail: row.user_email || row.userEmail || null,
    userName: row.user_name || row.userName || '', customerPhone: row.customer_phone || row.customerPhone || '', deliveryAddress: row.delivery_address || row.deliveryAddress || '',
    deliveryCity: row.delivery_city || row.deliveryCity || '', deliveryRoom: row.delivery_room || row.deliveryRoom || '', deliveryArea: row.delivery_area || row.deliveryArea || '',
    deliveryFee: n(row.delivery_fee ?? row.deliveryFee), estimatedDeliveryMinutes: i(row.estimated_delivery_minutes ?? row.estimatedDeliveryMinutes), notes: row.notes || '',
    adminNote: row.admin_note || row.adminNote || '', paymentMethod: row.payment_method || row.paymentMethod || 'cash', paymentStatus: row.payment_status || row.paymentStatus || 'pending',
    paymentReference: row.payment_reference || row.paymentReference || '', customerLatitude: customerLatitude === null ? null : n(customerLatitude),
    customerLongitude: customerLongitude === null ? null : n(customerLongitude), deliveryDistanceKm: n(row.delivery_distance_km ?? row.deliveryDistanceKm),
    deliveryMapUrl: row.delivery_map_url || row.deliveryMapUrl || '', status: row.status || 'pending',
    isGuestOrder: row.is_guest_order !== undefined ? !!row.is_guest_order : !!row.isGuestOrder, subtotalAmount: n(row.subtotal_amount ?? row.subtotalAmount), totalAmount: n(row.total_amount ?? row.totalAmount),
    items, createdAt: row.created_at || row.createdAt || null, updatedAt: row.updated_at || row.updatedAt || null,
    confirmedAt: row.confirmed_at || row.confirmedAt || null, preparingAt: row.preparing_at || row.preparingAt || null, deliveryStartedAt: row.delivery_started_at || row.deliveryStartedAt || null,
    deliveredAt: row.delivered_at || row.deliveredAt || null, cancelledAt: row.cancelled_at || row.cancelledAt || null, paymentConfirmedAt: row.payment_confirmed_at || row.paymentConfirmedAt || null
  };
}

async function getStorageMode() { await initStorage(); return useDb ? 'postgres' : 'json'; }

async function getProducts(opts = {}) {
  await initStorage();
  const includeInactive = opts.includeInactive === true;
  const includeOutOfStock = opts.admin === true || opts.includeOutOfStock === true;
  const category = opts.category ? String(opts.category).toLowerCase() : null;
  const search = opts.search ? String(opts.search).toLowerCase() : null;
  if (useDb) {
    const params = [];
    const where = [];
    if (!includeInactive) where.push('is_active = true');
    if (!includeOutOfStock) where.push('stock > 0');
    if (category) { params.push(category); where.push(`lower(category) = $${params.length}`); }
    if (search) { params.push(`%${search}%`); where.push(`(lower(name) like $${params.length} or lower(description) like $${params.length})`); }
    const sql = `select * from products ${where.length ? `where ${where.join(' and ')}` : ''} order by lower(name), id`;
    const { rows } = await getPool().query(sql, params);
    return rows.map(mapProduct);
  }
  let products = (await readJson(filePaths.products)).map(mapProduct);
  if (!includeInactive) products = products.filter(p => p.isActive !== false);
  if (!includeOutOfStock) products = products.filter(p => i(p.stock) > 0);
  if (category) products = products.filter(p => String(p.category).toLowerCase() === category);
  if (search) products = products.filter(p => String(p.name).toLowerCase().includes(search) || String(p.description || '').toLowerCase().includes(search));
  return products.sort(productNameCompare);
}

async function getProductById(id, opts = {}) {
  const product = (await getProducts({ includeInactive: true, includeOutOfStock: true, admin: true })).find(p => idEq(p.id, id));
  if (!product) return null;
  if (!opts.includeInactive && product.isActive === false) return null;
  return product;
}

async function getProductStats() {
  const products = await getProducts({ includeInactive: true, includeOutOfStock: true, admin: true });
  const active = products.filter(p => p.isActive !== false);
  return {
    totalProducts: active.length,
    totalVegetables: active.filter(p => p.category === 'vegetables').length,
    totalFruits: active.filter(p => p.category === 'fruits').length,
    totalBakery: active.filter(p => p.category === 'bakery').length,
    lowStock: active.filter(p => i(p.stock) > 0 && i(p.stock) <= LOW_STOCK_THRESHOLD).length,
    outOfStock: active.filter(p => i(p.stock) <= 0).length,
    hiddenProducts: products.filter(p => p.isActive === false).length
  };
}

async function createProduct(input) {
  await initStorage();
  const payload = { name: String(input.name || '').trim(), price: n(input.price), category: String(input.category || '').trim(), image: input.image || 'https://via.placeholder.com/200x200?text=Product', unit: input.unit || 'kg', stock: i(input.stock), description: input.description || '', isActive: input.isActive !== false };
  if (useDb) {
    const { rows } = await getPool().query('insert into products (name,price,category,image,unit,stock,description,is_active,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,now(),now()) returning *', [payload.name, payload.price, payload.category, payload.image, payload.unit, payload.stock, payload.description, payload.isActive]);
    return mapProduct(rows[0]);
  }
  const products = await readJson(filePaths.products);
  const nextId = products.length ? Math.max(...products.map(p => i(p.id))) + 1 : 1;
  const created = { id: nextId, ...payload, averageRating: 0, totalReviews: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  products.push(created); await writeJson(filePaths.products, products); return mapProduct(created);
}

async function updateProduct(id, updates) {
  await initStorage();
  const existing = await getProductById(id, { includeInactive: true });
  if (!existing) return null;
  const payload = { ...existing, ...(updates.name !== undefined ? { name: String(updates.name).trim() } : {}), ...(updates.price !== undefined ? { price: n(updates.price, existing.price) } : {}), ...(updates.category !== undefined ? { category: String(updates.category).trim() } : {}), ...(updates.image !== undefined ? { image: updates.image || existing.image } : {}), ...(updates.unit !== undefined ? { unit: updates.unit || existing.unit } : {}), ...(updates.stock !== undefined ? { stock: i(updates.stock, existing.stock) } : {}), ...(updates.description !== undefined ? { description: updates.description || '' } : {}), ...(updates.isActive !== undefined ? { isActive: !!updates.isActive } : {}) };
  if (useDb) {
    const { rows } = await getPool().query('update products set name=$2, price=$3, category=$4, image=$5, unit=$6, stock=$7, description=$8, is_active=$9, updated_at=now() where id=$1 returning *', [i(id), payload.name, payload.price, payload.category, payload.image, payload.unit, payload.stock, payload.description, payload.isActive]);
    return mapProduct(rows[0]);
  }
  const products = await readJson(filePaths.products); const index = products.findIndex(p => idEq(p.id, id)); products[index] = { ...products[index], ...payload, updatedAt: new Date().toISOString() }; await writeJson(filePaths.products, products); return mapProduct(products[index]);
}

async function bulkUpsertProducts(items = []) {
  const results = [];
  for (const item of items) results.push(item.id ? (await updateProduct(item.id, item)) || await createProduct(item) : await createProduct(item));
  return results;
}

async function deleteProduct(id) {
  const existing = await getProductById(id, { includeInactive: true }); if (!existing) return null;
  if (useDb) { await getPool().query('delete from products where id = $1', [i(id)]); return existing; }
  const products = await readJson(filePaths.products); await writeJson(filePaths.products, products.filter(p => !idEq(p.id, id))); return existing;
}

async function getUsers() {
  await initStorage();
  if (useDb) { const { rows } = await getPool().query('select * from users order by id'); return rows.map(mapUser); }
  return (await readJson(filePaths.users)).map(mapUser);
}

async function getUserByEmail(email) { return (await getUsers()).find(u => String(u.email).toLowerCase() === String(email).toLowerCase()) || null; }
async function getUserById(id) { return (await getUsers()).find(u => idEq(u.id, id)) || null; }

async function createUser(input) {
  const payload = { email: String(input.email || '').toLowerCase(), passwordHash: input.passwordHash, fullName: input.fullName, phone: input.phone || '', address: input.address || '', city: input.city || '', isAdmin: !!input.isAdmin, isActive: input.isActive !== false, createdAt: input.createdAt || new Date().toISOString(), lastLogin: input.lastLogin || null };
  if (useDb) { const { rows } = await getPool().query('insert into users (email,password_hash,full_name,phone,address,city,is_admin,is_active,created_at,last_login) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *', [payload.email, payload.passwordHash, payload.fullName, payload.phone, payload.address, payload.city, payload.isAdmin, payload.isActive, payload.createdAt, payload.lastLogin]); return mapUser(rows[0]); }
  const users = await readJson(filePaths.users); const nextId = users.length ? Math.max(...users.map(u => i(u.id))) + 1 : 1; const created = { id: nextId, ...payload }; users.push(created); await writeJson(filePaths.users, users); return mapUser(created);
}

async function updateUser(id, updates) {
  const existing = await getUserById(id); if (!existing) return null;
  const payload = { ...existing, ...(updates.passwordHash !== undefined ? { passwordHash: updates.passwordHash } : {}), ...(updates.fullName !== undefined ? { fullName: updates.fullName || existing.fullName } : {}), ...(updates.phone !== undefined ? { phone: updates.phone || '' } : {}), ...(updates.address !== undefined ? { address: updates.address || '' } : {}), ...(updates.city !== undefined ? { city: updates.city || '' } : {}), ...(updates.isAdmin !== undefined ? { isAdmin: !!updates.isAdmin } : {}), ...(updates.isActive !== undefined ? { isActive: !!updates.isActive } : {}), ...(updates.lastLogin !== undefined ? { lastLogin: updates.lastLogin } : {}) };
  if (useDb) { const { rows } = await getPool().query('update users set password_hash=$2, full_name=$3, phone=$4, address=$5, city=$6, is_admin=$7, is_active=$8, last_login=$9 where id=$1 returning *', [i(id), payload.passwordHash, payload.fullName, payload.phone, payload.address, payload.city, payload.isAdmin, payload.isActive, payload.lastLogin]); return mapUser(rows[0]); }
  const users = await readJson(filePaths.users); const index = users.findIndex(u => idEq(u.id, id)); users[index] = { ...users[index], ...payload }; await writeJson(filePaths.users, users); return mapUser(users[index]);
}

async function createOrder(input) {
  await initStorage();
  const items = Array.isArray(input.items) ? input.items : [];
  const meta = deliveryMeta(input.deliveryAddress, input.deliveryCity, input);
  const subtotalAmount = n(input.subtotalAmount);
  const hasDistanceQuote = meta.customerLatitude !== undefined && meta.customerLongitude !== undefined;
  const deliveryFee = hasDistanceQuote ? meta.deliveryFee : (input.deliveryFee !== undefined ? n(input.deliveryFee) : meta.deliveryFee);
  const totalAmount = subtotalAmount + deliveryFee;
  const now = new Date().toISOString();
  const mapUrl = hasCoordinate(meta.customerLatitude, meta.customerLongitude)
    ? `https://www.google.com/maps/dir/?api=1&origin=${SHOP_LOCATION.lat},${SHOP_LOCATION.lng}&destination=${meta.customerLatitude},${meta.customerLongitude}&travelmode=driving`
    : '';
  const statusTimestamps = buildStatusTimestamps({
    confirmedAt: input.status === 'confirmed' ? now : input.confirmedAt,
    preparingAt: input.status === 'preparing' ? now : input.preparingAt,
    deliveryStartedAt: input.status === 'delivery' ? now : input.deliveryStartedAt,
    deliveredAt: input.status === 'delivered' ? now : input.deliveredAt,
    cancelledAt: input.status === 'cancelled' ? now : input.cancelledAt,
    paymentConfirmedAt: input.paymentStatus === 'paid' ? now : input.paymentConfirmedAt
  });
  const payload = {
    orderNumber: input.orderNumber || orderNumber(), userId: input.userId || null, userEmail: input.userEmail || null, userName: input.userName || '', customerPhone: input.customerPhone || '',
    deliveryAddress: input.deliveryAddress || '', deliveryCity: input.deliveryCity || '', deliveryRoom: input.deliveryRoom || '', deliveryArea: meta.deliveryArea,
    deliveryFee, estimatedDeliveryMinutes: hasDistanceQuote ? meta.estimatedDeliveryMinutes : (input.estimatedDeliveryMinutes !== undefined ? i(input.estimatedDeliveryMinutes) : meta.estimatedDeliveryMinutes), notes: input.notes || '', adminNote: input.adminNote || '',
    paymentMethod: input.paymentMethod || 'cash', paymentStatus: input.paymentStatus || 'pending', paymentReference: input.paymentReference || '', status: input.status || 'pending', isGuestOrder: !!input.isGuestOrder,
    customerLatitude: meta.customerLatitude ?? null, customerLongitude: meta.customerLongitude ?? null, deliveryDistanceKm: meta.deliveryDistanceKm ?? 0,
    deliveryMapUrl: mapUrl, subtotalAmount, totalAmount, createdAt: now, updatedAt: now, ...statusTimestamps
  };
  if (useDb) {
    const client = await getPool().connect();
    try {
      await client.query('begin');
      const { rows } = await client.query('insert into orders (order_number,user_id,user_email,user_name,customer_phone,delivery_address,delivery_city,delivery_room,delivery_area,delivery_fee,estimated_delivery_minutes,notes,admin_note,payment_method,payment_status,payment_reference,customer_latitude,customer_longitude,delivery_distance_km,delivery_map_url,status,is_guest_order,subtotal_amount,total_amount,created_at,updated_at,confirmed_at,preparing_at,delivery_started_at,delivered_at,cancelled_at,payment_confirmed_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,now(),now(),$25,$26,$27,$28,$29,$30) returning *', [payload.orderNumber, payload.userId, payload.userEmail, payload.userName, payload.customerPhone, payload.deliveryAddress, payload.deliveryCity, payload.deliveryRoom, payload.deliveryArea, payload.deliveryFee, payload.estimatedDeliveryMinutes, payload.notes, payload.adminNote, payload.paymentMethod, payload.paymentStatus, payload.paymentReference, payload.customerLatitude, payload.customerLongitude, payload.deliveryDistanceKm, payload.deliveryMapUrl, payload.status, payload.isGuestOrder, payload.subtotalAmount, payload.totalAmount, payload.confirmedAt, payload.preparingAt, payload.deliveryStartedAt, payload.deliveredAt, payload.cancelledAt, payload.paymentConfirmedAt]);
      const order = rows[0];
      for (const item of items) {
        await client.query('insert into order_items (order_id,product_id,product_name,product_price,quantity,subtotal,image,unit) values ($1,$2,$3,$4,$5,$6,$7,$8)', [order.id, item.productId || item.id || null, item.productName || item.name || 'Item', n(item.productPrice ?? item.price), i(item.quantity ?? item.qty, 1), n(item.subtotal), item.image || '', item.unit || 'item']);
        if (item.productId || item.id) await client.query('update products set stock = greatest(stock - $2, 0), updated_at=now() where id=$1', [item.productId || item.id, i(item.quantity ?? item.qty, 1)]);
      }
      await client.query('commit');
      return mapOrder(order, items.map(item => ({ productId: item.productId || item.id || null, productName: item.productName || item.name || 'Item', productPrice: n(item.productPrice ?? item.price), quantity: i(item.quantity ?? item.qty, 1), subtotal: n(item.subtotal), image: item.image || '', unit: item.unit || 'item' })));
    } catch (error) {
      await client.query('rollback'); throw error;
    } finally { client.release(); }
  }
  const orders = await readJson(filePaths.orders); const products = await readJson(filePaths.products); const nextId = orders.length ? Math.max(...orders.map(o => i(o.id))) + 1 : 1;
  for (const item of items) {
    const index = products.findIndex(p => idEq(p.id, item.productId || item.id));
    if (index >= 0) { products[index].stock = Math.max(0, i(products[index].stock) - i(item.quantity ?? item.qty, 1)); products[index].updatedAt = now; }
  }
  const created = { id: nextId, ...payload, items };
  orders.push(created); await writeJson(filePaths.orders, orders); await writeJson(filePaths.products, products); return mapOrder(created, items);
}

async function getOrders(opts = {}) {
  await initStorage();
  const isAdmin = opts.isAdmin === true; const userId = opts.userId ?? null; const status = opts.status ? String(opts.status).toLowerCase() : null; const search = opts.search ? String(opts.search).toLowerCase() : null;
  if (useDb) {
    const params = []; const where = [];
    if (!isAdmin && userId !== null) { params.push(i(userId)); where.push(`user_id = $${params.length}`); }
    if (status && status !== 'all') { params.push(status); where.push(`lower(status) = $${params.length}`); }
    if (search) { params.push(`%${search}%`); where.push(`(lower(order_number) like $${params.length} or lower(user_name) like $${params.length} or lower(customer_phone) like $${params.length})`); }
    const sql = `select * from orders ${where.length ? `where ${where.join(' and ')}` : ''} order by created_at desc`;
    const { rows } = await getPool().query(sql, params); const ids = rows.map(r => r.id); const itemMap = new Map();
    if (ids.length) {
      const items = await getPool().query('select * from order_items where order_id = any($1::bigint[]) order by id', [ids]);
      for (const row of items.rows) {
        const list = itemMap.get(row.order_id) || []; list.push({ productId: row.product_id, productName: row.product_name, productPrice: n(row.product_price), quantity: i(row.quantity, 1), subtotal: n(row.subtotal), image: row.image || '', unit: row.unit || 'item' }); itemMap.set(row.order_id, list);
      }
    }
    return rows.map(row => mapOrder(row, itemMap.get(row.id) || []));
  }
  let orders = await readJson(filePaths.orders);
  if (!isAdmin && userId !== null) orders = orders.filter(o => idEq(o.userId, userId));
  if (status && status !== 'all') orders = orders.filter(o => String(o.status).toLowerCase() === status);
  if (search) orders = orders.filter(o => [o.orderNumber, o.userName, o.customerPhone].join(' ').toLowerCase().includes(search));
  return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(o => mapOrder(o, o.items || []));
}

async function getOrderById(id) { return (await getOrders({ isAdmin: true })).find(o => idEq(o.id, id) || idEq(o.orderNumber, id)) || null; }

async function updateOrderStatus(id, updates) {
  const existing = await getOrderById(id); if (!existing) return null;
  const now = new Date().toISOString();
  const nextStatus = updates.status || existing.status;
  const nextPaymentStatus = updates.paymentStatus || existing.paymentStatus;
  const nextAdminNote = updates.adminNote !== undefined ? String(updates.adminNote || '') : (existing.adminNote || '');
  const nextPaymentReference = updates.paymentReference !== undefined ? String(updates.paymentReference || '') : (existing.paymentReference || '');
  const shouldRestoreStock = existing.status !== 'cancelled' && nextStatus === 'cancelled';
  const timestamps = {
    confirmedAt: existing.confirmedAt,
    preparingAt: existing.preparingAt,
    deliveryStartedAt: existing.deliveryStartedAt,
    deliveredAt: existing.deliveredAt,
    cancelledAt: existing.cancelledAt,
    paymentConfirmedAt: existing.paymentConfirmedAt
  };
  if (nextStatus === 'confirmed' && !timestamps.confirmedAt) timestamps.confirmedAt = now;
  if (nextStatus === 'preparing' && !timestamps.preparingAt) timestamps.preparingAt = now;
  if (nextStatus === 'delivery' && !timestamps.deliveryStartedAt) timestamps.deliveryStartedAt = now;
  if (nextStatus === 'delivered') timestamps.deliveredAt = now;
  if (nextStatus === 'cancelled') timestamps.cancelledAt = now;
  if (nextPaymentStatus === 'paid' && !timestamps.paymentConfirmedAt) timestamps.paymentConfirmedAt = now;
  if (useDb) {
    const client = await getPool().connect();
    try {
      await client.query('begin');
      const { rows } = await client.query('update orders set status=$2, payment_status=$3, updated_at=now(), confirmed_at=$4, preparing_at=$5, delivery_started_at=$6, delivered_at=$7, cancelled_at=$8, payment_confirmed_at=$9, admin_note=$10, payment_reference=$11 where id=$1 returning *', [i(existing.id), nextStatus, nextPaymentStatus, timestamps.confirmedAt, timestamps.preparingAt, timestamps.deliveryStartedAt, timestamps.deliveredAt, timestamps.cancelledAt, timestamps.paymentConfirmedAt, nextAdminNote, nextPaymentReference]);
      if (shouldRestoreStock) {
        for (const item of existing.items || []) {
          if (item.productId) await client.query('update products set stock = stock + $2, updated_at=now() where id=$1', [i(item.productId), i(item.quantity, 1)]);
        }
      }
      await client.query('commit');
      return mapOrder(rows[0], existing.items || []);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
  const orders = await readJson(filePaths.orders);
  const index = orders.findIndex(o => idEq(o.id, existing.id));
  orders[index] = { ...orders[index], status: nextStatus, paymentStatus: nextPaymentStatus, adminNote: nextAdminNote, paymentReference: nextPaymentReference, updatedAt: now, ...timestamps };
  if (shouldRestoreStock) {
    const products = await readJson(filePaths.products);
    for (const item of existing.items || []) {
      const productIndex = products.findIndex(product => idEq(product.id, item.productId));
      if (productIndex >= 0) {
        products[productIndex].stock = i(products[productIndex].stock) + i(item.quantity, 1);
        products[productIndex].updatedAt = now;
      }
    }
    await writeJson(filePaths.products, products);
  }
  await writeJson(filePaths.orders, orders);
  return mapOrder(orders[index], orders[index].items || []);
}
async function getOrderStats() {
  const orders = await getOrders({ isAdmin: true });
  return {
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    activeOrders: orders.filter(o => ['confirmed', 'preparing', 'delivery'].includes(o.status)).length,
    deliveredOrders: orders.filter(o => o.status === 'delivered').length,
    revenue: orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + n(o.totalAmount), 0)
  };
}

function suggestedRestock(stock) {
  const current = i(stock);
  if (current <= 0) return 24;
  if (current <= 3) return 20;
  if (current <= 6) return 16;
  return 12;
}

function normalizeRange(range) {
  if (range === '7d') return 7;
  if (range === '30d') return 30;
  return 0;
}

async function getInventoryAlerts() {
  const products = await getProducts({ includeInactive: true, includeOutOfStock: true, admin: true });
  const active = products.filter(product => product.isActive !== false);
  const outOfStock = active
    .filter(product => i(product.stock) <= 0)
    .map(product => ({ ...product, alert: 'out_of_stock', suggestedRestock: suggestedRestock(product.stock) }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const lowStock = active
    .filter(product => i(product.stock) > 0 && i(product.stock) <= LOW_STOCK_THRESHOLD)
    .map(product => ({ ...product, alert: 'low_stock', suggestedRestock: suggestedRestock(product.stock) }))
    .sort((a, b) => i(a.stock) - i(b.stock) || String(a.name).localeCompare(String(b.name)));
  return {
    summary: {
      lowStock: lowStock.length,
      outOfStock: outOfStock.length,
      totalAlerts: lowStock.length + outOfStock.length
    },
    lowStock,
    outOfStock
  };
}

async function getSalesReport(range = '30d') {
  const days = normalizeRange(range);
  const products = await getProducts({ includeInactive: true, includeOutOfStock: true, admin: true });
  const productMap = new Map(products.map(product => [String(product.id), product]));
  const allOrders = await getOrders({ isAdmin: true });
  const cutoff = days > 0 ? Date.now() - (days * 24 * 60 * 60 * 1000) : 0;
  const orders = allOrders.filter(order => {
    const createdAt = new Date(order.createdAt || 0).getTime();
    return !Number.isNaN(createdAt) && (days === 0 || createdAt >= cutoff);
  });

  const totals = {
    orders: orders.length,
    completedRevenue: orders.filter(order => order.status !== 'cancelled').reduce((sum, order) => sum + n(order.totalAmount), 0),
    averageOrderValue: orders.length ? orders.reduce((sum, order) => sum + n(order.totalAmount), 0) / orders.length : 0,
    deliveredOrders: orders.filter(order => order.status === 'delivered').length,
    cancelledOrders: orders.filter(order => order.status === 'cancelled').length
  };

  const categoryRevenueMap = new Map();
  const paymentMap = new Map();
  const topProductsMap = new Map();
  const dailySalesMap = new Map();

  orders.forEach(order => {
    const dayKey = String(order.createdAt || '').slice(0, 10) || 'unknown';
    dailySalesMap.set(dayKey, (dailySalesMap.get(dayKey) || 0) + n(order.totalAmount));
    paymentMap.set(order.paymentMethod || 'cash', (paymentMap.get(order.paymentMethod || 'cash') || 0) + n(order.totalAmount));

    (order.items || []).forEach(item => {
      const product = productMap.get(String(item.productId || ''));
      const category = product?.category || 'uncategorized';
      categoryRevenueMap.set(category, (categoryRevenueMap.get(category) || 0) + n(item.subtotal));

      const key = String(item.productId || item.productName || 'item');
      const existing = topProductsMap.get(key) || { name: item.productName || 'Unknown Item', qty: 0, revenue: 0 };
      existing.qty += i(item.quantity, 0);
      existing.revenue += n(item.subtotal);
      topProductsMap.set(key, existing);
    });
  });

  return {
    range,
    totals,
    categoryRevenue: Array.from(categoryRevenueMap.entries()).map(([category, revenue]) => ({ category, revenue })).sort((a, b) => b.revenue - a.revenue),
    paymentBreakdown: Array.from(paymentMap.entries()).map(([method, revenue]) => ({ method, revenue })).sort((a, b) => b.revenue - a.revenue),
    dailySales: Array.from(dailySalesMap.entries()).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => String(a.date).localeCompare(String(b.date))),
    topProducts: Array.from(topProductsMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8)
  };
}

module.exports = { initStorage, getStorageMode, deliveryMeta, orderNumber, getProducts, getProductById, getProductStats, createProduct, updateProduct, bulkUpsertProducts, deleteProduct, getUsers, getUserByEmail, getUserById, createUser, updateUser, createOrder, getOrders, getOrderById, updateOrderStatus, getOrderStats, getInventoryAlerts, getSalesReport, LOW_STOCK_THRESHOLD };





