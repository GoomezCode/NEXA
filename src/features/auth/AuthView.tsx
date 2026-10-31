import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

import { ensureGuest, loginWithPassword, registerAccount } from '@/api/auth';
import { ApiError } from '@/api/client/problem';
import { describeError } from '@/api/errors';
import { NexaMark } from '@/components/brand/NexaMark';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useConnectionStore } from '@/stores/connection-store';

import { fieldErrors, loginSchema, registerSchema } from './schemas';

type Mode = 'login' | 'register';

const REGISTRATION_ENABLED = import.meta.env.VITE_REGISTRATION_ENABLED === 'true';

function Field({
  id,
  label,
  error,
  trailing,
  ...input
}: {
  id: string;
  label: string;
  error?: string;
  trailing?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-2xs text-muted">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            'nexa-field w-full rounded-xl border bg-background/60 px-3 py-2 text-base sm:text-sm text-foreground outline-none transition focus:border-primary/40',
            trailing && 'pr-12',
            error ? 'border-danger/40' : 'border-white/10',
          )}
          {...input}
        />
        {trailing && <div className="absolute right-0 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-2xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function AuthView() {
  const expired = useAuthStore((state) => state.status === 'expired');
  const [mode, setMode] = useState<Mode>('login');
  const [values, setValues] = useState({ username: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const first = ['username', 'email', 'password', 'confirm'].find((field) => errors[field]);
    if (first) document.getElementById(`auth-${first}`)?.focus();
  }, [errors]);

  const change = (key: keyof typeof values) => (event: ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setFormError(null);
  };

  const run = async (action: () => Promise<unknown>) => {
    setFormError(null);
    setBusy(true);

    try {
      await action();
    } catch (error) {
      if (error instanceof ApiError && error.errors?.length) {
        setErrors(
          Object.fromEntries(
            error.errors.map((item) => [item.field.split('.').pop() ?? item.field, item.reason]),
          ),
        );
      }

      setFormError(describeError(error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (mode === 'login') {
      const parsed = loginSchema.safeParse(values);
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        return;
      }

      setErrors({});
      void run(() => loginWithPassword(parsed.data.username, parsed.data.password));
      return;
    }

    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    void run(() =>
      registerAccount({
        username: parsed.data.username,
        email: parsed.data.email || undefined,
        password: parsed.data.password,
      }),
    );
  };

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((current) => !current)}
      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
      className="flex h-11 w-11 items-center justify-center text-muted transition hover:text-primary"
    >
      {showPassword ? (
        <EyeOff className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Eye className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );

  return (
    <main className="fixed inset-0 flex overflow-y-auto bg-background p-4 text-foreground">
      <div className="nexa-grid pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative z-10 m-auto w-full max-w-sm shrink-0 rounded-2xl border border-border bg-surface/70 p-5 backdrop-blur-xl sm:p-6">
        <div className="flex flex-col items-center text-center">
          <NexaMark size={48} />
          <h1 className="mt-3 font-display text-lg tracking-[0.3em] text-foreground">NEXA</h1>
          <p className="font-mono text-2xs uppercase tracking-[0.2em] text-muted">
            acesso à interface neural
          </p>
        </div>

        {expired && (
          <p
            role="status"
            className="mt-4 rounded-xl border border-warning/25 bg-warning/5 p-2.5 text-[12px] text-warning"
          >
            Sua sessão expirou. Entre novamente para continuar.
          </p>
        )}

        <div
          role="tablist"
          aria-label="Acesso"
          className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/5 p-1"
        >
          {(['login', 'register'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`auth-tab-${tab}`}
              aria-selected={mode === tab}
              aria-controls="auth-panel"
              onClick={() => switchMode(tab)}
              className={cn(
                'min-h-11 rounded-lg font-mono text-2xs uppercase tracking-[0.12em] transition',
                mode === tab ? 'bg-primary/15 text-primary' : 'text-muted hover:text-foreground',
              )}
            >
              {tab === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        <form
          id="auth-panel"
          role="tabpanel"
          aria-labelledby={`auth-tab-${mode}`}
          onSubmit={submit}
          noValidate
          className="mt-4 space-y-3"
        >
          {mode === 'register' && !REGISTRATION_ENABLED ? (
            <p className="rounded-xl border border-white/10 bg-background/40 p-3 text-[12px] leading-relaxed text-muted">
              O cadastro público ainda não está disponível nesta API. Peça uma conta ao
              administrador ou continue como convidado.
            </p>
          ) : (
            <>
              <Field
                id="auth-username"
                label="Usuário"
                value={values.username}
                onChange={change('username')}
                error={errors.username}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={64}
              />

              {mode === 'register' && (
                <Field
                  id="auth-email"
                  label="E-mail (opcional)"
                  type="email"
                  value={values.email}
                  onChange={change('email')}
                  error={errors.email}
                  autoComplete="email"
                />
              )}

              <Field
                id="auth-password"
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                value={values.password}
                onChange={change('password')}
                error={errors.password}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                maxLength={128}
                trailing={passwordToggle}
              />

              {mode === 'register' && (
                <Field
                  id="auth-confirm"
                  label="Confirmar senha"
                  type={showPassword ? 'text' : 'password'}
                  value={values.confirm}
                  onChange={change('confirm')}
                  error={errors.confirm}
                  autoComplete="new-password"
                  maxLength={128}
                />
              )}

              {formError && (
                <p
                  role="alert"
                  className="rounded-xl border border-danger/25 bg-danger/5 p-2.5 text-[12px] text-danger"
                >
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 font-mono text-2xs uppercase tracking-[0.12em] text-primary transition hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mode === 'login' ? (
                  <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            </>
          )}
        </form>

        <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => ensureGuest())}
            className="min-h-11 w-full rounded-xl border border-white/10 px-3 py-2 font-mono text-2xs uppercase tracking-[0.12em] text-muted transition hover:border-primary/30 hover:text-primary disabled:opacity-50"
          >
            Continuar como convidado
          </button>
          <button
            type="button"
            onClick={() => {
              useSettingsStore.getState().update({ demoMode: true });
              window.location.reload();
            }}
            className="min-h-11 w-full font-mono text-2xs uppercase tracking-[0.12em] text-muted/70 transition hover:text-foreground"
          >
            Usar modo demonstração
          </button>
          <button
            type="button"
            onClick={() => useConnectionStore.getState().setMode('offline')}
            aria-label="Entrar no modo offline com Ollama local"
            className="min-h-11 w-full rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 font-mono text-2xs uppercase tracking-[0.12em] text-primary transition hover:bg-primary/15"
          >
            <span className="block">OFFLINE</span>
            <span className="mt-0.5 block font-sans text-2xs normal-case tracking-normal text-muted">Ollama local · sem API</span>
          </button>
        </div>
      </div>
    </main>
  );
}
