import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Button } from './ui/button';
import { LogIn, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    }
  };

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border border-zinc-200 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">Supabase Configuration Required</h2>
          <p className="text-zinc-600 mb-6">
            Please configure your Supabase URL and Anon Key in the <code className="bg-zinc-100 px-1 py-0.5 rounded">.env</code> file to enable authentication and database features. Make sure the URL includes <code className="bg-zinc-100 px-1 py-0.5 rounded">https://</code>.
          </p>
          <div className="text-left bg-zinc-50 p-4 rounded-md text-sm text-zinc-700 font-mono overflow-x-auto">
            VITE_SUPABASE_URL="https://your-project.supabase.co"<br/>
            VITE_SUPABASE_ANON_KEY="your-anon-key"
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-zinc-100 text-center"
      >
        <div className="w-16 h-16 bg-zinc-900 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">LeadGen AI</h1>
        <p className="text-zinc-500 mb-8">Sign in to start generating high-quality business leads on autopilot.</p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
            {error}
          </div>
        )}

        <Button 
          onClick={handleLogin} 
          className="w-full h-12 text-base flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>
      </motion.div>
    </div>
  );
}
