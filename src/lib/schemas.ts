// Example target schemas: what an app might want from a file its users upload.
// Each has two halves: the ImportSchema (field names, aliases, required, forced
// types) used for column mapping, and a Zod object used for row validation.
// `zodSource` is the same Zod object as text, for the page and the code generator.
import { z } from 'zod';
import type { ImportSchema } from 'react-data-import';

// The CSP has no 'unsafe-eval': tell Zod not to try its JIT (new Function).
z.config({ jitless: true });

export interface ExampleSchema {
  id: string;
  label: string;
  description: string;
  /** Interface name used in generated code. */
  typeName: string;
  /** Variable name of the ImportSchema in generated code. */
  schemaName: string;
  importSchema: ImportSchema;
  zod: z.ZodType<Record<string, unknown>>;
  zodSource: string;
}

const contactsZod = z.object({
  name: z.string({ error: 'Name is empty' }).trim().min(1, 'Name is empty'),
  email: z.email('Not an e-mail address'),
  joined: z.date().nullable(),
  amount: z.number().nonnegative('Amount is negative').nullable(),
});

const ordersZod = z.object({
  orderId: z.string().min(1, 'Order ID is empty'),
  date: z.date({ error: 'Not a date' }),
  customer: z.string().nullable(),
  quantity: z.number({ error: 'Quantity is not a number' }).int('Quantity is not a whole number').positive('Quantity must be at least 1'),
  unitPrice: z.number({ error: 'Price is not a number' }).nonnegative('Price is negative'),
  status: z.enum(['pending', 'paid', 'shipped', 'cancelled'], { error: 'Unknown status' }).nullable(),
});

const productsZod = z.object({
  sku: z.string().regex(/^[A-Z]{3}-\d{4}$/, 'SKU must look like ABC-1234'),
  name: z.string({ error: 'Name is empty' }).min(1, 'Name is empty'),
  price: z.number().positive('Price must be above 0').nullable(),
  stock: z.number().int('Stock is not a whole number').nonnegative('Stock is negative').nullable(),
  active: z.boolean().nullable(),
});

export const SCHEMAS: readonly ExampleSchema[] = [
  {
    id: 'contacts',
    label: 'Contacts',
    description: 'name, email (required), joined date, amount',
    typeName: 'Contact',
    schemaName: 'contacts',
    importSchema: {
      fields: {
        name: { aliases: ['Full name', 'Contact'] },
        email: { aliases: ['E-mail', 'Email address', 'Mail'], required: true },
        joined: { aliases: ['Joined', 'Start date', 'Since'], type: 'date' },
        amount: { aliases: ['Total', 'Balance'], type: 'number' },
      },
    },
    zod: contactsZod,
    zodSource: `z.object({
  name: z.string({ error: 'Name is empty' }).trim().min(1, 'Name is empty'),
  email: z.email('Not an e-mail address'),
  // An optional field that is not mapped is null in every row.
  joined: z.date().nullable(),
  amount: z.number().nonnegative('Amount is negative').nullable(),
})`,
  },
  {
    id: 'orders',
    label: 'Orders',
    description: 'order ID, date, customer, quantity, unit price, status',
    typeName: 'Order',
    schemaName: 'orders',
    importSchema: {
      fields: {
        orderId: { aliases: ['Order ID', 'Order #', 'Order no'], required: true, type: 'string' },
        date: { aliases: ['Order date'], required: true, type: 'date' },
        customer: { aliases: ['Client', 'Buyer'] },
        quantity: { aliases: ['Qty', 'Units'], required: true, type: 'number' },
        unitPrice: { aliases: ['Unit price', 'Price'], required: true, type: 'number' },
        status: { aliases: ['State'] },
      },
    },
    zod: ordersZod,
    zodSource: `z.object({
  orderId: z.string().min(1, 'Order ID is empty'),
  date: z.date({ error: 'Not a date' }),
  customer: z.string().nullable(),
  quantity: z.number({ error: 'Quantity is not a number' }).int('Quantity is not a whole number').positive('Quantity must be at least 1'),
  unitPrice: z.number({ error: 'Price is not a number' }).nonnegative('Price is negative'),
  status: z.enum(['pending', 'paid', 'shipped', 'cancelled'], { error: 'Unknown status' }).nullable(),
})`,
  },
  {
    id: 'products',
    label: 'Products',
    description: 'SKU (required), name (required), price, stock, active',
    typeName: 'Product',
    schemaName: 'products',
    importSchema: {
      fields: {
        sku: { aliases: ['SKU', 'Item code', 'Product code'], required: true, type: 'string' },
        name: { aliases: ['Product', 'Title'], required: true },
        price: { aliases: ['Unit price'], type: 'number' },
        stock: { aliases: ['On hand', 'Inventory'], type: 'number' },
        active: { aliases: ['Enabled', 'Listed'], type: 'boolean' },
      },
    },
    zod: productsZod,
    zodSource: `z.object({
  sku: z.string().regex(/^[A-Z]{3}-\\d{4}$/, 'SKU must look like ABC-1234'),
  name: z.string({ error: 'Name is empty' }).min(1, 'Name is empty'),
  price: z.number().positive('Price must be above 0').nullable(),
  stock: z.number().int('Stock is not a whole number').nonnegative('Stock is negative').nullable(),
  active: z.boolean().nullable(),
})`,
  },
];

export function schemaById(id: string | null | undefined): ExampleSchema {
  return SCHEMAS.find((s) => s.id === id) ?? SCHEMAS[0]!;
}
