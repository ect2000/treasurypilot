"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  MoveRight,
} from "lucide-react";
import { motion } from "motion/react";
import { Brand, SandboxBadge } from "@/components/brand";
function LiquidityVisual() {
  return (
    <div
      className="liquidity-visual"
      aria-label="Treasury flow: evidence enters policy gates, then liquidity is directed to priority obligations"
    >
      <svg className="liquidity-art" viewBox="0 0 850 760" role="img">
        <title>Liquidity, deliberately directed</title>
        <defs>
          <linearGradient id="flow">
            <stop stopColor="#ff6c3e" stopOpacity=".15" />
            <stop offset=".6" stopColor="#ff6c3e" />
            <stop offset="1" stopColor="#ffae80" />
          </linearGradient>
          <pattern
            id="grid"
            width="42"
            height="42"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 42 0 L 0 0 0 42"
              fill="none"
              stroke="#ffffff"
              strokeOpacity=".035"
            />
          </pattern>
        </defs>
        <rect width="850" height="760" fill="url(#grid)" />
        <g fill="none" stroke="#333733" strokeWidth="1">
          <path d="M60 160H260Q310 160 310 210V335Q310 385 360 385H710" />
          <path d="M80 305H200Q260 305 260 365V470Q260 520 320 520H730" />
          <path d="M115 625H355Q410 625 410 565V430Q410 385 470 385" />
          <path d="M520 385V260Q520 210 570 210H760" />
          <path d="M610 385V605Q610 655 660 655H760" />
        </g>
        <g fill="none" stroke="url(#flow)" strokeWidth="2">
          <path
            className="flow-line flow-one"
            d="M60 160H260Q310 160 310 210V335Q310 385 360 385H710"
          />
          <path
            className="flow-line flow-two"
            d="M115 625H355Q410 625 410 565V430Q410 385 470 385H610V605Q610 655 660 655H760"
          />
          <path
            className="flow-line flow-three"
            d="M470 385H520V260Q520 210 570 210H760"
          />
        </g>
        <g fill="#191d1a" stroke="#474d46">
          <rect x="390" y="344" width="82" height="82" rx="16" />
          <rect x="640" y="177" width="112" height="65" rx="8" />
          <rect x="664" y="352" width="108" height="65" rx="8" />
          <rect x="672" y="624" width="100" height="65" rx="8" />
        </g>
        <g stroke="#ff885b" fill="none" strokeWidth="2">
          <path d="M432 361l20 9v19q0 16-20 24-20-8-20-24v-19z" />
          <path d="m422 385 8 8 14-17" />
        </g>
        <g fontFamily="monospace" fontSize="11" fill="#8f978e">
          <text x="60" y="142">
            EVIDENCE IN
          </text>
          <text x="115" y="610">
            LIVE BALANCES
          </text>
          <text x="386" y="455">
            POLICY GUARD
          </text>
          <text x="663" y="203">
            CONVERT
          </text>
          <text x="663" y="224" fill="#ecece4">
            EUR 14,000
          </text>
          <text x="686" y="379">
            PAY
          </text>
          <text x="686" y="399" fill="#ecece4">
            PRIORITY 01
          </text>
          <text x="691" y="652">
            DEFER
          </text>
          <text x="691" y="673">
            PRIORITY 05
          </text>
        </g>
        <circle cx="310" cy="302" r="5" fill="#ff7847" className="signal-dot" />
        <circle
          cx="520"
          cy="283"
          r="4"
          fill="#ff7847"
          className="signal-dot delayed"
        />
        <g fill="#b9c5b3" fontFamily="monospace" fontSize="11">
          <text x="371" y="100">
            48,000 USD / AUTHORIZED
          </text>
          <text x="427" y="717">
            15,000 USD / PROTECTED
          </text>
        </g>
      </svg>
      <div className="visual-caption">
        <span className="live-dot" />
        Liquidity, deliberately directed.<span>01 / 05</span>
      </div>
    </div>
  );
}
export default function Landing() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <Link href="/" aria-label="TreasuryPilot home">
          <Brand />
        </Link>
        <nav>
          <Link href="#approach">The approach</Link>
          <SandboxBadge />
          <Link className="text-link" href="/treasury">
            Open workspace <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <section className="hero">
        <LiquidityVisual />
        <motion.div className="hero-copy" initial={false}>
          <div className="eyebrow">
            <span />
            THE ADAPTIVE TREASURY CONTROLLER
          </div>
          <h1>
            Treasury
            <br />
            Pilot<span>.</span>
          </h1>
          <h2>
            Every obligation.
            <br />A deliberate decision.
          </h2>
          <p>
            Adaptive treasury that knows what to pay, convert, defer or
            escalate.
          </p>
          <Link className="button primary hero-cta" href="/treasury">
            Enter the treasury <ArrowRight size={18} />
          </Link>
          <div className="hero-note">
            Real Airwallex Sandbox. Synthetic obligations.
            <br />
            No real money. Every action accountable.
          </div>
        </motion.div>
        <div className="hero-bottom">
          <span>BUILT FOR THE AGENTIC BANKING HACKATHON</span>
          <span>SCROLL TO EXPLORE ↓</span>
        </div>
      </section>
      <section className="approach" id="approach">
        <div className="section-kicker">INTELLIGENCE WITH BOUNDARIES</div>
        <h2>
          AI interprets the situation.
          <br />
          Policy protects liquidity.
          <br />
          <span>Airwallex executes.</span>
        </h2>
        <div className="approach-steps">
          {[
            {
              n: "01",
              icon: Activity,
              title: "Understand the evidence",
              text: "Invoices and customer updates become structured candidates. The model proposes; your policy decides.",
            },
            {
              n: "02",
              icon: ShieldCheck,
              title: "Protect the reserve",
              text: "A deterministic $48,000 allocation and $15,000 floor. Confidence changes autonomy, never the rules.",
            },
            {
              n: "03",
              icon: MoveRight,
              title: "Move with intention",
              text: "A real FX quote. An exact approval. A genuine Sandbox action, with a record you can inspect.",
            },
          ].map((s) => (
            <motion.article
              key={s.n}
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div>
                <span>{s.n}</span>
                <s.icon size={21} />
              </div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </motion.article>
          ))}
        </div>
      </section>
      <section className="landing-final">
        <span className="section-kicker">THE NEXT 72 HOURS, UNDER CONTROL</span>
        <h2>
          A treasury that adapts.
          <br />A reserve that holds.
        </h2>
        <Link className="button primary" href="/treasury">
          Explore the live scenario <ArrowRight size={18} />
        </Link>
      </section>
      <footer className="landing-footer">
        <Brand small />
        <span>Sandbox only · Independent hackathon project</span>
        <a
          href="https://github.com/ect2000/treasurypilot"
          target="_blank"
          rel="noreferrer"
        >
          Source code <ArrowUpRight size={14} />
        </a>
      </footer>
    </main>
  );
}
