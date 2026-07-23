// NextTTS — foydalanuvchi rolini o'rnatish / ko'rish (admin yordamchi)
//
// Foydalanish:
//   node scripts/set-role.mjs                            → barcha foydalanuvchilarni ro'yxatlash
//   node scripts/set-role.mjs <email> <role>             → mavjud foydalanuvchi rolini o'rnatish
//   node scripts/set-role.mjs <email> <role> <parol>     → yo'q bo'lsa, yangi hisob yaratadi
//
// Rollar: "user" | "vip" | "admin"
//
// Misol:
//   node scripts/set-role.mjs nematovdev004@gmail.com vip Parol123!
//
// DATABASE_URL .env'dan o'qiladi.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// .env'ni qo'lda yuklash (node dotenv'ni avtomatik o'qimaydi)
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(join(__dirname, "..", ".env"), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
} catch {
  // .env yo'q bo'lsa — DATABASE_URL muhitdan kelishi mumkin
}

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();

const VALID_ROLES = ["user", "vip", "admin"];

async function main() {
  const [email, role, password] = process.argv.slice(2);

  // Argument yo'q → ro'yxat
  if (!email) {
    const users = await db.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { email: true, name: true, role: true, balance: true, createdAt: true },
    });
    if (users.length === 0) {
      console.log("Hech qanday foydalanuvchi yo'q.");
      return;
    }
    console.log(`\nJami ${users.length} foydalanuvchi:\n`);
    for (const u of users) {
      const tag = u.role === "vip" ? "👑 VIP" : u.role === "admin" ? "🛡  ADMIN" : "   user";
      console.log(
        `  ${tag.padEnd(10)} ${(u.email ?? "—").padEnd(32)} ${u.name ?? ""}`
      );
    }
    console.log(
      `\nRol o'rnatish:  node scripts/set-role.mjs <email> <user|vip|admin>\n`
    );
    return;
  }

  if (!role || !VALID_ROLES.includes(role)) {
    console.error(`❌ Noto'g'ri rol. Ruxsat etilgan: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  const user = await db.user.findUnique({ where: { email } });

  // Yo'q bo'lsa va parol berilgan bo'lsa → yangi hisob yaratamiz
  if (!user) {
    if (!password) {
      console.error(`❌ Foydalanuvchi topilmadi: ${email}`);
      console.error(`   Yangi hisob yaratish uchun parol bering:`);
      console.error(`   node scripts/set-role.mjs ${email} ${role} <parol>`);
      process.exit(1);
    }
    const bcrypt = (await import("bcryptjs")).default;
    const hash = await bcrypt.hash(password, 10);
    const name = email.split("@")[0];
    const created = await db.user.create({
      data: { email, name, password: hash, role, emailVerified: new Date() },
      select: { email: true, role: true },
    });
    const b = role === "vip" ? "👑 VIP" : role === "admin" ? "🛡 ADMIN" : "user";
    console.log(`✅ Yangi hisob yaratildi: ${created.email} → rol: ${b}`);
    console.log(`   Parol: ${password}`);
    console.log(`   Endi /login orqali kiring va profilni ko'ring.`);
    return;
  }

  const updated = await db.user.update({
    where: { email },
    data: { role },
    select: { email: true, role: true },
  });

  const badge = role === "vip" ? "👑 VIP" : role === "admin" ? "🛡 ADMIN" : "user";
  console.log(`✅ ${updated.email} → rol: ${badge}`);
  if (role === "vip" || role === "admin") {
    console.log("   Bu hisob endi cheksiz sintez qiladi (kredit yechilmaydi).");
  }
}

main()
  .catch((e) => {
    console.error("Xato:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
