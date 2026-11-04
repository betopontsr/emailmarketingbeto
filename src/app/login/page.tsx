import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border p-6">
        <div>
          <h1 className="text-lg font-semibold">Funil 11:22</h1>
          <p className="text-sm text-muted-foreground">Entre para acessar o painel.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
