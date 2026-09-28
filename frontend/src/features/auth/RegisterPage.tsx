import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { errorMessage } from '@/services/http';
import { useRegister } from './api';
import { AuthLayout } from './AuthLayout';
import { FormAlert } from './FormAlert';
import { PasswordToggle } from './PasswordToggle';
import { PASSWORD_MIN, registerSchema, type RegisterValues } from './schemas';

export function RegisterPage() {
  const navigate = useNavigate();
  const registerUser = useRegister();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => {
    registerUser.mutate(values, {
      onSuccess: () => navigate('/app', { replace: true }),
      onError: (error) => {
        // Map server-side field errors (e.g. a password the server rejects) onto the inputs.
        for (const fe of error.fieldErrors) {
          if (fe.field === 'email' || fe.field === 'password' || fe.field === 'displayName') {
            setError(fe.field, { message: fe.message });
          }
        }
      },
    });
  });

  let formError: string | null = null;
  if (registerUser.error) {
    if (registerUser.error.status === 409) {
      formError = 'An account with this email may already exist. Try logging in instead.';
    } else if (registerUser.error.fieldErrors.length === 0) {
      formError = errorMessage(registerUser.error);
    }
  }

  return (
    <AuthLayout
      title="Create your NOVA account"
      subtitle="Classes, deadlines, grades and your developer growth, in one place."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-ink underline underline-offset-4">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        {formError && <FormAlert message={formError} />}
        <Field
          label="What should we call you?"
          autoComplete="nickname"
          error={errors.displayName?.message}
          {...register('displayName')}
        />
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
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN} characters. A short phrase works well.`}
          error={errors.password?.message}
          trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
          {...register('password')}
        />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={registerUser.isPending}
          className="mt-1 w-full"
        >
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
