import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  cities?: readonly string[];
};

export function PageLayout({ children, cities }: Props) {
  return (
    <div className="page-shell">
      <a className="skip-link" href="#search">Перейти к поиску</a>
      <header className="site-header">
        <div className="page-container header-inner">
          <a className="brand" href="./" aria-label="Netrix — главная">
            <span className="brand-symbol" aria-hidden="true">n<span>·</span></span>
            netrix
          </a>
          <span className="header-caption">Люди, которые создают события</span>
          <span className="demo-badge"><span aria-hidden="true" />Демонстрационный режим</span>
        </div>
      </header>
      <main className="page-container">{children}</main>
      <footer className="page-container site-footer">
        <span>netrix <span aria-hidden="true">/</span> собрано вокруг вашего события</span>
        {cities && cities.length > 0 && <span>{cities.join(' · ')}</span>}
      </footer>
    </div>
  );
}
