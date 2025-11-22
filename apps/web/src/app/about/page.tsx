import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary-600 to-secondary-700 text-white">
        <div className="container-custom py-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">About HBCU Band Hub</h1>
          <p className="text-xl text-primary-100 max-w-3xl">
            Celebrating the excellence, tradition, and cultural impact of Historically Black 
            College and University marching bands.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container-custom py-16">
        <div className="max-w-4xl mx-auto">
          {/* Mission Section */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Mission</h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              HBCU Band Hub is dedicated to preserving and showcasing the incredible performances 
              of HBCU marching bands. We provide a centralized platform where fans, students, 
              alumni, and music enthusiasts can discover, watch, and celebrate these extraordinary 
              musical programs.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              From the electrifying energy of the Fifth Quarter to the precision of field shows 
              and the intensity of stand battles, HBCU bands represent a unique and vital part 
              of American musical culture. Our platform ensures these performances are accessible 
              to everyone, everywhere.
            </p>
          </section>

          {/* Features Section */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">What We Offer</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FeatureCard
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                }
                title="Comprehensive Video Library"
                description="Thousands of performances from HBCU bands across the country, organized and easy to discover."
              />
              <FeatureCard
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                }
                title="Smart Categorization"
                description="Videos organized by type: Fifth Quarter, Field Shows, Stand Battles, Parades, and more."
              />
              <FeatureCard
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
                title="Advanced Search"
                description="Find exactly what you're looking for with powerful filters and full-text search."
              />
              <FeatureCard
                icon={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                }
                title="Band Profiles"
                description="Detailed information about each HBCU band program, including history and traditions."
              />
            </div>
          </section>

          {/* The Culture Section */}
          <section className="mb-12 bg-gray-50 rounded-lg p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">The HBCU Band Tradition</h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              HBCU marching bands are more than musical ensembles—they're cultural institutions 
              that have shaped American music and performance for generations. Known for their 
              high-energy performances, innovative choreography, and powerful sound, these bands 
              have influenced everything from popular music to major sporting events.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              Programs like Southern University's Human Jukebox, Florida A&M's Marching 100, 
              Jackson State's Sonic Boom, and Howard University's Showtime Marching Band have 
              set the standard for excellence in collegiate marching bands nationwide.
            </p>
          </section>

          {/* CTA Section */}
          <section className="text-center bg-gradient-to-br from-primary-600 to-secondary-700 text-white rounded-lg p-12">
            <h2 className="text-3xl font-bold mb-4">Start Exploring</h2>
            <p className="text-xl text-primary-100 mb-8">
              Discover the bands, watch the performances, and experience the tradition.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/bands" className="btn-primary bg-white text-primary-700 hover:bg-gray-100">
                Browse Bands
              </Link>
              <Link href="/videos" className="btn-secondary bg-transparent text-white border-white hover:bg-white/10">
                Watch Videos
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// Feature card component
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}