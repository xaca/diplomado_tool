import { describe, expect, it } from 'vitest'
import {
  aspectOf,
  canvaViewUrl,
  detectEmbed,
  embedBox,
  isAllowedEmbed,
  isCanvaWebsite,
  isShortLink,
  linksInText,
  readEmbedInput,
  sandboxFor,
  toEmbedUrl,
} from '@/features/slides/embeds'

const ID = '1EzVDdMtwbIWzijQqLjCsDht7vjL6sXVr'

describe('embeds (M14)', () => {
  it.each([
    // Google: edit / view links become embed / preview links
    [
      `https://docs.google.com/presentation/d/${ID}/edit?slide=id.p1#slide=id.p1`,
      `https://docs.google.com/presentation/d/${ID}/embed?start=false&loop=false`,
    ],
    [
      `https://docs.google.com/presentation/d/e/2PACX-${ID}/pub?start=false`,
      `https://docs.google.com/presentation/d/e/2PACX-${ID}/embed?start=false&loop=false`,
    ],
    [
      `https://docs.google.com/document/d/${ID}/edit`,
      `https://docs.google.com/document/d/${ID}/preview`,
    ],
    [
      `https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`,
      `https://docs.google.com/spreadsheets/d/${ID}/preview`,
    ],
    [
      `https://docs.google.com/forms/d/e/1FAIpQL${ID}/viewform`,
      `https://docs.google.com/forms/d/e/1FAIpQL${ID}/viewform?embedded=true`,
    ],
    [
      `https://drive.google.com/file/d/${ID}/view?usp=sharing`,
      `https://drive.google.com/file/d/${ID}/preview`,
    ],
    // Videos (YouTube in privacy mode, with the start time)
    [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42',
    ],
    [
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ],
    [
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ],
    [
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ],
    [
      'https://vimeo.com/123456789/abcdef12',
      'https://player.vimeo.com/video/123456789?h=abcdef12',
    ],
    [
      'https://www.loom.com/share/0281766fa2d04bb788eaf19e65135184',
      'https://www.loom.com/embed/0281766fa2d04bb788eaf19e65135184',
    ],
    // Design tools
    [
      'https://www.figma.com/design/AbCdEf123456/Mi-app?node-id=1-2',
      'https://embed.figma.com/design/AbCdEf123456/Mi-app?node-id=1-2&embed-host=pbl',
    ],
    [
      'https://www.figma.com/file/AbCdEf123456/Mi-app',
      'https://embed.figma.com/design/AbCdEf123456/Mi-app?embed-host=pbl',
    ],
    [
      'https://embed.figma.com/deck/AbCdEf123456/Sin-titulo?node-id=1&embed-host=share',
      'https://embed.figma.com/deck/AbCdEf123456/Sin-titulo?node-id=1&embed-host=share',
    ],
    [
      'https://www.canva.com/design/DAGabc12345/xYz-tok3n/edit',
      'https://www.canva.com/design/DAGabc12345/xYz-tok3n/view?embed',
    ],
    [
      'https://www.canva.com/design/DAGabc12345/view',
      'https://www.canva.com/design/DAGabc12345/view?embed',
    ],
    [
      'https://miro.com/app/board/uXjVabc123=/',
      'https://miro.com/app/live-embed/uXjVabc123=/?embedMode=view_only_without_ui',
    ],
    [
      'https://mi-equipo.notion.site/Proyecto-123abc?pvs=4',
      'https://mi-equipo.notion.site/Proyecto-123abc',
    ],
    [
      'https://view.genial.ly/64a1b2c3d4e5f6a7b8c9d0e1/presentation-x',
      'https://view.genial.ly/64a1b2c3d4e5f6a7b8c9d0e1',
    ],
    [
      'https://prezi.com/p/abc123xyz/mi-presentacion/',
      'https://prezi.com/p/embed/abc123xyz/',
    ],
  ])('%s', (link, embed) => {
    expect(toEmbedUrl(link)).toBe(embed)
    expect(isAllowedEmbed(link)).toBe(true)
    // converting twice changes nothing (old slides are fixed when shown)
    expect(toEmbedUrl(embed)).toBe(embed)
  })

  it('knows the service of links that cannot be framed, and says so', () => {
    expect(detectEmbed('https://www.notion.so/Proyecto-123')?.name).toBe(
      'Notion',
    )
    expect(toEmbedUrl('https://www.notion.so/Proyecto-123')).toBeNull()
    expect(detectEmbed('https://padlet.com/laura/mi-muro')?.name).toBe('Padlet')
    expect(toEmbedUrl('https://padlet.com/laura/mi-muro')).toBeNull()
    expect(toEmbedUrl('https://padlet.com/embed/abc123')).toBe(
      'https://padlet.com/embed/abc123',
    )
  })

  it('anything else stays a link', () => {
    for (const link of [
      'https://example.com/video',
      'https://evil.com/presentation/d/x/edit',
      'javascript:alert(1)',
      'not a url',
      `http://docs.google.com/presentation/d/${ID}/edit`,
    ])
      expect(isAllowedEmbed(link), link).toBe(false)
  })

  it('Google Forms may be filled in (allow-forms); others get the base sandbox', () => {
    expect(
      sandboxFor(`https://docs.google.com/forms/d/e/1FAIpQL${ID}/viewform`),
    ).toContain('allow-forms')
    expect(sandboxFor('https://youtu.be/dQw4w9WgXcQ')).not.toContain(
      'allow-forms',
    )
  })

  it('short links are expanded only for known shorteners', () => {
    expect(isShortLink('https://canva.link/q3ta5rzcro4ifxn')).toBe(true)
    expect(isShortLink('https://forms.gle/abc')).toBe(true)
    expect(isShortLink('https://youtu.be/dQw4w9WgXcQ')).toBe(false) // already a video link
    expect(isShortLink('https://bit.ly/abc')).toBe(false)
  })

  it('boxes fit the slide, centered, with the service shape', () => {
    expect(embedBox(16 / 9)).toEqual({ x: 77, y: 43, width: 806, height: 454 })
    const tall = embedBox(3 / 4)
    expect(tall.height).toBe(454)
    expect(tall.width).toBe(340)
  })

  it('finds links typed in a text, also when wrapped over two lines', () => {
    expect(
      linksInText(
        `https://docs.google.com/presentation/d/1EzVDdMtwbIWzijQqLj\nCsDht7vjL6sXVr/edit?slide=id.p1#slide=id.p1`,
      ),
    ).toEqual([
      `https://docs.google.com/presentation/d/${ID}/edit?slide=id.p1#slide=id.p1`,
    ])
    expect(
      linksInText('Mira https://youtu.be/dQw4w9WgXcQ.\nMi proyecto'),
    ).toEqual(['https://youtu.be/dQw4w9WgXcQ'])
    expect(linksInText('sin enlaces')).toEqual([])
  })
})

// Canva's "Compartir → Insertar → Código HTML" (shape as of 2026-10)
const CANVA_CODE = `<div style="position: relative; width: 100%; height: 0; padding-top: 141.4286%;
 padding-bottom: 0; box-shadow: 0 2px 8px 0 rgba(63,69,81,0.16); margin-top: 1.6em; margin-bottom: 0.9em; overflow: hidden;
 border-radius: 8px; will-change: transform;">
  <iframe loading="lazy" style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; border: none; padding: 0;margin: 0;"
    src="https://www.canva.com/design/DAFTFxhLLPw/ddljelrvwHm5zBTlNywJMQ/view?embed" allowfullscreen="allowfullscreen" allow="fullscreen">
  </iframe>
</div>
<a href="https:&#x2F;&#x2F;www.canva.com&#x2F;design&#x2F;DAFTFxhLLPw&#x2F;ddljelrvwHm5zBTlNywJMQ&#x2F;view?utm_content=DAFTFxhLLPw&amp;utm_campaign=designshare" target="_blank" rel="noopener">Currículo</a> de Evander`

describe('Canva and embed codes (M17)', () => {
  it.each([
    // view, edit, watch, with or without the share token and tracking parameters
    [
      'https://www.canva.com/design/DAFTFxhLLPw/ddljelrvwHm5zBTlNywJMQ/edit?utm_content=DAFTFxhLLPw&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton',
      'https://www.canva.com/design/DAFTFxhLLPw/ddljelrvwHm5zBTlNywJMQ/view?embed',
    ],
    [
      'https://www.canva.com/design/DAGeMaSxtSw/3VAmKI1ZgM91cBRC7YI3Ww/watch',
      'https://www.canva.com/design/DAGeMaSxtSw/3VAmKI1ZgM91cBRC7YI3Ww/view?embed',
    ],
    [
      'https://canva.com/design/DAGVpoxVEFI/Bxj2j5xOY8bbau0LTmNz3Q/view?embed',
      'https://www.canva.com/design/DAGVpoxVEFI/Bxj2j5xOY8bbau0LTmNz3Q/view?embed',
    ],
  ])('%s → %s', (link, embed) => {
    expect(detectEmbed(link)?.id).toBe('canva')
    expect(toEmbedUrl(link)).toBe(embed)
  })

  it('the view link for Canva oEmbed, only for designs', () => {
    expect(
      canvaViewUrl(
        'https://www.canva.com/design/DAFTFxhLLPw/ddljelrvwHm5zBTlNywJMQ/edit?utm_source=x',
      ),
    ).toBe(
      'https://www.canva.com/design/DAFTFxhLLPw/ddljelrvwHm5zBTlNywJMQ/view',
    )
    expect(canvaViewUrl('https://www.canva.com/design/DAEv-7H1qU4/view')).toBe(
      'https://www.canva.com/design/DAEv-7H1qU4/view',
    )
    expect(canvaViewUrl('https://www.canva.com/templates/')).toBeNull()
    expect(canvaViewUrl('https://www.figma.com/design/abc123XYZ/x')).toBeNull()
  })

  it('Canva websites are recognized but never framed', () => {
    for (const site of [
      'https://michalgeyer.my.canva.site/',
      'https://harinii2415.my.canva.site/sales-product-website',
    ]) {
      expect(detectEmbed(site)?.id).toBe('canva')
      expect(isCanvaWebsite(site)).toBe(true)
      expect(toEmbedUrl(site)).toBeNull()
      expect(isAllowedEmbed(site)).toBe(false)
    }
    expect(
      isCanvaWebsite('https://www.canva.com/design/DAEv-7H1qU4/view'),
    ).toBe(false)
  })

  it("reads the address and the shape from Canva's embed code", () => {
    const read = readEmbedInput(CANVA_CODE)!
    expect(read.link).toBe(
      'https://www.canva.com/design/DAFTFxhLLPw/ddljelrvwHm5zBTlNywJMQ/view?embed',
    )
    // A4 portrait: 1 / 1.414286
    expect(read.aspect).toBeCloseTo(0.7071, 3)
    expect(toEmbedUrl(read.link)).toBe(read.link)
  })

  it("reads other services' codes (width / height), and plain links as they are", () => {
    const youtube = readEmbedInput(
      '<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=abc&amp;start=30" title="YouTube video player" frameborder="0" allowfullscreen></iframe>',
    )!
    expect(youtube.link).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ?si=abc&start=30',
    )
    expect(youtube.aspect).toBeCloseTo(16 / 9, 3)
    expect(
      readEmbedInput(
        "<iframe style='border: 1px solid rgba(0, 0, 0, 0.1);' width='800' height='450' src='https://embed.figma.com/design/abc123XYZ/Proto?embed-host=share' allowfullscreen></iframe>",
      ),
    ).toEqual({
      link: 'https://embed.figma.com/design/abc123XYZ/Proto?embed-host=share',
      aspect: 800 / 450,
    })
    expect(readEmbedInput('  https://youtu.be/dQw4w9WgXcQ ')).toEqual({
      link: 'https://youtu.be/dQw4w9WgXcQ',
      aspect: null,
    })
  })

  it("only Canva's credit link (no frame): entities decoded", () => {
    const anchor = CANVA_CODE.slice(CANVA_CODE.indexOf('<a '))
    expect(readEmbedInput(anchor)?.link).toBe(
      'https://www.canva.com/design/DAFTFxhLLPw/ddljelrvwHm5zBTlNywJMQ/view?utm_content=DAFTFxhLLPw&utm_campaign=designshare',
    )
    expect(toEmbedUrl(readEmbedInput(anchor)!.link)).toBe(
      'https://www.canva.com/design/DAFTFxhLLPw/ddljelrvwHm5zBTlNywJMQ/view?embed',
    )
  })

  it('a code without an address is not a link; odd sizes are clamped', () => {
    expect(readEmbedInput('<div style="padding-top: 56%"></div>')).toBeNull()
    expect(
      readEmbedInput('<script src="https://evil.example/x.js"></script>'),
    ).toBeNull()
    expect(aspectOf(0, 10)).toBeNull()
    expect(aspectOf(100, 1000)).toBeCloseTo(1 / 3)
    expect(aspectOf(1000, 10)).toBe(3)
  })
})
