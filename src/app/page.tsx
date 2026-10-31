import { ArrowUpRight, Check, CircleHelp, Cloud, LockKeyhole, Sparkles } from 'lucide-react';

const highlights = [
  { icon: Cloud, title: 'A better way to store', description: 'A refreshed experience for your team’s important files.' },
  { icon: LockKeyhole, title: 'Built with care', description: 'A thoughtful new foundation for secure, reliable storage.' },
  { icon: Sparkles, title: 'Coming together', description: 'We’re working behind the scenes on what’s next.' },
];

export default function Home() {
  return (
    <main className="coming-soon-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <header className="site-header">
        <a className="brand" href="/" aria-label="Vantor Storage home">
          <span className="brand-mark"><img src="/logo.png" alt="" /></span>
          <span className="brand-name">vantor<span>storage</span></span>
        </a>
        <span className="header-status"><span className="status-dot" /> Platform refresh in progress</span>
      </header>

      <section className="hero-section" aria-labelledby="coming-soon-heading">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> A new chapter is on the way</div>
          <h1 id="coming-soon-heading">Storage, <span>reimagined.</span></h1>
          <p className="hero-lede">A new and improved Vantor Storage is on the way. We’re working on a better experience for the files and teams that matter.</p>
          <div className="availability-notice" role="status">
            <span className="notice-icon"><CircleHelp size={19} strokeWidth={1.8} /></span>
            <p><strong>Vantor Storage is temporarily unavailable.</strong><br />All website functionality is currently disabled while we prepare the new version.</p>
          </div>
          <p className="contact-note"><span className="contact-check"><Check size={14} strokeWidth={2.5} /></span> Questions? Please contact your manager or system administrator.</p>
        </div>

        <div className="visual-wrap" aria-hidden="true">
          <div className="visual-orbit orbit-outer" />
          <div className="visual-orbit orbit-inner" />
          <div className="visual-glow" />
          <div className="storage-visual">
            <div className="visual-topline"><span /><span /><span /></div>
            <div className="visual-content">
              <div className="visual-sidebar"><i /><i /><i /><i /></div>
              <div className="visual-main">
                <div className="visual-heading"><span /><b /></div>
                <div className="visual-cards"><i /><i /><i /></div>
                <div className="visual-file"><span className="file-icon" /><span className="file-lines"><i /><i /></span><b /></div>
                <div className="visual-file"><span className="file-icon secondary" /><span className="file-lines"><i /><i /></span><b /></div>
                <div className="visual-file"><span className="file-icon tertiary" /><span className="file-lines"><i /><i /></span><b /></div>
              </div>
            </div>
          </div>
          <div className="floating-badge badge-secure"><span><LockKeyhole size={16} /></span> Your files, thoughtfully protected</div>
          <div className="floating-badge badge-cloud"><Cloud size={16} /> A fresh start is coming <ArrowUpRight size={14} /></div>
        </div>
      </section>

      <section className="highlights" aria-label="What’s ahead">
        {highlights.map(({ icon: Icon, title, description }, index) => (
          <article className="highlight-card" key={title}>
            <span className="highlight-icon"><Icon size={19} strokeWidth={1.8} /></span>
            <div><h2>{title}</h2><p>{description}</p></div>
            <span className="card-index">0{index + 1}</span>
          </article>
        ))}
      </section>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} Vantor Storage</span>
        <span className="footer-message"><span className="status-dot" /> We’ll be back with something better</span>
      </footer>
    </main>
  );
}
