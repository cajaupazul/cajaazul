

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-bb-dark flex flex-col items-center justify-center p-4 text-center">
            {/* UI del 404 */}
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-white" />
            <h1 className="text-3xl font-bold text-white mb-2">Página no encontrada</h1>
            <p className="text-gray-400 mb-6">
                La página que buscas no existe o fue movida.
            </p>
            <Link href="/">
                <Button>Volver al inicio</Button>
            </Link>
        </div>
    );
}

