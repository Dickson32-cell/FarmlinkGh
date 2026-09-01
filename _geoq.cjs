
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const u = await p.user.findUnique({ where: { phone: '0245222001' }, include: { buyer: true } });
  console.log(JSON.stringify(u ? { id: u.id, status: u.status, buyer: u.buyer } : null));
  await p.$disconnect();
})();
