import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
type FormValues = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const login = useAuthStore((s) => s.login);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    const bypass = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === '1';
    if (bypass) {
      login('dev-bypass-token', {
        id: 'dev-user',
        name: data.email.split('@')[0] || 'Dev User',
        email: data.email,
        interests: ['Tech', 'Music'],
      });
      notify('Logged in (dev bypass)', 'success');
      navigate('/matches');
      return;
    }
    try {
      const res = await api.post('/auth/login', data);
      const { access_token, user } = res.data;
      login(access_token, user);
      notify('Welcome back!', 'success');
      navigate('/matches');
    } catch (err: any) {
      if (import.meta.env.DEV) {
        // Fallback: if backend is down in dev, allow bypass automatically
        login('dev-bypass-token', {
          id: 'dev-user',
          name: data.email.split('@')[0] || 'Dev User',
          email: data.email,
          interests: ['Tech', 'Music'],
        });
        notify('Logged in (dev fallback)', 'success');
        navigate('/matches');
        return;
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
      <p className="mt-3 text-sm text-gray-600">No account? <Link to="/signup" className="text-blue-600 underline">Sign up</Link></p>
    </div>
  );
}
