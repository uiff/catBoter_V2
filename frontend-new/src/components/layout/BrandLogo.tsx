import { cn } from '@/lib/utils'

/**
 * iotueli-Wortmarke als CSS-Mask: färbt sich über currentColor automatisch
 * passend zu Hell/Dunkel. (PNG ist weiss auf transparent, 580x191.)
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="iotueli"
      className={cn('inline-block bg-current', className)}
      style={{
        aspectRatio: '580 / 191',
        WebkitMaskImage: 'url(/brand/iotueli-wordmark.png)',
        maskImage: 'url(/brand/iotueli-wordmark.png)',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  )
}
