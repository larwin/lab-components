/** Shared domain types for demo datasets. */

export type Status = "active" | "pending" | "inactive";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  status: Status;
  team: string;
  signupDate: string;
  lastActive: string;
  score: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
  status: Status;
}

export interface Order {
  id: string;
  reference: string;
  customer: string;
  total: number;
  items: number;
  status: "paid" | "refunded" | "processing" | "cancelled";
  channel: "web" | "mobile" | "in-store" | "api";
  createdAt: string;
}
