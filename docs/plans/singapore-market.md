# Singapore Market Plan — Pilot Launch

**Status**: Planning
**Target Launch**: TBD
**Scope**: Singapore (pilot market)

---

## Overview

PropFrame's pilot market is **Singapore**. This document outlines the market context, localization requirements, go-to-market approach, and operational considerations for launching in Singapore.

---

## Why Singapore

| Factor | Assessment |
|---|---|
| Real estate market size | ~S$1.5T total transaction volume annually. High volume of property listings. |
| Digital adoption | One of the highest in Southeast Asia. Real estate agents are active on social media and digital platforms. |
| Competition | Limited local AI video tools for real estate. Regional competitor presence is thin. |
| English proficiency | Native language. No translation burden for v1. |
| Payment infrastructure | Stripe is widely supported. Singapore cards and PayNow are common. |
| Regulatory environment | GDPR does not apply (PDPA instead). Relatively straightforward data compliance. |

---

## Target Customer Profile

### Primary: Real Estate Agents (Individual)
- **Age**: 25–45
- **Firm**: Small to mid-size agencies (1–20 agents)
- **Volume**: 5–20 active listings per month
- **Pain**: Creating listing videos manually is time-consuming; existing tools are expensive or lack quality
- **Willingness to pay**: S$20–80/month for productivity tools

### Secondary: Property Developers / Agencies
- **Use case**: Bulk creation of promotional video content for new launches
- **Volume**: Higher clip volumes, potential for enterprise pricing
- **Decision cycle**: Longer, requires demo and sales outreach

---

## Localization Requirements

### Language
- **v1**: English-only (Singapore has high English proficiency)
- **v2 consideration**: Mandarin, Malay support for broader agent population

### Currency & Payments
- [ ] Add SGD pricing tiers alongside USD
- [ ] Configure Stripe Singapore (SGD) as a supported currency
- [ ] Add PayNow as a payment option (via Stripe or alternative)
- [ ] Display prices in SGD (e.g., S$29 instead of $29)

### Date/Time
- [ ] Use Singapore Time (SGT, UTC+8) for all timestamps
- [ ] Display dates in Singapore format (DD/MM/YYYY) or align with user preference

### Legal / Compliance
- [ ] **PDPA compliance**: Update privacy policy and terms of service for Singapore's Personal Data Protection Act
- [ ] **Consumer protection**: Review AI-generated content disclaimers for Singapore context
- [ ] **Property listing regulations**: Singapore's Estate Agent Act requires agents to include CEA registration numbers in advertisements — consider adding a field for this in video overlays/titles

### Domain & Hosting
- [ ] Consider `propframe.sg` or `propframe.sg.com` as a Singapore-specific domain
- [ ] Ensure CDN (Cloudflare R2) has good Singapore/Southeast Asia latency

### Marketing Channels
- [ ] **PropertyGuru**: Dominant property portal in Singapore. Ads, content partnerships.
- [ ] **Facebook/Instagram**: Most real estate agents use these for listings
- [ ] **LinkedIn**: For developer/larger agency outreach
- [ ] **99.co**: Second largest property portal
- [ ] ** CEA registers**: Direct outreach to registered agents via email

---

## Pricing Strategy (SGD)

| Package | SGD/month | Credits | Notes |
|---|---|---|---|
| Starter | S$19 | 15,000 | Individual agents, 1 project at a time |
| Pro | S$49 | 50,000 | Active agents, unlimited projects |
| Agency | S$149 | 200,000 | Teams of 3–10 agents |
| Pay-as-you-go | S$0 | — | Per-clip pricing (TBD rate) |

*Conversion: ~1 SGD = 0.75 USD at time of planning*

**Pilot offer**: 500 free credits for first 100 signups (targeted via PropertyGuru community posts and Facebook groups)

---

## Go-to-Market Steps

### Pre-Launch (Weeks 1–4)
1. [ ] Set up Stripe SGD support
2. [ ] Update legal pages for PDPA compliance
3. [ ] Add CEA registration number field to video overlay template
4. [ ] Launch Singapore-focused landing page variant (optional subdomain)
5. [ ] Create PropFrame SG social accounts (Facebook, Instagram, LinkedIn)

### Soft Launch (Weeks 5–8)
1. [ ] Invite-only beta to 20–50 Singapore agents (via personal network and PropertyGuru forums)
2. [ ] Collect feedback, identify friction points
3. [ ] Fix critical localization bugs
4. [ ] Offer pilot credits in exchange for testimonials

### Public Launch (Weeks 9–12)
1. [ ] Public announcement via PropertyGuru and 99.co blog posts
2. [ ] Facebook/Instagram ad campaign targeting "real estate agent" + Singapore demographics
3. [ ] Reach out to real estate agencies for demo requests
4. [ ] Set up a simple support process (email, or WhatsApp for Singapore)

### Post-Launch (Ongoing)
1. [ ] Monitor Singapore user signups and retention
2. [ ] Collect NPS via in-app survey
3. [ ] Iterate on pricing based on conversion data
4. [ ] Consider partnerships with PropertyGuru or 99.co for co-marketing

---

## Competitor Landscape (Singapore)

| Competitor | Strength | PropFrame Advantage |
|---|---|---|
| **VuGru** | Direct competitor, established | Lower price, faster clip generation |
| **VideoGenie** | Integrates with PropertyGuru | Better video quality, AI motion |
| **Canva** | Brand recognition, free tier | Real estate-specific Ken Burns, auto-edit |
| **CapCut** | Popular, free | No manual editing required, automated workflow |

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Low signup conversion due to trust issues with AI video | Medium | Add sample videos from real Singapore properties to landing page |
| Agents prefer existing tools (Canva, CapCut) | High | Emphasize speed (5-minute turnaround) and real estate-specific features |
| Stripe/Payment issues in Singapore | Low | Test full payment flow end-to-end before launch |
| PDPA complaint data handling | Medium | Work with a Singapore-based lawyer to review privacy policy |
| Currency conversion volatility affecting margins | Low | Review pricing quarterly |

---

## Success Metrics (Pilot)

| Metric | Target |
|---|---|
| Signups in first 30 days | 100 |
| Active users (used product in 30 days) | 40 |
| Clips generated | 500 |
| NPS score | > 40 |
| Conversion to paid | > 5% |

---

*Last updated: 2026-03-27*
