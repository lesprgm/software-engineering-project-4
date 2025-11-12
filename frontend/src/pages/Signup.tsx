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
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});
type FormValues = z.infer<typeof schema>;

export default function Signup() {
  const navigate = useViewNavigate();
  const { notify } = useToast();
  const login = useAuthStore((s) => s.login);
  useBreadcrumb('Signup');
  const env = getRuntimeEnv();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const handleDevSignup = async (data: FormValues) => {
    try {
      const profile = await usersService.createProfile({
        email: data.email,
        displayName: data.name,
        password: data.password,
      });
      login(profile.id, mapProfileToAuthUser(profile));
      notify('Signed up (dev bypass)', 'success');
      navigate('/matches');
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        notify(error.response?.data?.detail || 'Signup failed', 'error');
      } else {
        notify('Signup failed', 'error');
      }
    }
  };

  const onSubmit = async (data: FormValues) => {
    const bypass = env.DEV && env.VITE_BYPASS_AUTH === '1';
    if (bypass) {
      await handleDevSignup(data);
      return;
    }
    try {
      const res = await api.post('/auth/signup', {
        email: data.email,
        display_name: data.name,
        password: data.password,
      });
      const { access_token, user } = res.data;
      const profile = normalizeUserProfile(user);
      login(access_token, mapProfileToAuthUser(profile));
      notify('Account created!', 'success');
      navigate('/profile');
    } catch (err: any) {
      if (env.DEV) {
        await handleDevSignup(data);
        return;
      }
      notify(err?.response?.data?.detail || 'Signup failed', 'error');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Create account</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-label="Signup form">
        <Input label="Name" {...register('name')} error={errors.name?.message} />
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Input label="Password" type="password" {...register('password')} error={errors.password?.message} />
        <Button type="submit" loading={isSubmitting} aria-label="Submit signup">Sign up</Button>
      </form>
      <p className="mt-3 text-sm text-gray-600">
        Have an account?{' '}
        <ViewTransitionLink to="/login" className="text-blue-600 underline">
          Log in
        </ViewTransitionLink>
      </p>
    </div>
  );
}
