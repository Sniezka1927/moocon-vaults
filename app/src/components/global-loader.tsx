import logoWhite from '@/icons/logo-white.png'

export function GlobalLoader({ visible }: { visible: boolean }) {
  return (
    <div className="global-loader" data-hidden={!visible}>
      <img
        src={logoWhite}
        alt=""
        className="constellation-logo"
        width={140}
        height={140}
        draggable={false}
      />
    </div>
  )
}
