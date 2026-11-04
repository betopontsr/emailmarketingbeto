// Uso: node scripts/hash-password.mjs 'minha senha forte'
import bcrypt from "bcryptjs";

const pwd = process.argv[2];
if (!pwd || pwd.length < 10) {
  console.error("Informe uma senha com pelo menos 10 caracteres: node scripts/hash-password.mjs 'sua senha'");
  process.exit(1);
}
const hash = bcrypt.hashSync(pwd, 12);
console.log("Na Vercel (Settings → Environment Variables), cole exatamente:");
console.log(hash);
console.log("");
console.log("No arquivo .env local, use esta linha (os $ precisam de barra invertida):");
console.log(`ADMIN_PASSWORD_HASH=${hash.replace(/\$/g, "\\$")}`);
