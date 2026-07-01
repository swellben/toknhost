# ToknHost Market Research: Competitive Landscape & Market Gap Analysis

**Prepared:** June 29, 2026  
**Product:** ToknHost — a design token hosting platform that serves tokens as a hosted MCP server for AI coding tools

---

## Executive Summary

The market for AI-aware design system tooling is real, active, and growing fast. The pain point ToknHost addresses — AI coding tools producing off-brand, generic-looking UI — is extensively documented and widely felt. However, the space is no longer empty: Figma, Supernova, and Zeroheight all launched MCP servers in 2025. The direct niche ToknHost targets (hosted token-as-MCP with zero design tool dependencies, multi-framework output, and AI-powered token generation from seed values) is not cleanly occupied by any single player. This is a genuine, if narrowing, gap — but the window is measured in months, not years.

---

## 1. Direct Competitors: Design Tokens as MCP Servers

### Is anyone else doing exactly what ToknHost proposes?

No single product matches the exact proposition of: *paste your tokens → get a hosted MCP URL → AI coding tools connect to it → multi-framework output (Tailwind v4, shadcn, CSS variables, Bootstrap, DTCG)*. However, several players are approaching it from adjacent angles:

#### Supernova Relay (Launched: September 18, 2025)
Supernova released an official remote MCP server called Relay. It allows AI models and agents to "securely pull in data from the Supernova design system" including design tokens, components, documentation, and assets. The server includes a `get_token_list` function that returns the full list of design tokens including values, references, and groupings. It converts documentation to clean Markdown and fully resolves token references across deeply nested relationships.

**Key difference from ToknHost:** Supernova Relay is a feature of a full enterprise design system platform (starting at several hundred dollars/month). It requires users to already be managing their design system inside Supernova. It is not a standalone "paste your tokens, get a URL" product. It does not appear to support multi-framework token output from a single endpoint.

**Source:** [MCP for design system | Made with Supernova](https://learn.supernova.io/latest/design-systems/features/mcp-for-design-system-LIHAMhjr-LIHAMhjr) | [Introducing Supernova Relay](https://learn.supernova.io/latest/releases/september-2025/introducing-supernova-relay-lWfNcpwJ)

---

#### Zeroheight Remote MCP (Launched: ~2025)
Zeroheight launched both a local and a remote hosted MCP server. Their hosted MCP "connects design system documentation to AI tools like Claude, Cursor, and VS Code — secure, scalable, and enterprise-ready." It requires no local installation and works with all major AI tools. It gates the MCP feature behind paid plans (not available on Free or Starter tiers).

**Key difference from ToknHost:** Zeroheight's MCP is primarily a *documentation* bridge — it exposes design system docs, guidelines, and context to AI tools. It is not focused on outputting tokens in multiple framework formats (Tailwind, shadcn, CSS variables, etc.). It also requires users to be inside Zeroheight's platform.

**Source:** [zeroheight MCP: Connect Your Design System to AI Workflows](https://zeroheight.com/whats-new/zeroheight-remote-mcp-connect-your-design-system-to-ai-workflows/) | [Set up the remote MCP server](https://help.zeroheight.com/hc/en-us/articles/43737291730331-Set-up-the-remote-MCP-server)

---

#### Figma Dev Mode MCP Server (Open Beta: Early 2026)
Figma launched its official MCP server in June 2025, with open beta by March 2026. The MCP server sends contextual information — components, styles, variables — to AI agents when a Figma frame is inspected. It can apply design tokens automatically to align code with brand and accessibility standards. Bidirectional Claude Code integration launched in February 2026.

**Key difference from ToknHost:** Figma's MCP is tied entirely to the Figma tool and requires a Figma subscription. It does not function as a standalone token host. A significant documented limitation is that it "outputs prescriptive React/Tailwind code and translates Figma's exact pixel values into arbitrary Tailwind classes rather than mapping them to your design system's scale." Developers are expected to manually map extracted values to their token system. It does not serve tokens formatted for multiple frameworks from a hosted URL.

**Source:** [Design Systems And AI: Why MCP Servers Are The Unlock | Figma Blog](https://www.figma.com/blog/design-systems-ai-mcp/) | [Introducing Figma MCP Server](https://www.figma.com/blog/introducing-figma-mcp-server/)

---

#### Southleft Design Systems MCP (Open Source, ~2025)
A community-built MCP server hosted at `design-systems-mcp.southleft.com`, powered by Supabase vector search with 188+ curated entries covering W3C standards, WCAG guidelines, and design system best practices. It answers questions about components, tokens, patterns, and practices.

**Key difference from ToknHost:** This is a *generic knowledge base* about design systems, not a host for *your specific tokens*. It has no concept of per-team or per-brand token data.

**Source:** [GitHub - southleft/design-systems-mcp](https://github.com/southleft/design-systems-mcp)

---

#### Zaklad (Active, 2025-2026)
Zaklad is a product that builds a "complete design system in minutes" — OKLCH palettes, type scales, spacing, components, and themes — from structured inputs. It ships cross-platform components, Figma Variables with Code Connect, typed packages, and generated documentation. It imports token structures from DTCG JSON.

**Key difference from ToknHost:** Zaklad focuses on generating a full design system and syncing it to Figma and code packages. It does not appear to offer a hosted MCP URL that AI coding tools can connect to in real time. More of a build-time tool than a serve-time tool.

**Source:** [Zaklad | A complete design system in minutes](https://zaklad.app/)

---

#### designtoken.md (Active, 2025-2026)
A free service (no signup) that generates complete design token files as markdown that coding agents read directly. It outputs color scales, typography rules, component tokens, and a visual reference card. The agent maps these tokens to whatever component library is in use.

**Key difference from ToknHost:** This is a static file generator, not a hosted live MCP server. There is no URL an AI coding tool can connect to dynamically. No concept of token versioning, team management, or framework-specific output formats.

**Source:** [designtoken.md — Rich Design Tokens for Coding Agents](https://designtoken.md/)

---

## 2. Adjacent Competitors: Established Token Management Tools

### Do any have MCP or AI-tool integration?

| Tool | MCP Integration | AI Integration | Notes |
|------|----------------|----------------|-------|
| **Supernova** | Yes — Relay MCP server (Sept 2025) | Yes | Enterprise platform, MCP requires full subscription |
| **Zeroheight** | Yes — remote MCP (2025) | Yes — AI-powered authoring | Documentation-focused, paid plans only |
| **Figma** | Yes — Dev Mode MCP (2025-2026) | Yes | Requires Figma subscription; pixel-value output, not token-scale output |
| **Tokens Studio** | No confirmed MCP as of research date | Limited | No public MCP announcement found; Figma plugin still primary workflow |
| **Style Dictionary** | No | No | Build-time CLI tool; no hosting or MCP capability |
| **Specify** | No confirmed MCP found | No | No public MCP integration found |
| **Diez** | Appears inactive/archived | No | No recent updates found |

**Key finding on Tokens Studio:** Despite being the most widely used design token plugin (Figma-based), no MCP integration was found in public announcements or roadmap documentation as of June 2026. This is notable given that their users are exactly the audience ToknHost would serve.

---

## 3. Design System AI Tools: Design-to-Code

These tools claim to enforce design systems during code generation but approach it differently from ToknHost:

### Locofy
Detects Figma styles and maps them to CSS variables or design tokens in the output. Saves 40-60% of initial layout coding time. However, it works at design-time (export from Figma) rather than serving live token context to AI coding agents.

**Source:** [AI Figma-to-Code in 2026 | sixtythirtyten](https://www.sixtythirtyten.co/blog/from-figma-to-code-ai-design-to-dev-workflows-in-2026)

### Anima
IBM invested in Anima in February 2026, validating enterprise positioning. Design-to-code focused. Does not appear to offer an MCP server for token hosting.

### Builder.io Visual Copilot
Uses AI to import designs and convert them into responsive, production-ready code. Respects component hierarchies and design tokens. One of the "Best MCP Servers for Developers in 2026" lists includes Builder.io. However, Builder.io's MCP integration focuses on content management and site building, not design token hosting specifically.

**Source:** [The Best MCP Servers for Developers in 2026 | Builder.io](https://www.builder.io/blog/best-mcp-servers-2026)

### Meta Astryx (Open Beta: June 2026)
Meta open-sourced Astryx in June 2026 — a React design system built over 8 years, powering 13,000+ internal apps. It ships with a **CLI and MCP server** that lets AI agents (Cursor, Claude Code, GitHub Copilot) scaffold and browse components, themes, and documentation. Components carry JSDoc annotations with composition hints. Ships 10 ready-made themes plus full customization.

**This is the closest competitor in architecture to ToknHost's MCP approach**, but Astryx is Meta's own design system — it cannot be used to host *your* design tokens. It is a public, fixed design system, not a platform for teams to host their own.

**Source:** [Meta's Astryx Brings a CLI and MCP Server to an Open-Source React Design System | MarkTechPost](https://www.marktechpost.com/2026/06/27/metas-astryx-brings-a-cli-and-mcp-server-to-an-open-supply-react-design-system-brokers-can-learn/)

### UXPin Forge
AI assistant that generates layouts using real coded components, with every output constrained to design system tokens and guidelines. Focused on prototyping within the UXPin tool, not on serving tokens to external AI coding tools.

---

## 4. Market Signals: Is the Pain Real?

### The Core Problem is Well-Documented

Multiple sources from 2025-2026 confirm the pain point is genuine and widespread:

**From BrainGrid AI (2025):**
> "Every AI-generated UI looks the same — rounded corners, subtle shadows, that omnipresent purple gradient. The Tailwind default config uses a specific set of named colors that are mathematically pleasant but instantly recognizable."

**Source:** [Design Systems for AI Coding: Stop Getting Purple Gradients | BrainGrid](https://www.braingrid.ai/blog/design-system-optimized-for-ai-coding)

**From DEV Community (2025):**
> "How to fix the 'AI-generated' look in your frontend" — the post addresses a specific visual fingerprint to AI-generated frontends that users find embarrassing when a client says "this looks like ChatGPT made it."

**Source:** [How to fix the 'AI-generated' look in your frontend | DEV Community](https://dev.to/alanwest/how-to-fix-the-ai-generated-look-in-your-frontend-1ahh)

**From Into Design Systems (2025-2026):**
> "Agents know about components but break design foundations — spacing is wrong, typography doesn't match, colors are off-brand, and components are technically correct but the page looks nothing like the product."

**Source:** [Your Design System Is Not Ready for AI Agents | Into Design Systems](https://www.intodesignsystems.com/blog/design-system-not-ready-for-ai-agents)

**From Design Systems Collective (2026):**
> "AI tools generate cookie cutter apps that look nothing like your product, and the challenge is making it follow your brand guidelines and use your actual design system components."

**Source:** [Design Systems for the Vibe-Coding Era | Design Systems Collective](https://www.designsystemscollective.com/design-systems-for-the-vibe-coding-era-42282e1affef)

**From The Design System Guide (2026):**
> "In 2026, a large portion of UI code is written or assisted by AI, but AI models default to generic values rather than brand values."

**Source:** [Design tokens that AI can actually read | The Design System Guide](https://learn.thedesignsystem.guide/p/design-tokens-that-ai-can-actually)

**Quantitative signal:** Search interest for "design tokens generator" has grown over **900% in the last two years** (as of 2026), per OneMinuteBranding research. Adoption of design tokens among development teams reached **84% in 2026**, up from 56% a year earlier, per zeroheight's industry survey of ~300 professionals.

**Source:** [Design Tokens in 2026: Auto-Generate Them in Seconds | OneMinuteBranding](https://www.oneminutebranding.com/blog/design-tokens-2026) | [Design Systems Report 2026 | zeroheight](https://report.zeroheight.com/)

### AI Token Drift Is a Documented Engineering Problem

> "Token drift occurs when teams use AI to generate screens that infer spacing and color from surrounding code written across months by different developers, resulting in technically correct but 'almost' consistent output that becomes a widespread problem."

> "Component multiplication happens when AI tools create slightly different versions of existing components due to lack of a single source of truth."

**Source:** [Design System for AI-Assisted Development: 2026 | Boldare](https://www.boldare.com/blog/design-system-ai-assisted-development/)

### Industry Validation: Google DESIGN.md

Google Labs open-sourced DESIGN.md in April 2026 — a plain-text format combining YAML front matter (design tokens) and Markdown prose to encode design systems with the explicit goal of making them legible to AI agents. The repo gained **11,000+ GitHub stars** and one related "awesome list" hit **40,500 stars in 10 days** (described as the fastest growth of any "awesome list" in GitHub history). This signals enormous developer appetite for exactly the problem ToknHost solves.

**Source:** [GitHub - google-labs-code/design.md](https://github.com/google-labs-code/design.md) | [DESIGN.md: Google's Open Format for AI Design Tokens | Abduzeedo](https://abduzeedo.com/design-md-google-ai-design-tokens)

### Industry Validation: W3C DTCG Stable Spec

On October 28, 2025, the W3C Design Tokens Community Group shipped its first stable Design Tokens Format Module (v2025.10), backed by Adobe, Google, Meta, Figma, Microsoft, Salesforce, and Shopify. This removes a key risk for any token-related product — the format is now standardized.

**Source:** [Design Tokens Format Module 2025.10](https://www.designtokens.org/tr/drafts/format/)

---

## 5. Market Gap Assessment: Vitamin or Painkiller?

### Verdict: Painkiller — with caveats

**Evidence it's a painkiller:**
- The "off-brand AI UI" problem is not hypothetical. It is actively discussed across developer communities, blogs, and in tooling product releases. Multiple companies are building toward solutions.
- 84% of teams now use design tokens; the vast majority have no live connection between those tokens and their AI coding tools.
- The 2025 Stack Overflow survey found 66% of developers cite code that's "almost right, but not quite" as the core frustration with AI tools — on-brand styling is a major component of this.
- Google, Meta, and Figma investing in the design-system-to-AI pipeline confirms enterprise and platform-level validation of the problem.

**Evidence it might be closer to a vitamin for some segments:**
- Larger teams already inside Supernova or Zeroheight have an MCP path (though it requires full platform commitment and costs).
- Teams using Figma with Code Connect can get partway there with significant setup work.
- Solo developers and vibe-coders doing early-stage work may not prioritize on-brand accuracy until they have paying customers.

**The painkiller case is strongest for:**
- Product teams at seed to Series B stage — past "just ship it" but not at enterprise platform budget.
- Agencies building client products who need to match brand specs quickly.
- Small design system teams who don't want to adopt a full Supernova/Zeroheight subscription just to expose tokens to AI.
- Developers who don't use Figma at all (code-first teams, open-source projects).

**ToknHost's specific differentiation if the gap holds:**
1. **No tool lock-in** — paste tokens directly, no Figma, Supernova, or Zeroheight required
2. **Multi-framework output from one URL** — Tailwind v4, shadcn, CSS variables, Bootstrap, DTCG from a single endpoint (no competitor confirmed to do this)
3. **AI-generated complete token system from seed values** — this is a distinct feature with no clear direct competitor found
4. **Hosted, zero-config MCP URL** — lower friction than running a local MCP server

---

## 6. Timing Assessment

### MCP Protocol Maturity

MCP was released by Anthropic in November 2024. As of June 2026:
- 97 million+ monthly SDK downloads
- 9,400+ servers in the public registry (up from 1,200 in Q1 2025)
- 78% of enterprise AI teams report at least one MCP-backed agent in production
- Donated to the Linux Foundation in December 2025 — vendor-neutral and permanent
- Every major AI coding tool (Claude Code, Cursor, Copilot, Windsurf) supports MCP

**This is not too early.** The protocol is mature enough for production use, the developer audience understands it, and the major tools support it.

**Source:** [The MCP Server Ecosystem in 2026 | CodeOnGrass](https://codeongrass.com/blog/mcp-server-ecosystem-integration-layer-ai-agents-2026/)

### Is it too late?

Not yet, but the window is narrowing. The key risk factors:
- Supernova Relay launched September 2025 and is in production
- Zeroheight remote MCP launched in 2025
- Figma's MCP is in open beta (March 2026)
- Meta's Astryx dropped an MCP server June 2026
- Google DESIGN.md (April 2026) is establishing a competing standard for encoding tokens in flat files rather than hosted servers

The momentum is strongly toward this problem being solved — which means the opportunity is real, but a fast-follower with better UX, lower friction, and sharper positioning can still win if they move now.

### The Right Window

The inflection point was 2025. ToknHost is entering the market in mid-2026, which is late enough that the concept is proven and early enough that the dominant player in the specific niche of "hosted token MCP" for non-enterprise teams has not yet emerged. The analogy would be entering the Stripe market in 2012 after PayPal and Braintree existed but before Stripe owned it — the infrastructure was proven, the pain was real, and there was still room for a better DX.

---

## 7. Competitor Comparison Table

| Product | Hosted MCP for tokens | Your tokens (not theirs) | No tool required | Multi-framework output | Token generation from seed | Free tier / Low friction |
|---------|----------------------|--------------------------|------------------|----------------------|---------------------------|--------------------------|
| **ToknHost** | Yes (proposed) | Yes | Yes | Yes | Yes | TBD |
| Supernova Relay | Yes | Yes (in Supernova) | No (Supernova required) | No | No | No (enterprise pricing) |
| Zeroheight MCP | Yes | Yes (in Zeroheight) | No (Zeroheight required) | No | No | No (paid plans only) |
| Figma MCP | Yes | Yes (via Figma) | No (Figma required) | No (pixel values, not tokens) | No | Limited (Figma subscription) |
| Meta Astryx MCP | Yes | No (Meta's system only) | No (React/StyleX specific) | No | No | Yes (open source) |
| designtoken.md | No (static file) | Yes | Yes | No | No | Yes (free) |
| Zaklad | No (build-time only) | Yes | Yes | No | Yes | Unknown |
| Google DESIGN.md | No (flat file spec) | Yes | Yes | Limited | No | Yes (open source) |

---

## 8. Key Risks to Monitor

1. **Figma closes the gap** — If Figma adds multi-framework token output to its MCP server, it dramatically reduces the gap for the large Figma user segment. However, Figma's current limitation (pixel values vs. token scale) is architectural and may not be easily solved.

2. **Google DESIGN.md becomes the standard** — If DESIGN.md (flat file approach) becomes the de facto AI-readable format for design systems, the hosted MCP approach may lose relative value. Currently DESIGN.md and hosted MCP solve slightly different problems, but this could converge.

3. **Token Studio adds MCP** — As the most widely used token management plugin, if Tokens Studio ships their own hosted MCP endpoint, they have a large existing user base to activate.

4. **Free alternatives commoditize the space** — designtoken.md and Google DESIGN.md are free. If free file-based solutions satisfy enough of the market, willingness to pay for a hosted service may be limited to larger teams.

5. **MCP itself gets displaced** — The ACP protocol is being discussed as an alternative in 2026, though MCP's Linux Foundation governance makes this less likely in the near term.

---

## Sources

- [Design Systems And AI: Why MCP Servers Are The Unlock | Figma Blog](https://www.figma.com/blog/design-systems-ai-mcp/)
- [Introducing our Dev Mode MCP server | Figma Blog](https://www.figma.com/blog/introducing-figma-mcp-server/)
- [MCP for design system | Made with Supernova](https://learn.supernova.io/latest/design-systems/features/mcp-for-design-system-LIHAMhjr-LIHAMhjr)
- [Introducing Supernova Relay | Made with Supernova](https://learn.supernova.io/latest/releases/september-2025/introducing-supernova-relay-lWfNcpwJ)
- [zeroheight MCP: Connect Your Design System to AI Workflows](https://zeroheight.com/whats-new/zeroheight-remote-mcp-connect-your-design-system-to-ai-workflows/)
- [Set up the remote zeroheight MCP server](https://help.zeroheight.com/hc/en-us/articles/43737291730331-Set-up-the-remote-MCP-server)
- [AI in design systems: What's changing in 2026 | zeroheight](https://zeroheight.com/blog/ai-in-design-systems-whats-changing-in-2026/)
- [Design Systems Report 2026 | zeroheight](https://report.zeroheight.com/)
- [Meta's Astryx Brings a CLI and MCP Server to an Open-Source React Design System | MarkTechPost](https://www.marktechpost.com/2026/06/27/metas-astryx-brings-a-cli-and-mcp-server-to-an-open-supply-react-design-system-brokers-can-learn/)
- [Meta's Astryx Gives AI Coding Agents a Design System They Can Actually Read | TechTimes](https://www.techtimes.com/articles/319202/20260627/metas-astryx-gives-ai-coding-agents-design-system-they-can-actually-read.htm)
- [Astryx Design System | Meta](https://astryx.atmeta.com/)
- [GitHub - google-labs-code/design.md](https://github.com/google-labs-code/design.md)
- [DESIGN.md: Google's Open Format for AI Design Tokens | Abduzeedo](https://abduzeedo.com/design-md-google-ai-design-tokens)
- [Google Stitch Open-Sources DESIGN.md | Pasquale Pillitteri](https://pasqualepillitteri.it/en/news/1251/google-stitch-design-md-open-source-spec-2026)
- [GitHub - southleft/design-systems-mcp](https://github.com/southleft/design-systems-mcp)
- [designtoken.md — Rich Design Tokens for Coding Agents](https://designtoken.md/)
- [Zaklad | A complete design system in minutes](https://zaklad.app/)
- [Design Systems for AI Coding: Stop Getting Purple Gradients | BrainGrid](https://www.braingrid.ai/blog/design-system-optimized-for-ai-coding)
- [How to fix the 'AI-generated' look in your frontend | DEV Community](https://dev.to/alanwest/how-to-fix-the-ai-generated-look-in-your-frontend-1ahh)
- [Your Design System Is Not Ready for AI Agents | Into Design Systems](https://www.intodesignsystems.com/blog/design-system-not-ready-for-ai-agents)
- [Design Systems for the Vibe-Coding Era | Design Systems Collective](https://www.designsystemscollective.com/design-systems-for-the-vibe-coding-era-42282e1affef)
- [Design Tokens in 2026: Auto-Generate Them in Seconds | OneMinuteBranding](https://www.oneminutebranding.com/blog/design-tokens-2026)
- [Design Tokens Format Module 2025.10 | W3C DTCG](https://www.designtokens.org/tr/drafts/format/)
- [GitHub - style-dictionary/style-dictionary](https://github.com/style-dictionary/style-dictionary)
- [Why your design system is the most important asset in the AI era | The Design System Guide](https://learn.thedesignsystem.guide/p/why-your-design-system-is-the-most)
- [Design tokens that AI can actually read | The Design System Guide](https://learn.thedesignsystem.guide/p/design-tokens-that-ai-can-actually)
- [AI Figma-to-Code in 2026: Builder.io vs Locofy vs Anima | sixtythirtyten](https://www.sixtythirtyten.co/blog/from-figma-to-code-ai-design-to-dev-workflows-in-2026)
- [Design System for AI-Assisted Development: 2026 | Boldare](https://www.boldare.com/blog/design-system-ai-assisted-development/)
- [Design Systems And AI: 5 Shifts | Figma Blog](https://www.figma.com/blog/5-shifts-redefining-design-systems-in-the-ai-era/)
- [The MCP Server Ecosystem in 2026 | CodeOnGrass](https://codeongrass.com/blog/mcp-server-ecosystem-integration-layer-ai-agents-2026/)
- [AI-Ready Design Systems | Supernova / Medium](https://supernova-io.medium.com/ai-ready-design-systems-preparing-your-design-system-for-machine-powered-product-development-8df0b59ca8b4)
- [design.md vs Design Tokens for AI UI Workflows | WaveSpeed](https://wavespeed.ai/blog/posts/design-md-vs-design-tokens-ai-workflows/)
- [Tokens Studio Alternatives & Review (2026) | designtools.fyi](https://designtools.fyi/tools/tokens-studio)
- [Pricing an MCP Server in 2026 | DEV Community](https://dev.to/whoffagents/pricing-an-mcp-server-in-2026-why-we-charge-19mo-when-the-market-average-is-0-nig)
