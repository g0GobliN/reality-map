import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · RealityMap" },
      { name: "description", content: "Privacy Policy for RealityMap." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <Link to="/">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mb-10 text-sm text-muted-foreground">
          Effective date: June 1, 2026 &nbsp;·&nbsp; Last updated: June 1, 2026
        </p>

        <Section title="1. Overview">
          <p>
            RealityMap (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is a local-first
            developer tool that generates visual architecture maps of your codebase. This Privacy
            Policy explains what information we collect, how we use it, and your rights regarding
            that information.
          </p>
          <p className="mt-3">
            RealityMap is designed to run locally on your machine. Your source code is{" "}
            <strong>never uploaded to our servers</strong>. We have no access to the code you
            analyze.
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <Subsection title="a) Information you provide">
            <p>
              We do not require account registration. If you contact us (e.g., via email or GitHub),
              we receive the information you voluntarily provide such as your name and email
              address.
            </p>
          </Subsection>
          <Subsection title="b) Usage analytics (website only)">
            <p>
              The RealityMap marketing website uses{" "}
              <a
                href="https://vercel.com/docs/analytics"
                className="underline underline-offset-4 hover:text-foreground"
                target="_blank"
                rel="noopener noreferrer"
              >
                Vercel Analytics
              </a>
              , which collects anonymised, aggregate page-view data (URL visited, referrer, browser
              type, country). No personally identifiable information is collected. No cookies are
              placed for analytics purposes.
            </p>
          </Subsection>
          <Subsection title="c) Error and crash data">
            <p>
              The CLI tool does not transmit telemetry, crash reports, or any data from your local
              environment to our servers unless you explicitly opt in to a feature that requires it.
              Any such feature will be clearly disclosed before activation.
            </p>
          </Subsection>
        </Section>

        <Section title="3. Your Source Code">
          <p>
            RealityMap processes your source code entirely on your local machine. No file contents,
            filenames, dependency graphs, or analysis results are sent to or stored by RealityMap
            servers. You retain full ownership of your code.
          </p>
        </Section>

        <Section title="4. Cookies">
          <p>
            The RealityMap website does not use tracking or advertising cookies. Only strictly
            necessary session cookies (if any) may be set to ensure the site functions correctly.
            You can configure your browser to refuse all cookies without affecting your ability to
            use the tool.
          </p>
        </Section>

        <Section title="5. Third-Party Services">
          <p>The website relies on the following third-party services:</p>
          <ul className="mt-3 list-disc pl-6 space-y-1 text-muted-foreground">
            <li>
              <strong className="text-foreground">Vercel</strong> — hosting and edge delivery.
              Subject to{" "}
              <a
                href="https://vercel.com/legal/privacy-policy"
                className="underline underline-offset-4 hover:text-foreground"
                target="_blank"
                rel="noopener noreferrer"
              >
                Vercel&apos;s Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong className="text-foreground">GitHub</strong> — source code hosting and issue
              tracking. Subject to{" "}
              <a
                href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
                className="underline underline-offset-4 hover:text-foreground"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub&apos;s Privacy Statement
              </a>
              .
            </li>
          </ul>
          <p className="mt-3">
            We do not sell, rent, or share your personal information with any third party for
            marketing purposes.
          </p>
        </Section>

        <Section title="6. Data Retention">
          <p>
            We do not store personal data beyond what is strictly necessary to respond to your
            inquiry. Contact information you send us is kept only as long as needed to address your
            request.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="mt-3 list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Access the personal data we hold about you</li>
            <li>Request correction or deletion of your personal data</li>
            <li>Object to or restrict our processing of your personal data</li>
            <li>Lodge a complaint with your local data protection authority</li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, contact us at the email below. We will respond within
            30 days.
          </p>
        </Section>

        <Section title="8. Children's Privacy">
          <p>
            RealityMap is not directed at children under 13. We do not knowingly collect personal
            information from children. If you believe a child has provided us with personal
            information, please contact us and we will delete it promptly.
          </p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. When we do, we will update the
            &ldquo;Last updated&rdquo; date at the top of this page. We encourage you to review this
            page periodically.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            If you have any questions or concerns about this Privacy Policy, please contact us at:
          </p>
          <p className="mt-3 font-mono text-sm text-muted-foreground">
            grgvishal.gurung17@gmail.com
          </p>
        </Section>
      </main>
      <footer className="border-t border-border px-6 py-8 text-center font-mono text-[11px] text-muted-foreground">
        © 2026 RealityMap ·{" "}
        <Link to="/" className="transition hover:text-foreground">
          Back to home
        </Link>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold tracking-tight">{title}</h2>
      <div className="text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-medium text-foreground">{title}</h3>
      {children}
    </div>
  );
}
