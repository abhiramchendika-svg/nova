import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { errorMessage } from '@/services/http';
import { useLogin } from './api';
import { AuthLayout } from './AuthLayout';
import { FormAlert } from '@/components/patterns/FormAlert';
import { usePrefetchPages } from '@/app/prefetch';
import { TryDemoButton } from '@/features/demo/TryDemoButton';
import { PasswordToggle } from './PasswordToggle';
import { loginSchema, safeNextPath, type LoginValues } from './schemas';
import { useWakeServer } from './wake';

export function LoginPage() {
  useWakeServer();
  // Most visits here end in the app: fetch its code while the form is being filled in
  usePrefetchPages('AppShell', 'HomePage');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, { onSuccess: () => navigate(next, { replace: true }) });
  });

  // One generic message for bad email *or* bad password, so the form can't reveal which accounts exist.
  const formError = login.error
    ? login.error.status === 401
      ? 'That email and password don’t match. Check both and try again.'
      : errorMessage(login.error)
    : null;

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to see what needs you today."
      footer={
        <>
          New to NOVA?{' '}
          <Link to="/register" className="font-medium text-ink underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        {formError && <FormAlert message={formError} />}
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Field
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          error={errors.password?.message}
          trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
          {...register('password')}
        />
        <Button type="submit" variant="primary" size="lg" loading={login.isPending} className="mt-1 w-full">
          Log in
        </Button>
      </form>
      <div className="mt-6 grid gap-3 border-t border-line pt-6">
        <p className="text-center text-[13px] text-ink-3">
          Just looking? Try NOVA with made-up data, no sign-up needed.
        </p>
        <TryDemoButton className="w-full" />
      </div>
    </AuthLayout>
  );
}
