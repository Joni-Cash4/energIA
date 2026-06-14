import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30',
        secondary: 'bg-[#1F1F1F] text-white border border-[#2A2A2A]',
        blue: 'bg-[#1565C0]/20 text-[#42A5F5] border border-[#1565C0]/40',
        yellow: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
        red: 'bg-red-500/15 text-red-400 border border-red-500/30',
        purple: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
