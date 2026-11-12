const HERO_WORDS: { text: string; delay: string }[] = [
  { text: "What ", delay: "0s" },
  { text: "do ", delay: "0.2s" },
  { text: "you ", delay: "0.4s" },
  { text: "want ", delay: "0.6s" },
  { text: "to ", delay: "0.8s" },
  { text: "create?", delay: "1.0s" },
];

export function HeroTitle() {
  return (
    <div 
      className="home-hero-row !flex !flex-col !items-center !justify-center w-full pt-[10px]" 
      style={{ gap: "16px" }}
    >
      {/* Icon goes first (Top) */}
 <div style={{ display: "flex", flexShrink: 0 }}>
  <SparkIcon />
</div>
      {/* Text goes below */}
      <h2 className="home-hero-title home-heading-font !text-center">
        {HERO_WORDS.map((word) => (
          <span key={word.text} className="home-hero-word" style={{ animationDelay: word.delay }}>
            {word.text}
          </span>
        ))}
      </h2>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="75"
      height="76"
      viewBox="0 0 75 76"
      fill="none"
      aria-hidden="true"
      className="home-spark-icon"
    >
      <path
        className="home-spark-path"
        pathLength={1}
        stroke="url(#home-spark-gradient)"
        strokeWidth="0.463563"
        fill="none"
        d="M37.5 0.731445C37.8187 0.731445 38.1124 0.836172 38.3867 1.05566C38.6634 1.27701 38.8549 1.55103 38.9658 1.88086C40.0335 6.08437 41.6337 10.0384 43.7676 13.7412C45.9029 17.4465 48.5094 20.8375 51.5859 23.9141C54.6625 26.9906 58.0535 29.5971 61.7588 31.7324C65.4613 33.8661 69.4151 35.4656 73.6182 36.5332C73.9485 36.6441 74.2227 36.8363 74.4443 37.1133C74.6638 37.3876 74.7686 37.6813 74.7686 38C74.7686 38.3187 74.6638 38.6124 74.4443 38.8867C74.2228 39.1636 73.9484 39.3549 73.6182 39.4658C69.415 40.5335 65.4613 42.1339 61.7588 44.2676C58.0535 46.4029 54.6625 49.0094 51.5859 52.0859C48.5094 55.1625 45.9029 58.5535 43.7676 62.2588C41.6339 65.9613 40.0335 69.915 38.9658 74.1182C38.8549 74.4484 38.6636 74.7228 38.3867 74.9443C38.1124 75.1638 37.8187 75.2686 37.5 75.2686C37.1813 75.2686 36.8876 75.1638 36.6133 74.9443C36.3363 74.7227 36.1441 74.4485 36.0332 74.1182C34.9656 69.9151 33.3661 65.9613 31.2324 62.2588C29.0971 58.5535 26.4906 55.1625 23.4141 52.0859C20.3375 49.0094 16.9465 46.4029 13.2412 44.2676C9.53838 42.1337 5.58438 40.5335 1.38086 39.4658C1.05103 39.3549 0.777009 39.1634 0.555664 38.8867C0.336172 38.6124 0.231445 38.3187 0.231445 38C0.231445 37.6813 0.336172 37.3876 0.555664 37.1133C0.777074 36.8365 1.05089 36.6441 1.38086 36.5332C5.58429 35.4656 9.53845 33.8662 13.2412 31.7324C16.9465 29.5971 20.3375 26.9906 23.4141 23.9141C26.4906 20.8375 29.0971 17.4465 31.2324 13.7412C33.3662 10.0385 34.9656 6.08429 36.0332 1.88086C36.1441 1.5509 36.3365 1.27708 36.6133 1.05566C36.8876 0.836172 37.1813 0.731445 37.5 0.731445Z"
      />
      <defs>
        <radialGradient
          id="home-spark-gradient"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="matrix(-68.7925 -100.371 84.0103 -451.72 64.3707 95.8167)"
        >
          <stop stopOpacity="0" />
          <stop offset="0.0336538" stopColor="#4EA0FF" stopOpacity="0" />
          <stop offset="1" stopColor="#346BF0" />
        </radialGradient>
      </defs>
    </svg>
  );
}