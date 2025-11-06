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
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});
type FormValues = z.infer<typeof schema>;

export default function Signup() {
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
        name: data.name,
        email: data.email,
        interests: [],
      });
      notify('Signed up (dev bypass)', 'success');
      navigate('/matches');
      return;
    }
    try {
      const res = await api.post('/auth/signup', data);
      const { access_token, user } = res.data;
      login(access_token, user);
      notify('Account created!', 'success');
      navigate('/profile');
    } catch (err: any) {
      if (import.meta.env.DEV) {
        login('dev-bypass-token', {
          id: 'dev-user',
          name: data.name,
          email: data.email,
          interests: [],
        });
        notify('Signed up (dev fallback)', 'success');
        navigate('/matches');
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
      <p className="mt-3 text-sm text-gray-600">Have an account? <Link to="/login" className="text-blue-600 underline">Log in</Link></p>
    </div>
  );
}
