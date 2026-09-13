"use client";
/**
 * React renderer for the guidelines document. Mirrors the markup and class
 * names of `renderStandaloneHtml` so both share `guidelinesCss`.
 */
import * as React from "react";
import type { GuidelinesDoc, GuidelinesSection, ContrastPair, ImageRef } from "@/lib/guidelines/model";
import { easingCurveSvg, iconSamples, SPECIMEN_GLYPHS, SPECIMEN_FIGURES } from "@/lib/guidelines/html";

function Svg({ svg, className, style }: { svg: string; className?: string; style?: React.CSSProperties }) {
  return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: svg }} />;
}

function Head({ s, lede }: { s: GuidelinesSection; lede?: string }) {
  return (
    <>
      <header className="gl-head">
        <div className="gl-eyebrow">Section {s.number}</div>
        <h2 className="gl-h2">{s.title}</h2>
      </header>
      {lede ? <p className="gl-lede">{lede}</p> : null}
    </>
  );
}

function List({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={`gl-list ${className ?? ""}`}>
      {items.map((i, k) => (
        <li key={k}>{i}</li>
      ))}
    </ul>
  );
}

function Marks({ items, kind }: { items: string[]; kind: "do" | "dont" }) {
  return (
    <ul className={`gl-list gl-marks gl-${kind}`}>
      {items.map((i, k) => (
        <li key={k}>
          <span>{kind === "do" ? "✓" : "✕"}</span>
          <span>{i}</span>
        </li>
      ))}
    </ul>
  );
}

function Chips({ items, className }: { items: string[]; className?: string }) {
  return (
    <div className="gl-chips">
      {items.map((i, k) => (
        <span key={k} className={`gl-chip ${className ?? ""}`}>
          {i}
        </span>
      ))}
    </div>
  );
}

function Pass({ ok }: { ok: boolean }) {
  return <span className={ok ? "gl-pass" : "gl-fail"}>{ok ? "Pass" : "Fail"}</span>;
}

function ContrastRow({ p }: { p: ContrastPair }) {
  const r = p.report;
  return (
    <tr>
      <td>
        <span className="gl-pair">
          <span className="gl-pair-chip" style={{ background: p.bg.hex, color: p.fg.hex }}>
            Aa
          </span>
          <span>
            {p.fg.name} on {p.bg.name}
          </span>
        </span>
      </td>
      <td className="gl-mono">
        {p.fg.hex} / {p.bg.hex}
      </td>
      <td className="gl-mono">{r.ratio.toFixed(2)}:1</td>
      <td>
        <Pass ok={r.aaNormal} />
      </td>
      <td>
        <Pass ok={r.aaLarge} />
      </td>
      <td className="gl-mono">
        {r.apca > 0 ? "+" : ""}
        {r.apca}
      </td>
      <td className="gl-small gl-muted">{r.apcaUse}</td>
    </tr>
  );
}

function Images({ images }: { images: ImageRef[] }) {
  return (
    <div className="gl-images">
      {images.map((r) => (
        <figure key={r.assetId}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.src} alt={r.name} width={r.width} height={r.height} />
          <figcaption>{r.caption || r.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function Section({ s, doc }: { s: GuidelinesSection; doc: GuidelinesDoc }) {
  const t = doc.theme;
  switch (s.kind) {
    case "cover":
      return (
        <section className="gl-page gl-cover" id={`gl-${s.id}`}>
          <div>
            <Svg className="gl-cover-logo" svg={s.logo.svg} />
          </div>
          <div>
            <p className="gl-cover-kicker">Brand guidelines</p>
            <h1 className="gl-cover-title">{s.name}</h1>
            {s.tagline ? <p className="gl-cover-tagline">{s.tagline}</p> : null}
            <div className="gl-cover-meta">
              <span>{s.client || s.name}</span>
              <span>Version {s.version}</span>
              <span>{s.date}</span>
            </div>
          </div>
        </section>
      );
    case "intro":
      return (
        <section className="gl-page" id={`gl-${s.id}`}>
          <Head s={s} lede={s.positioning} />
          <div className="gl-prose">
            {s.story.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {s.mission ? (
            <blockquote className="gl-quote">
              {s.mission}
              <small>Mission</small>
            </blockquote>
          ) : null}
          {s.vision ? (
            <blockquote className="gl-quote">
              {s.vision}
              <small>Vision</small>
            </blockquote>
          ) : null}
          {s.audience ? (
            <div className="gl-block" style={{ marginTop: 32 }}>
              <div className="gl-label">Audience</div>
              <p className="gl-prose">{s.audience}</p>
            </div>
          ) : null}
        </section>
      );
    case "strategy":
      return (
        <section className="gl-page" id={`gl-${s.id}`}>
          <Head s={s} />
          {s.values.length ? (
            <div className="gl-block">
              <div className="gl-label">Values</div>
              <div className="gl-values">
                {s.values.map((v, i) => (
                  <span key={i}>{v}</span>
                ))}
              </div>
            </div>
          ) : null}
          {s.archetype ? (
            <div className="gl-block gl-avoid">
              <div className="gl-label">Archetype</div>
              <div className="gl-arche">
                <div className="gl-arche-name">
                  {s.archetype.name}
                  {s.secondaryArchetype ? <span className="gl-muted"> with {s.secondaryArchetype.name}</span> : null}
                </div>
                <dl className="gl-dl">
                  <dt>Drive</dt>
                  <dd>{s.archetype.drive}</dd>
                  <dt>Voice</dt>
                  <dd>{s.archetype.voice}</dd>
                  <dt>In the wild</dt>
                  <dd>{s.archetype.examples}</dd>
                  <dt>Palette cues</dt>
                  <dd>{s.archetype.colors}</dd>
                </dl>
              </div>
            </div>
          ) : null}
          {s.personality.length ? (
            <div className="gl-block gl-avoid">
              <div className="gl-label">Personality</div>
              <div className="gl-axes">
                {s.personality.map((a) => (
                  <div className="gl-axis" key={a.id}>
                    <span>{a.left}</span>
                    <span className="gl-axis-track">
                      <span className="gl-axis-dot" style={{ left: `${a.value}%` }} />
                    </span>
                    <span className="gl-axis-r">{a.right}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {s.differentiators.length ? (
            <div className="gl-block">
              <div className="gl-label">What sets us apart</div>
              <List items={s.differentiators} />
            </div>
          ) : null}
          {s.keywords.length ? (
            <div className="gl-block">
              <div className="gl-label">Keywords</div>
              <Chips items={s.keywords} />
            </div>
          ) : null}
        </section>
      );
    case "voice":
      return (
        <section className="gl-page" id={`gl-${s.id}`}>
          <Head s={s} lede={s.voice} />
          {s.sample ? (
            <blockquote className="gl-quote">
              {s.sample}
              <small>Sample copy</small>
            </blockquote>
          ) : null}
          <div className="gl-grid gl-grid-2">
            {s.dos.length ? (
              <div>
                <div className="gl-label">Do</div>
                <Marks items={s.dos} kind="do" />
              </div>
            ) : null}
            {s.donts.length ? (
              <div>
                <div className="gl-label">Don&apos;t</div>
                <Marks items={s.donts} kind="dont" />
              </div>
            ) : null}
          </div>
        </section>
      );
    case "logo":
      return (
        <section className="gl-page" id={`gl-${s.id}`}>
          <Head s={s} lede={s.concept} />
          {s.placeholder ? <p className="gl-small gl-muted">The artwork below is a generated placeholder — the final logo replaces it automatically once it exists.</p> : null}
          <div className="gl-logo-grid">
            {s.variants.map((v) => (
              <div className="gl-logo-tile gl-avoid" data-surface={v.surface} key={v.key}>
                <Svg className="gl-logo" svg={v.svg} />
                <div className="gl-logo-caption">
                  <span>{v.label}</span>
                  <span>{v.placeholder ? "placeholder" : "svg"}</span>
                </div>
              </div>
            ))}
          </div>
          <h3 className="gl-h3">Clearspace</h3>
          <div className="gl-grid gl-grid-2 gl-avoid">
            <Svg className="gl-figure" svg={s.clearspace.svg} />
            <p className="gl-prose">{s.clearspace.description}</p>
          </div>
          <h3 className="gl-h3">Minimum size</h3>
          <div className="gl-grid gl-grid-2 gl-avoid">
            <div className="gl-figure gl-minsize">
              <div className="gl-minsize-item">
                <Svg className="gl-logo-min" style={{ height: s.minSize.px }} svg={s.minSize.svg} />
                <span className="gl-caption">{s.minSize.px} px · screen</span>
              </div>
              <div className="gl-minsize-item">
                <Svg className="gl-logo-min" style={{ height: `${s.minSize.mm}mm` }} svg={s.minSize.svg} />
                <span className="gl-caption">{s.minSize.mm} mm · print</span>
              </div>
            </div>
            <p className="gl-prose">
              Never reproduce the mark smaller than <strong>{s.minSize.px} px</strong> on screen or <strong>{s.minSize.mm} mm</strong> in print. Below these sizes detail is lost and the mark stops reading.
            </p>
          </div>
          {s.usageRules.length || s.doNots.length ? (
            <>
              <h3 className="gl-h3">Usage</h3>
              <div className="gl-grid gl-grid-2">
                {s.usageRules.length ? (
                  <div>
                    <div className="gl-label">Rules</div>
                    <Marks items={s.usageRules} kind="do" />
                  </div>
                ) : null}
                {s.doNots.length ? (
                  <div>
                    <div className="gl-label">Never</div>
                    <Marks items={s.doNots} kind="dont" />
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </section>
      );
    case "color":
      return (
        <section className="gl-page" id={`gl-${s.id}`}>
          <Head s={s} lede={s.rationale} />
          <div className="gl-swatches">
            {s.swatches.map((c) => (
              <div className="gl-swatch gl-avoid" key={c.id}>
                <div className="gl-swatch-chip" style={{ background: c.hex, color: c.textOn }} />
                <div className="gl-swatch-meta">
                  <div className="gl-swatch-name">{c.name}</div>
                  <div className="gl-swatch-role">{c.role}</div>
                  <div className="gl-swatch-row">
                    <span>HEX</span>
                    <span>{c.hex}</span>
                  </div>
                  <div className="gl-swatch-row">
                    <span>RGB</span>
                    <span>{c.rgbText}</span>
                  </div>
                  <div className="gl-swatch-row">
                    <span>CMYK</span>
                    <span>{c.cmykText}</span>
                  </div>
                  {c.darkHex ? (
                    <div className="gl-swatch-row">
                      <span>DARK</span>
                      <span>{c.darkHex}</span>
                    </div>
                  ) : null}
                  {c.usage ? <p className="gl-swatch-usage">{c.usage}</p> : null}
                </div>
              </div>
            ))}
          </div>
          {s.contrast.length ? (
            <>
              <h3 className="gl-h3">Accessible pairings</h3>
              <p className="gl-prose gl-small gl-muted">WCAG 2.2 ratios and APCA lightness contrast for the combinations used most. AA normal text needs 4.5:1, large text 3:1.</p>
              <table className="gl-table">
                <thead>
                  <tr>
                    <th>Pairing</th>
                    <th>Values</th>
                    <th>Ratio</th>
                    <th>AA text</th>
                    <th>AA large</th>
                    <th>APCA</th>
                    <th>Use for</th>
                  </tr>
                </thead>
                <tbody>
                  {s.contrast.map((p, i) => (
                    <ContrastRow p={p} key={i} />
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
          {s.dark.length ? (
            <>
              <h3 className="gl-h3">Dark mode</h3>
              <table className="gl-table">
                <thead>
                  <tr>
                    <th>Colour</th>
                    <th>Light</th>
                    <th>Dark</th>
                  </tr>
                </thead>
                <tbody>
                  {s.dark.map((d, i) => (
                    <tr key={i}>
                      <td>{d.name}</td>
                      <td>
                        <span className="gl-pair">
                          <span className="gl-pair-chip" style={{ background: d.light }} />
                          <span className="gl-mono">{d.light}</span>
                        </span>
                      </td>
                      <td>
                        <span className="gl-pair">
                          <span className="gl-pair-chip" style={{ background: d.dark }} />
                          <span className="gl-mono">{d.dark}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </section>
      );
    case "typography":
      return (
        <section className="gl-page" id={`gl-${s.id}`}>
          <Head s={s} lede={s.rationale} />
          {s.fonts.map((f) => {
            const weight = f.role === "display" ? (f.spec.weights.includes(400) ? 400 : (f.spec.weights[0] ?? 400)) : (f.spec.weights[0] ?? 400);
            const sample = f.role === "mono" ? `const brand = { name: "${doc.brand.name}" };` : f.role === "display" ? s.sampleHeadline : s.sampleBody;
            return (
              <div className="gl-specimen gl-avoid" style={{ fontFamily: f.stack }} key={f.role}>
                <div className="gl-specimen-head">
                  <span className="gl-specimen-family" style={{ fontFamily: "var(--gl-body)" }}>
                    {f.label} · {f.spec.family}
                  </span>
                  <span className="gl-specimen-meta">
                    {f.spec.category} · {f.spec.weights.join(" / ")}
                    {f.spec.variable ? " · variable" : ""} · {f.spec.source}
                  </span>
                </div>
                <div className="gl-specimen-big" style={{ fontWeight: weight }}>
                  {sample}
                </div>
                <div className="gl-specimen-glyphs">{SPECIMEN_GLYPHS}</div>
                <div className="gl-specimen-figures">{SPECIMEN_FIGURES}</div>
              </div>
            );
          })}
          <h3 className="gl-h3">Type scale</h3>
          <p className="gl-prose gl-small gl-muted">
            Base {s.scale.base}px, ratio {s.scale.ratio}. Sizes are rounded to two decimals; use rem in code.
          </p>
          <ul className="gl-scale">
            {s.scale.steps.map((st) => (
              <li key={st.name}>
                <span className="gl-mono" style={{ textAlign: "left" }}>
                  {st.name}
                </span>
                <span className="gl-sample" style={{ fontSize: Math.min(st.px, 72) }}>
                  {doc.brand.name}
                </span>
                <span className="gl-mono">
                  {st.px}px · {st.rem}rem
                </span>
              </li>
            ))}
          </ul>
          {s.styles.length ? (
            <>
              <h3 className="gl-h3">Text styles</h3>
              <ul className="gl-list gl-styles">
                {s.styles.map((st) => (
                  <li key={st.id}>
                    <span
                      style={{
                        fontFamily: `var(--gl-${st.font})`,
                        fontSize: Math.min(st.size, 40),
                        fontWeight: st.weight,
                        lineHeight: st.lineHeight,
                        letterSpacing: `${st.letterSpacing}em`,
                        textTransform: st.transform,
                      }}
                    >
                      {st.name}
                    </span>
                    <span className="gl-mono gl-muted">
                      {st.size}px / {st.lineHeight} · {st.weight}
                      {st.letterSpacing ? ` · ${st.letterSpacing}em` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      );
    case "imagery":
      return (
        <section className="gl-page" id={`gl-${s.id}`}>
          <Head s={s} lede={s.guidance} />
          {s.attributes.length ? (
            <dl className="gl-dl gl-block">
              {s.attributes.map((a) => (
                <React.Fragment key={a.label}>
                  <dt>{a.label}</dt>
                  <dd>{a.value}</dd>
                </React.Fragment>
              ))}
            </dl>
          ) : null}
          <div className="gl-grid gl-grid-2 gl-block">
            {s.mood.length ? (
              <div>
                <div className="gl-label">Mood</div>
                <Chips items={s.mood} />
              </div>
            ) : null}
            {s.avoid.length ? (
              <div>
                <div className="gl-label">Avoid</div>
                <Chips items={s.avoid} className="gl-chip-no" />
              </div>
            ) : null}
          </div>
          {s.references.length ? (
            <>
              <h3 className="gl-h3">{s.referencesLabel}</h3>
              <Images images={s.references} />
            </>
          ) : null}
        </section>
      );
    case "elements":
      return (
        <section className="gl-page" id={`gl-${s.id}`}>
          <Head s={s} lede={s.notes} />
          <div className="gl-grid gl-grid-2 gl-block">
            {s.shapes.length ? (
              <div>
                <div className="gl-label">Shapes</div>
                <List items={s.shapes} />
              </div>
            ) : null}
            {s.patterns.length ? (
              <div>
                <div className="gl-label">Patterns</div>
                <List items={s.patterns} />
              </div>
            ) : null}
          </div>
          <div className="gl-block gl-avoid">
            <div className="gl-label">Icon style</div>
            <div className="gl-icon-row">
              <Svg svg={iconSamples(s.iconStyle, t.ink)} style={{ display: "contents" }} />
              <span className="gl-small gl-muted">
                {s.iconStyle.style} · {s.iconStyle.strokeWidth}px stroke · {s.iconStyle.cornerRadius}px corners
              </span>
            </div>
          </div>
        </section>
      );
    case "motion":
      return (
        <section className="gl-page" id={`gl-${s.id}`}>
          <Head s={s} lede={s.notes} />
          <div className="gl-motion gl-block">
            <Svg className="gl-figure" style={{ padding: 12 }} svg={easingCurveSvg(s.easing, t.ink, t.accent)} />
            <div>
              <div className="gl-label">Easing</div>
              <p className="gl-mono">{s.easing}</p>
              <div className="gl-label" style={{ marginTop: 18 }}>
                Durations · base {s.durationBase} ms{s.preset ? ` · logo preset “${s.preset}”` : ""}
              </div>
              <ul className="gl-list gl-durations">
                {s.durations.map((d) => (
                  <li key={d.name}>
                    <span>{d.name}</span>
                    <span className="gl-mono">{d.ms} ms</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {s.principles.length ? (
            <>
              <div className="gl-label">Principles</div>
              <ul className="gl-list gl-list-num">
                {s.principles.map((p, i) => (
                  <li key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      );
    case "applications":
      return (
        <section className="gl-page" id={`gl-${s.id}`}>
          <Head s={s} lede="The identity in use. Every application follows the logo, colour and type rules in this document." />
          <Images images={s.images} />
        </section>
      );
    case "colophon":
      return (
        <section className="gl-page gl-colophon" id={`gl-${s.id}`}>
          <Head s={s} />
          <div className="gl-grid gl-grid-2">
            <dl className="gl-dl">
              {s.client ? (
                <>
                  <dt>Client</dt>
                  <dd>{s.client}</dd>
                </>
              ) : null}
              {s.project ? (
                <>
                  <dt>Project</dt>
                  <dd>{s.project}</dd>
                </>
              ) : null}
              {s.industry ? (
                <>
                  <dt>Industry</dt>
                  <dd>{s.industry}</dd>
                </>
              ) : null}
              <dt>Version</dt>
              <dd>{s.version}</dd>
              <dt>Issued</dt>
              <dd>{s.date}</dd>
              <dt>Typefaces</dt>
              <dd>{s.fonts.map((f) => `${f.spec.family} (${f.label.toLowerCase()})`).join(", ")}</dd>
              {s.deliverables.length ? (
                <>
                  <dt>Deliverables</dt>
                  <dd>{s.deliverables.join(", ")}</dd>
                </>
              ) : null}
            </dl>
            <div>
              <div className="gl-label">Programme status</div>
              <ul className="gl-stages">
                {s.stages.map((st) => (
                  <li key={st.id}>
                    <span>{st.label}</span>
                    <span className="gl-mono">{st.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="gl-small gl-muted" style={{ marginTop: 40 }}>
            These guidelines are generated from the Brand Genome and stay in sync with it. Typefaces are served from Google Fonts unless noted; check each family&apos;s licence before self-hosting.
          </p>
        </section>
      );
  }
}

export function GuidelinesDocument({ doc }: { doc: GuidelinesDoc }) {
  return (
    <article className="gl-doc" data-version={doc.version} data-date={doc.dateIso}>
      {doc.sections.map((s) => (
        <Section s={s} doc={doc} key={s.id} />
      ))}
    </article>
  );
}
