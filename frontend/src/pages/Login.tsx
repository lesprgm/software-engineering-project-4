import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import api from '../lib/api';
import { useAuthStore, mapProfileToAuthUser } from '../store/auth';
import { useToast } from '../components/ToastProvider';
import { ViewTransitionLink } from '../components/navigation/ViewTransitionLink';
import { useViewNavigate } from '../hooks/useViewNavigate';
import { useBreadcrumb } from '../hooks/useBreadcrumb';
import { normalizeUserProfile, usersService } from '../services/users';
import { getRuntimeEnv } from '../lib/env';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
type FormValues = z.infer<typeof schema>;

export default function Login() {
  const navigate = useViewNavigate();
  const { notify } = useToast();
  const login = useAuthStore((s) => s.login);
  useBreadcrumb('Login');
  const env = getRuntimeEnv();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const handleDevBypass = async (payload: FormValues) => {
    const displayName = payload.email.split('@')[0] || 'Dev User';
    try {
      const profile = await usersService.lookup(payload.email);
      login(profile.id, mapProfileToAuthUser(profile));
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        const created = await usersService.createProfile({
          email: payload.email,
          displayName,
          password: payload.password,
        });
        login(created.id, mapProfileToAuthUser(created));
      } else {
        throw error;
      }
    }
    notify('Logged in (dev bypass)', 'success');
    navigate('/matches');
  };

  const onSubmit = async (data: FormValues) => {
    const bypass = env.DEV && env.VITE_BYPASS_AUTH === '1';
    if (bypass) {
      try {
        await handleDevBypass(data);
        return;
      } catch (error: any) {
        notify(error?.response?.data?.detail || 'Dev login failed', 'error');
        return;
      }
    }
    try {
      const res = await api.post('/auth/login', data);
      const { access_token, user } = res.data;
      const profile = normalizeUserProfile(user);
      login(access_token, mapProfileToAuthUser(profile));
      notify('Welcome back!', 'success');
      navigate('/matches');
    } catch (err: any) {
      if (env.DEV) {
        try {
          await handleDevBypass(data);
          return;
        } catch (error: any) {
          notify(error?.response?.data?.detail || 'Login failed', 'error');
          return;
        }
      }
      notify(err?.response?.data?.detail || 'Login failed', 'error');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Log in</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-label="Login form">
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Input label="Password" type="password" {...register('password')} error={errors.password?.message} />
        <Button type="submit" loading={isSubmitting} aria-label="Submit login">Login</Button>
      </form>
      <p className="mt-3 text-sm text-gray-600">
        No account?{' '}
        <ViewTransitionLink to="/signup" className="text-blue-600 underline">
          Sign up
        </ViewTransitionLink>
      </p>
    </div>
  );
}
