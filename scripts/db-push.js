const { execSync } = require('child_process');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';

console.log(`[db-push] Using DATABASE_URL: ${process.env.DATABASE_URL}`);
execSync('npx prisma db push --schema=packages/database/prisma/schema.prisma', { stdio: 'inherit', env: process.env });
