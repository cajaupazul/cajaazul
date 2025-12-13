'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, EyeOff } from 'lucide-react';

const FACULTADES = [
  'Facultad de Ciencias Empresariales',
  'Facultad de Derecho',
  'Facultad de Economía y Finanzas',
  'Facultad de Ingeniería',
];

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    universidad: 'Universidad Nacional',
    carrera: '',
  });

  useEffect(() => {
    const fetchImage = async () => {
      const { data } = await supabase
        .from('auth_images')
        .select('image_url')
        .eq('image_type', 'register')
        .single();

      if (data?.image_url) {
        setImageUrl(data.image_url);
      }
    };

    fetchImage();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.nombre.trim() || !formData.email.trim() || !formData.password.trim() || !formData.carrera) {
      setError('Por favor completa todos los campos');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            nombre: formData.nombre.trim(),
            universidad: formData.universidad,
            carrera: formData.carrera,
          },
        },
      });

      if (authError) {
        console.error('Auth error:', authError);
        setError(authError.message || 'Error al crear la cuenta');
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Error al crear la cuenta');
        setLoading(false);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            nombre: formData.nombre.trim(),
            email: formData.email.trim(),
            universidad: formData.universidad,
            carrera: formData.carrera,
            avatar_url: null,
            bio: null,
            puntos: 0,
          });

        if (profileError) {
          console.error('Profile error:', profileError);
          setError('Error al crear el perfil: ' + profileError.message);
          setLoading(false);
          return;
        }
      } catch (profileException) {
        console.error('Profile exception:', profileException);
        setError('Error al crear el perfil');
        setLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: formData.password,
      });

      if (signInError) {
        console.error('Sign in error:', signInError);
        router.push('/dashboard');
        return;
      }

      router.push('/dashboard');
    } catch (err) {
      console.error('General error:', err);
      setError('Error en el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Image */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-teal-500 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full"></div>
        </div>
        
        {/* Placeholder Image */}
        <div className="relative z-10 text-center">
          {imageUrl && (
            <img
              src={imageUrl}
              alt="CampusLink"
              className="w-full h-96 object-cover rounded-3xl shadow-2xl"
            />
          )}
          <h2 className="text-white text-3xl font-bold mt-8">CampusLink</h2>
          <p className="text-blue-100 mt-2">Tu plataforma educativa</p>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="w-full lg:w-1/2 bg-white flex flex-col items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Crear Cuenta</h1>
            <p className="text-slate-600">Únete a CampusLink y comienza a colaborar</p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Nombre Completo */}
            <div>
              <Label htmlFor="nombre" className="text-slate-700 font-medium">
                Nombre Completo
              </Label>
              <Input
                id="nombre"
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Juan Pérez"
                className="mt-2 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-slate-700 font-medium">
                Email Universitario
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="tu@up.edu.pe"
                className="mt-2 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            {/* Password */}
            <div>
              <Label htmlFor="password" className="text-slate-700 font-medium">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="mt-2 border-slate-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Facultad */}
            <div>
              <Label htmlFor="carrera" className="text-slate-700 font-medium">
                Facultad *
              </Label>
              <Select value={formData.carrera} onValueChange={(value) => setFormData({ ...formData, carrera: value })}>
                <SelectTrigger className="mt-2 border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Selecciona tu facultad" />
                </SelectTrigger>
                <SelectContent>
                  {FACULTADES.map((fac) => (
                    <SelectItem key={fac} value={fac}>
                      {fac}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sign Up Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg mt-6"
            >
              {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </Button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center text-sm">
            <p className="text-slate-600">
              ¿Ya tienes cuenta?{' '}
              <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}