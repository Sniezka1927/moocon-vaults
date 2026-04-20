import Image from "next/image";

const NAV_LINKS = [
  { label: "How it Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "FAQ", href: "#faq" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full bg-header-bg/80 backdrop-blur-md">
      <div className="flex w-full items-center justify-between border-b border-white/5 px-5 py-4 md:px-10">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2">
          <Image
            src="/logo-white.png"
            alt="Moocon"
            width={64}
            height={64}
            className="h-16 w-16 object-contain"
          />
          <span className="font-sans text-2xl font-black uppercase tracking-tight text-white md:text-[2.4rem]">
            Moocon
          </span>
        </a>

        {/* Nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <a
          href="https://app.moocon.xyz"
          className="rounded-full bg-primary px-5 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-[#2563EB]"
        >
          Launch App
        </a>
      </div>
    </header>
  );
}
