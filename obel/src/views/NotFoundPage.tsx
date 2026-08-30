import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-[8rem] font-black tracking-tighter leading-none bg-linear-to-br from-foreground to-muted-foreground/30 bg-clip-text text-transparent select-none">
          404
        </h1>
        <p className="text-xl font-bold text-foreground mt-2">Page not found</p>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto text-base font-medium">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Button
            variant="outline"
            className="gap-2 rounded-full px-6 h-12 font-bold"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
          <Button
            className="gap-2 rounded-full px-6 h-12 font-bold shadow-lg shadow-primary/25"
            onClick={() => navigate('/')}
          >
            <Home className="w-4 h-4" />
            Dashboard
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
