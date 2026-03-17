export const metadata = {
  title: 'Privacy Policy | HBCU Band Hub',
  description: 'Privacy Policy for HBCU Band Hub — how we collect, use, and protect your information.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 px-8 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: March 2026</p>

        <p className="text-gray-700 mb-8">
          HBCU Band Hub (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is committed to protecting your privacy.
          This Privacy Policy explains how we collect, use, and safeguard your information when you visit{' '}
          <span className="font-medium">hbcubandhub.tech</span> (the &ldquo;Service&rdquo;).
          By using the Service you agree to the practices described below.
        </p>

        <Section title="1. Information We Collect">
          <Subsection title="Information you provide directly">
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li><strong>Account information</strong> — name and email address when you register</li>
              <li><strong>Profile information</strong> — optional bio, avatar, and band preferences you add to your profile</li>
              <li><strong>Communications</strong> — messages or feedback you send us</li>
            </ul>
          </Subsection>
          <Subsection title="Information collected automatically">
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li><strong>Usage data</strong> — pages visited, search queries, bands and videos viewed</li>
              <li><strong>Watch history</strong> — videos you play, used to personalise recommendations</li>
              <li><strong>Device &amp; browser information</strong> — browser type, operating system, and IP address (used for security and rate-limiting)</li>
              <li><strong>Session tokens</strong> — stored in browser cookies to keep you logged in</li>
            </ul>
          </Subsection>
        </Section>

        <Section title="2. How We Use Your Information">
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>Provide, operate, and improve the Service</li>
            <li>Authenticate your account and maintain session security</li>
            <li>Personalise your experience (e.g., favourite bands, watch history)</li>
            <li>Send transactional emails — account verification, password reset, magic sign-in links (via <strong>Resend</strong>)</li>
            <li>Monitor for abuse, spam, and security threats</li>
            <li>Analyse aggregated usage patterns to improve the platform</li>
          </ul>
          <p className="mt-3 text-gray-700">
            We do <strong>not</strong> sell your personal information to third parties. We do <strong>not</strong> use your data for advertising.
          </p>
        </Section>

        <Section title="3. Cookies and Local Storage">
          <p className="text-gray-700 mb-3">
            We use browser cookies solely for authentication purposes:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li><code className="bg-gray-100 px-1 rounded text-sm">user_access_token</code> — short-lived JWT used to authenticate API requests</li>
            <li><code className="bg-gray-100 px-1 rounded text-sm">user_session_token</code> — session token stored for 7–30 days depending on your &ldquo;Remember me&rdquo; preference</li>
          </ul>
          <p className="mt-3 text-gray-700">
            No third-party advertising or tracking cookies are set by this Service. You can clear cookies at any time through your browser settings, which will log you out.
          </p>
        </Section>

        <Section title="4. Third-Party Services">
          <Subsection title="YouTube">
            <p className="text-gray-700">
              All band videos are embedded from YouTube. When you play a video, YouTube&apos;s own privacy policy
              applies. YouTube may set its own cookies or collect data in accordance with{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-500 underline">
                Google&apos;s Privacy Policy
              </a>.
            </p>
          </Subsection>
          <Subsection title="Resend (email delivery)">
            <p className="text-gray-700">
              Transactional emails (verification, password reset, magic links) are sent via Resend. Your email
              address is shared with Resend only for the purpose of delivering these messages. See{' '}
              <a href="https://resend.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-500 underline">
                Resend&apos;s Privacy Policy
              </a>.
            </p>
          </Subsection>
        </Section>

        <Section title="5. Data Retention">
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>Your account data is retained for as long as your account is active</li>
            <li>Watch history and preferences are deleted when you delete your account</li>
            <li>Session tokens expire automatically (7 days standard, 30 days with &ldquo;Remember me&rdquo;)</li>
            <li>Magic sign-in links expire after 15 minutes and are one-time use only</li>
            <li>Server logs containing IP addresses are retained for up to 30 days for security purposes</li>
          </ul>
        </Section>

        <Section title="6. Your Rights">
          <p className="text-gray-700 mb-3">You have the right to:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li><strong>Access</strong> — view the personal information stored in your profile</li>
            <li><strong>Correct</strong> — update your name, bio, and preferences from your profile settings</li>
            <li><strong>Delete</strong> — permanently delete your account and all associated data from the account settings page</li>
            <li><strong>Withdraw consent</strong> — stop using the Service and delete your account at any time</li>
          </ul>
        </Section>

        <Section title="7. Security">
          <p className="text-gray-700">
            We take reasonable technical measures to protect your data, including encrypted connections (HTTPS),
            hashed password storage, hashed session and magic-link tokens, and rate limiting on authentication
            endpoints. No method of transmission over the Internet is 100% secure, but we strive to use
            commercially acceptable means to protect your information.
          </p>
        </Section>

        <Section title="8. Children's Privacy">
          <p className="text-gray-700">
            HBCU Band Hub is not directed to children under the age of 13. We do not knowingly collect personal
            information from children under 13. If you believe a child has provided us with personal information,
            please contact us so we can delete it.
          </p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p className="text-gray-700">
            We may update this Privacy Policy from time to time. When we do, we will update the &ldquo;Last updated&rdquo;
            date at the top of this page. Continued use of the Service after changes are posted constitutes
            acceptance of the revised policy.
          </p>
        </Section>

        <Section title="10. Contact">
          <p className="text-gray-700">
            If you have questions or concerns about this Privacy Policy or your data, please contact us via the{' '}
            <a href="/contact" className="text-primary-600 hover:text-primary-500 underline">Contact page</a>.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-medium text-gray-800 mb-2">{title}</h3>
      {children}
    </div>
  );
}
