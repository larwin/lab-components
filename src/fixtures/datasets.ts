import { createRng, intBetween, floatBetween, maybe, pick, type Rng } from "./random";
import type { Order, Product, Status, User } from "./types";

const FIRST = [
  "Ava", "Liam", "Noah", "Emma", "Mia", "Kai", "Zoe", "Leo", "Aria", "Eli",
  "Maya", "Ivan", "Nina", "Omar", "Sara", "Theo", "Lena", "Cruz", "Iris", "Reza",
];
const LAST = [
  "Carter", "Singh", "Nguyen", "Garcia", "Khan", "Patel", "Rossi", "Cohen",
  "Yamada", "Mbeki", "Lindqvist", "Okafor", "Petrova", "Haddad", "Müller",
];
const TEAMS = ["Platform", "Growth", "Design", "Data", "Infra", "Mobile", "Research"];
const ROLES: User["role"][] = ["admin", "editor", "viewer"];
const STATUSES: Status[] = ["active", "pending", "inactive"];

const CATEGORIES = ["Audio", "Display", "Input", "Storage", "Network", "Power", "Cooling"];
const PRODUCT_NOUNS = ["Hub", "Switch", "Array", "Module", "Adapter", "Dock", "Sensor", "Node"];
const PRODUCT_ADJ = ["Quantum", "Nano", "Apex", "Flux", "Vertex", "Orbit", "Pulse", "Halo"];

const CHANNELS: Order["channel"][] = ["web", "mobile", "in-store", "api"];
const ORDER_STATUSES: Order["status"][] = ["paid", "refunded", "processing", "cancelled"];

const pad = (n: number, len: number): string => n.toString().padStart(len, "0");

const dateOffset = (rng: Rng, maxDaysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - intBetween(rng, 0, maxDaysAgo));
  return d.toISOString();
};

export function generateUsers(count: number, seed = 1): User[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, (_, i) => {
    const first = pick(rng, FIRST);
    const last = pick(rng, LAST);
    const name = `${first} ${last}`;
    return {
      id: `usr_${pad(i + 1, 6)}`,
      name,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@forge.dev`,
      role: pick(rng, ROLES),
      status: pick(rng, STATUSES),
      team: pick(rng, TEAMS),
      signupDate: dateOffset(rng, 720),
      lastActive: dateOffset(rng, 30),
      score: intBetween(rng, 0, 100),
    };
  });
}

export function generateProducts(count: number, seed = 2): Product[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, (_, i) => {
    const name = `${pick(rng, PRODUCT_ADJ)} ${pick(rng, PRODUCT_NOUNS)}`;
    return {
      id: `prd_${pad(i + 1, 6)}`,
      name,
      sku: `${pick(rng, CATEGORIES).slice(0, 3).toUpperCase()}-${pad(i + 1, 5)}`,
      category: pick(rng, CATEGORIES),
      price: Number(floatBetween(rng, 9, 1999).toFixed(2)),
      stock: maybe(rng, 0.1) ? 0 : intBetween(rng, 1, 5000),
      rating: Number(floatBetween(rng, 2.5, 5).toFixed(1)),
      status: pick(rng, STATUSES),
    };
  });
}

export function generateOrders(count: number, seed = 3): Order[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, (_, i) => {
    const items = intBetween(rng, 1, 12);
    return {
      id: `ord_${pad(i + 1, 6)}`,
      reference: `#${pad(intBetween(rng, 1000, 999999), 6)}`,
      customer: `${pick(rng, FIRST)} ${pick(rng, LAST)}`,
      total: Number((items * floatBetween(rng, 12, 240)).toFixed(2)),
      items,
      status: pick(rng, ORDER_STATUSES),
      channel: pick(rng, CHANNELS),
      createdAt: dateOffset(rng, 365),
    };
  });
}

/** Memoized accessor so large datasets are generated only once per size. */
function memoize<T>(factory: (size: number) => T[]) {
  const cache = new Map<number, T[]>();
  return (size: number): T[] => {
    const existing = cache.get(size);
    if (existing) return existing;
    const value = factory(size);
    cache.set(size, value);
    return value;
  };
}

export const getUsers = memoize((size) => generateUsers(size));
export const getProducts = memoize((size) => generateProducts(size));
export const getOrders = memoize((size) => generateOrders(size));
