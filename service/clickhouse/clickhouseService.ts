import { createClient } from '@clickhouse/client';

export const client = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: 'default',          
    password: '',                
    database: 'default',
})