#!/usr/bin/env node
(async () => {
  const has = (dep) => {
    try { require.resolve(dep, { paths: [process.cwd()] }); return true; }
    catch { return false; }
  };

  const url = process.env.DATABASE_URL || process.env.DB_URL || '';
  if (!url) {
    console.log('ℹ️ No DATABASE_URL/DB_URL set; skipping DB smoke test.');
    process.exit(0);
  }

  try {
    if (has('@prisma/client')) {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
      console.log('✅ Prisma DB connection ok.');
      process.exit(0);
    }
    if (has('mongoose')) {
      const mongoose = require('mongoose');
      await mongoose.connect(url, { serverSelectionTimeoutMS: 4000 });
      await mongoose.disconnect();
      console.log('✅ Mongoose DB connection ok.');
      process.exit(0);
    }
    if (has('typeorm')) {
      const { DataSource } = require('typeorm');
      const ds = new DataSource({ type: url.startsWith('postgres') ? 'postgres' : 'mysql', url });
      await ds.initialize();
      await ds.destroy();
      console.log('✅ TypeORM DB connection ok.');
      process.exit(0);
    }
    console.log('ℹ️ No supported ORM detected; skipping DB smoke test.');
    process.exit(0);
  } catch (e) {
    console.error('❌ DB connection failed:', e.message);
    process.exit(1);
  }
})();
