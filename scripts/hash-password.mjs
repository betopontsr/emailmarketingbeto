// Uso: node scripts/hash-password.mjs 'minha senha forte'
// Copie o resultado para ADMIN_PASSWORD_HASH (no .env local ou na Vercel).
import bcrypt from "bcryptjs";

const pwd = process.argv[2];
if (!pwd || pwd.length < 10) {
  console.error("Informe uma senha com pelo menos 10 caracteres: node scripts/hash-password.mjs 'sua senha'");
  process.exit(1);
}
console.log(bcrypt.hashSync(pwd, 12));
