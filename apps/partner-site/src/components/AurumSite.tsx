"use client";

import { useMemo, useState } from "react";

import type { PartnerInventoryByLanguage, PartnerInventoryItem, PartnerTenantConfig } from "../tenants";

type AurumSiteProps = {
  tenant: PartnerTenantConfig;
  inventoryByLanguage: PartnerInventoryByLanguage;
};

const neighborhoods = [
  {
    title: "Manhattan Core",
    text: "Tribeca, Flatiron, Upper East Side and core condo/co-op corridors.",
    image: "https://images.unsplash.com/photo-1522083165195-3424ed129620?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Brooklyn Brownstone",
    text: "Brooklyn Heights, Cobble Hill, Park Slope and family-led townhouse searches.",
    image: "https://images.unsplash.com/photo-1518391846015-55a9cc003b25?auto=format&fit=crop&w=1000&q=80",
  },
  {
    title: "Queens & Waterfront",
    text: "Long Island City, Astoria and high-liquidity waterfront apartment strategies.",
    image: "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1000&q=80",
  },
];

const services = [
  ["Buyer Representation", "Private shortlist, valuation discipline, negotiation strategy and closing coordination."],
  ["Seller Strategy", "Pricing, presentation, launch timing and buyer-side feedback management."],
  ["Rental Search", "Fast relocation briefs, building filtering and application preparation."],
  ["Investor Advisory", "Neighborhood risk, rentability, liquidity and portfolio-fit review."],
];

const processSteps = ["Brief calibration", "Curated shortlist", "Deal strategy", "Closing support"];

function resolveMediaUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  return url;
}

function assetLabel(value?: string) {
  return value?.replace(/_/g, " ") ?? "Property";
}

export function AurumSite({ tenant, inventoryByLanguage }: AurumSiteProps) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const inventory = (inventoryByLanguage.en?.length ? inventoryByLanguage.en : tenant.inventory) as PartnerInventoryItem[];
  const types = useMemo(() => Array.from(new Set(inventory.map((item) => item.assetClass).filter(Boolean))) as string[], [inventory]);
  const markets = useMemo(() => Array.from(new Set(inventory.map((item) => item.market).filter(Boolean))), [inventory]);
  const filteredInventory = inventory.filter((item) => {
    return (typeFilter === "all" || item.assetClass === typeFilter) && (marketFilter === "all" || item.market === marketFilter);
  });

  return (
    <main className="aurum-site">
      <header className="aurum-header">
        <a className="aurum-brand" href="#home" aria-label="Aurum Key home">
          <img src="/aurum/key-mark-light.png" alt="" />
          <span>
            Aurum <b>Key</b>
          </span>
        </a>
        <nav className="aurum-nav">
          <a href="#neighborhoods">Neighborhoods</a>
          <a href="#services">Services</a>
          <a href="#listings">Listings</a>
          <a href="#process">Process</a>
          <a href="#contact">Contact</a>
        </nav>
        <a className="aurum-outline-btn" href="#contact">
          Book Advisory Call
        </a>
      </header>

      <section className="aurum-hero" id="home">
        <img className="aurum-hero-bg" src={tenant.heroImage} alt="New York skyline" />
        <div className="aurum-hero-overlay" />
        <div className="aurum-hero-inner">
          <div className="aurum-hero-copy">
            <p className="aurum-eyebrow">{tenant.accentLabel}</p>
            <h1>Sharper New York property decisions.</h1>
            <p>
              Aurum Key Realty NYC is a boutique real estate advisory for buyers, sellers, renters and investors who need
              calm execution in a fast market.
            </p>
            <div className="aurum-actions">
              <a className="aurum-primary-btn" href="#contact">
                Request a Private Shortlist
              </a>
              <a className="aurum-outline-btn" href="#listings">
                View Featured Homes
              </a>
            </div>
            <div className="aurum-metrics" aria-label="Aurum Key operating metrics">
              <span>
                <b>24h</b>
                first shortlist
              </span>
              <span>
                <b>NYC</b>
                local execution
              </span>
              <span>
                <b>AI+</b>
                broker review
              </span>
            </div>
          </div>
          <aside className="aurum-brief-card">
            <img src="/aurum/logo-wide-dark.png" alt="Aurum Key Realty NYC" />
            <h2>Build your NYC brief.</h2>
            <p>Tell us the neighborhood, budget, timing and use case. We prepare a curated shortlist and market notes.</p>
            <div className="aurum-brief-grid">
              <span>Purchase</span>
              <span>Rental</span>
              <span>Relocation</span>
              <span>Investment</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="aurum-section aurum-neighborhoods" id="neighborhoods">
        <div className="aurum-section-head">
          <p className="aurum-eyebrow">Neighborhood intelligence</p>
          <h2>NYC searches are local, financial and personal at the same time.</h2>
        </div>
        <div className="aurum-card-grid">
          {neighborhoods.map((item) => (
            <article className="aurum-image-card" key={item.title}>
              <img src={item.image} alt={item.title} loading="lazy" />
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="aurum-section aurum-services" id="services">
        <div className="aurum-section-head compact">
          <p className="aurum-eyebrow">Advisory services</p>
          <h2>One senior workflow from search to closing.</h2>
        </div>
        <div className="aurum-service-grid">
          {services.map(([title, text]) => (
            <article className="aurum-service-card" key={title}>
              <span>0{services.findIndex(([serviceTitle]) => serviceTitle === title) + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="aurum-section aurum-listings" id="listings">
        <div className="aurum-listings-head">
          <div>
            <p className="aurum-eyebrow">Shared Public Inventory</p>
            <h2>Featured opportunities and partner-network objects.</h2>
            <p>Objects are rendered from the Fixer.guru shared database when available, with Aurum showcase cards as fallback.</p>
          </div>
          <div className="aurum-filters">
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Object type">
              <option value="all">All types</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {assetLabel(type)}
                </option>
              ))}
            </select>
            <select value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)} aria-label="Market">
              <option value="all">All markets</option>
              {markets.map((market) => (
                <option key={market} value={market}>
                  {market}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="aurum-listing-grid">
          {filteredInventory.map((item) => {
            const mediaUrl = resolveMediaUrl(item.mediaUrl);

            return (
              <article className="aurum-listing-card" key={item.id ?? `${item.market}-${item.title}`}>
                <div className="aurum-listing-media">
                  {mediaUrl ? <img src={mediaUrl} alt={item.title} loading="lazy" /> : <div>Aurum Key</div>}
                  <span>{assetLabel(item.assetClass)}</span>
                </div>
                <div className="aurum-listing-body">
                  <p className="aurum-market">{item.market}</p>
                  <h3>{item.title}</h3>
                  <strong>{item.priceDisplay ?? "Price on request"}</strong>
                  <p>{item.description ?? `Seller-side: ${item.sellerSidePartner}`}</p>
                  <div className="aurum-tags">
                    {item.addressDisplay ? <span>{item.addressDisplay}</span> : null}
                    {item.areaSqm ? <span>{item.areaSqm} sqm</span> : null}
                    <span>{item.buyerSidePartner}</span>
                  </div>
                  <a className="aurum-inline-link" href="#contact">
                    Discuss this object
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="aurum-section aurum-process" id="process">
        <div className="aurum-process-image" />
        <div className="aurum-process-content">
          <p className="aurum-eyebrow">Process</p>
          <h2>Structured advisory for a market that moves quickly.</h2>
          <div className="aurum-process-steps">
            {processSteps.map((step, index) => (
              <article key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <b>{step}</b>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="aurum-section aurum-contact" id="contact">
        <div>
          <p className="aurum-eyebrow">Contact</p>
          <h2>Start with a private brief.</h2>
          <p>Send your target neighborhood, budget, timeline and objective. Aurum Key prepares a focused next step.</p>
        </div>
        <div className="aurum-contact-card">
          <p>hello@aurumkeynyc.com</p>
          <p>+1 212 555 0126</p>
          <p>New York, NY</p>
          <a className="aurum-primary-btn" href="mailto:hello@aurumkeynyc.com">
            Email Aurum Key
          </a>
          <a className="aurum-outline-btn" href="https://partner-admin-dev--kvartal-dev.europe-west4.hosted.app/login?organization=aurum-key-nyc">
            Organization admin
          </a>
        </div>
      </section>

      <footer className="aurum-footer">
        <img src="/aurum/logo-wide-light.png" alt="Aurum Key Realty NYC" />
        <p>Powered by Fixer.guru partner network and shared public inventory.</p>
      </footer>
    </main>
  );
}
