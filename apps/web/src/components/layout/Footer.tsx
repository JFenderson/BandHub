import Link from 'next/link';

const footerLinks = {
  explore: [
    { name: 'All Bands', href: '/bands' },
    { name: 'All Videos', href: '/videos' },
    { name: 'Categories', href: '/videos?category=all' },
  ],
  about: [
    { name: 'About Us', href: '/about' },
    { name: 'Contact', href: '/contact' },
    { name: 'Privacy Policy', href: '/privacy' },
  ],
  social: [
    { name: 'Twitter', href: '#' },
    { name: 'YouTube', href: '#' },
    { name: 'Instagram', href: '#' },
  ],
};

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300" aria-label="Site footer">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-secondary-600 rounded-lg flex items-center justify-center" aria-hidden="true">
                <span className="text-white font-bold text-xl">HB</span>
              </div>
              <span className="text-xl font-bold text-white">
                HBCU Band Hub
              </span>
            </div>
            <p className="text-sm text-gray-400">
              Celebrating the excellence and tradition of HBCU marching bands.
            </p>
          </div>

          {/* Explore Navigation */}
          <nav aria-labelledby="footer-explore-heading">
            <h3 id="footer-explore-heading" className="text-sm font-semibold text-white mb-4">Explore</h3>
            <ul className="space-y-2">
              {footerLinks.explore.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* About Navigation */}
          <nav aria-labelledby="footer-about-heading">
            <h3 id="footer-about-heading" className="text-sm font-semibold text-white mb-4">About</h3>
            <ul className="space-y-2">
              {footerLinks.about.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Social Links */}
          <div>
            <h3 id="footer-connect-heading" className="text-sm font-semibold text-white mb-4">Connect</h3>
            <ul className="space-y-2" aria-labelledby="footer-connect-heading">
              {footerLinks.social.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm hover:text-white transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Follow us on ${link.name} (opens in new tab)`}
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <p className="text-sm text-gray-400 text-center">
            © {new Date().getFullYear()} HBCU Band Hub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}