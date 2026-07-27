'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';

type IconName = 'overview' | 'review' | 'imports' | 'duplicates' | 'site' | 'logout';

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  };
  if (name === 'overview') return <svg {...common}><path d="M4 4h6v6H4zM14 4h6v10h-6zM4 14h6v6H4zM14 18h6v2h-6z" /></svg>;
  if (name === 'review') return <svg {...common}><path d="M9 5h10M9 12h10M9 19h6" /><path d="m3.5 5 1.3 1.3L7 4M3.5 12l1.3 1.3L7 11M3.5 19l1.3 1.3L7 18" /></svg>;
  if (name === 'imports') return <svg {...common}><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v3h16v-3" /></svg>;
  if (name === 'duplicates') return <svg {...common}><rect x="7" y="7" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
  if (name === 'site') return <svg {...common}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></svg>;
  return <svg {...common}><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M15 8l4 4-4 4M19 12H9" /></svg>;
}

const navItems = [
  { href: '/admin', label: 'Visão geral', shortLabel: 'Início', icon: 'overview' as const, exact: true },
  { href: '/admin/review', label: 'Curadoria', shortLabel: 'Revisar', icon: 'review' as const },
  { href: '/admin/imports', label: 'Importações', shortLabel: 'Importar', icon: 'imports' as const },
  { href: '/admin/review/duplicates', label: 'Duplicidades', shortLabel: 'Duplicados', icon: 'duplicates' as const }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const loginPage = pathname === '/admin/login';

  useEffect(() => {
    if (loginPage) return;
    fetch('/api/admin/session', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => setEmail(payload.user?.email ?? ''))
      .catch(() => undefined);
  }, [loginPage]);

  const logout = async () => {
    try {
      await createSupabaseBrowserClient().auth.signOut();
      await fetch('/api/admin/session', { method: 'DELETE' });
    } finally {
      router.replace('/admin/login');
      router.refresh();
    }
  };

  if (loginPage) {
    return <div className="tbt-admin-root tbt-admin-login-root">{children}</div>;
  }

  const isActive = (item: (typeof navItems)[number]) => {
    if (item.exact) return pathname === item.href;
    if (item.href === '/admin/review') {
      return pathname.startsWith(item.href) && !pathname.startsWith('/admin/review/duplicates');
    }
    return pathname.startsWith(item.href);
  };

  return (
    <div className="tbt-admin-root">
      <div className="tbt-admin-ambient" aria-hidden="true" />
      <aside className="tbt-admin-sidebar">
        <Link className="tbt-admin-brand" href="/admin" aria-label="The Big Tree BJJ — administração">
          <span className="tbt-admin-seal"><span>TBT</span></span>
          <span>
            <strong>The Big Tree</strong>
            <small>Núcleo editorial</small>
          </span>
        </Link>

        <div className="tbt-admin-rail-label">Operação</div>
        <nav className="tbt-admin-nav" aria-label="Navegação administrativa">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={isActive(item) ? 'is-active' : ''}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
              <i aria-hidden="true" />
            </Link>
          ))}
        </nav>

        <div className="tbt-admin-sidebar-foot">
          <div className="tbt-admin-user">
            <span>{email ? email.slice(0, 2).toUpperCase() : 'ED'}</span>
            <div>
              <strong>Editor autenticado</strong>
              <small>{email || 'Supabase Auth'}</small>
            </div>
          </div>
          <div className="tbt-admin-foot-actions">
            <Link href="/" target="_blank"><Icon name="site" /> Ver site</Link>
            <button type="button" onClick={() => void logout()}><Icon name="logout" /> Sair</button>
          </div>
        </div>
      </aside>

      <header className="tbt-admin-mobile-head">
        <Link className="tbt-admin-brand" href="/admin">
          <span className="tbt-admin-seal"><span>TBT</span></span>
          <span><strong>The Big Tree</strong><small>Editorial</small></span>
        </Link>
        <button type="button" onClick={() => void logout()} aria-label="Sair do administrativo"><Icon name="logout" /></button>
      </header>

      <div className="tbt-admin-workspace">{children}</div>

      <nav className="tbt-admin-mobile-nav" aria-label="Navegação administrativa móvel">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className={isActive(item) ? 'is-active' : ''}>
            <Icon name={item.icon} />
            <span>{item.shortLabel}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
